const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { pool } = require('../config/database');
const { authenticateToken, generateLiveAccessToken, requirePhotographer, verifyLiveAccessToken } = require('../middleware/auth');
const { buildImageVariants, deleteTempFile } = require('../middleware/imageProcessor');
const { logActivity } = require('../lib/activity-log');
const { slugify } = require('../lib/slug');
const { deleteByUrl, uploadBuffer } = require('../lib/storage');
const { assertManageLive, buildManageLiveWhere } = require('../lib/live-permissions');
const { recordViewerEvent } = require('../lib/viewer-analytics');

const router = express.Router();
const LIVE_IDLE_END_MINUTES = Math.max(Number(process.env.LIVE_IDLE_END_MINUTES) || 30, 5);
const liveMediaTempRoot = path.join(__dirname, '..', 'uploads', 'live-media-temp');
const liveMediaUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => {
            fs.mkdirSync(liveMediaTempRoot, { recursive: true });
            cb(null, liveMediaTempRoot);
        },
        filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname) || '.jpg';
            cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
        }
    }),
    limits: {
        fileSize: 8 * 1024 * 1024
    },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            cb(new Error('仅支持图片文件'));
            return;
        }
        cb(null, true);
    }
});

router.get('/', async (req, res) => {
    try {
        const { status = 'live', limit = 12 } = req.query;
        const [rows] = await pool.query(
            `SELECT id, title, slug, subtitle, description, cover_image, banner_image, opening_image, event_date, status, location_name,
                    share_title, share_description, share_logo, watermark_enabled, watermark_text,
                    theme_color, enable_share, enable_client_link_copy, allow_original_download, allow_watermarked_download,
                    allow_batch_download, show_photographer, show_banner, show_opening, opening_duration, layout_mode, created_at, updated_at,
                    (SELECT COUNT(*) FROM photos p WHERE p.live_id = lives.id) AS total_photos,
                    (SELECT MAX(p.created_at) FROM photos p WHERE p.live_id = lives.id) AS last_photo_uploaded_at
             FROM lives
             ORDER BY event_date DESC, created_at DESC
             LIMIT ?`,
            [Number(limit)]
        );
        const data = rows
            .map((row) => mapPublicLive(withResolvedLiveStatus(row)))
            .filter((row) => status === 'all' || row.status === status);

        res.json({ code: 200, data });
    } catch (error) {
        console.error('获取直播列表失败:', error);
        res.status(500).json({ code: 500, message: '获取直播列表失败' });
    }
});

router.get('/admin/list', authenticateToken, requirePhotographer, async (req, res) => {
    try {
        const scope = buildManageLiveWhere(req.user);
        const [rows] = await pool.query(
            `SELECT l.*,
                    COUNT(p.id) AS photo_total,
                    MAX(p.created_at) AS last_photo_uploaded_at
             FROM lives l
             ${scope.join}
             LEFT JOIN photos p ON p.live_id = l.id
             WHERE ${scope.where}
             GROUP BY l.id
             ORDER BY l.event_date DESC, l.created_at DESC`,
            scope.params
        );

        res.json({ code: 200, data: rows.map(withResolvedLiveStatus) });
    } catch (error) {
        console.error('获取后台直播列表失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '获取后台直播列表失败' });
    }
});

router.get('/slug/:slug', async (req, res) => {
    try {
        const requestedSlug = decodeURIComponent(req.params.slug || '');
        let [lives] = await pool.query(
            `SELECT l.*,
                    u.nickname AS creator_name,
                    COUNT(p.id) AS total_photos,
                    MAX(p.created_at) AS last_photo_uploaded_at,
                    COALESCE(SUM(p.view_count), 0) AS total_views,
                    COALESCE(SUM(p.like_count), 0) AS total_likes
             FROM lives l
             LEFT JOIN users u ON u.id = l.created_by
             LEFT JOIN photos p ON p.live_id = l.id
             WHERE l.slug = ? OR l.title = ?
             GROUP BY l.id
             ORDER BY CASE WHEN l.slug = ? THEN 0 ELSE 1 END
             LIMIT 1`,
            [requestedSlug, requestedSlug, requestedSlug]
        );

        let live = lives[0];
        if (!live) {
            const [fallbackLives] = await pool.query(
                `SELECT l.*,
                        u.nickname AS creator_name,
                        COUNT(p.id) AS total_photos,
                        MAX(p.created_at) AS last_photo_uploaded_at,
                        COALESCE(SUM(p.view_count), 0) AS total_views,
                        COALESCE(SUM(p.like_count), 0) AS total_likes
                 FROM lives l
                 LEFT JOIN users u ON u.id = l.created_by
                 LEFT JOIN photos p ON p.live_id = l.id
                 GROUP BY l.id
                 HAVING COUNT(p.id) > 0
                 ORDER BY l.event_date DESC, l.created_at DESC
                 LIMIT 2`
            );
            if (fallbackLives.length === 1) {
                live = fallbackLives[0];
            }
        }
        if (!live) {
            return res.status(404).json({ code: 404, message: '直播不存在' });
        }

        const [albums] = await pool.query(
            'SELECT id, live_id, name, icon, cover_image, sort_order, photo_count FROM albums WHERE live_id = ? ORDER BY sort_order ASC, id ASC',
            [live.id]
        );

        const accessVerified = verifyLiveAccessToken(req.headers['x-live-access'], live.id);
        live = withResolvedLiveStatus(live);

        res.json({
            code: 200,
            data: {
                ...mapPublicLive(live),
                total_photos: live.total_photos,
                total_views: live.total_views,
                total_likes: live.total_likes,
                creator_name: live.creator_name,
                access_granted: !live.access_code || accessVerified,
                albums
            }
        });
    } catch (error) {
        console.error('获取直播详情失败:', error);
        res.status(500).json({ code: 500, message: '获取直播详情失败' });
    }
});

router.get('/slug/:slug/version', async (req, res) => {
    try {
        const requestedSlug = decodeURIComponent(req.params.slug || '');
        let [lives] = await pool.query(
            `SELECT l.id, l.slug, l.title, l.status, l.access_code, l.updated_at,
                    (SELECT COUNT(*) FROM photos p WHERE p.live_id = l.id AND p.is_public = 1) AS total_photos,
                    (SELECT COUNT(*) FROM albums a WHERE a.live_id = l.id) AS total_albums,
                    (SELECT MAX(p.created_at) FROM photos p WHERE p.live_id = l.id) AS last_photo_uploaded_at
             FROM lives l
             WHERE l.slug = ? OR l.title = ?
             ORDER BY CASE WHEN l.slug = ? THEN 0 ELSE 1 END
             LIMIT 1`,
            [requestedSlug, requestedSlug, requestedSlug]
        );

        let live = lives[0];
        if (!live) {
            const [fallbackLives] = await pool.query(
                `SELECT l.id, l.slug, l.title, l.status, l.access_code, l.updated_at,
                        (SELECT COUNT(*) FROM photos p WHERE p.live_id = l.id AND p.is_public = 1) AS total_photos,
                        (SELECT COUNT(*) FROM albums a WHERE a.live_id = l.id) AS total_albums,
                        (SELECT MAX(p.created_at) FROM photos p WHERE p.live_id = l.id) AS last_photo_uploaded_at
                 FROM lives l
                 ORDER BY l.event_date DESC, l.created_at DESC
                 LIMIT 2`
            );
            if (fallbackLives.length === 1) {
                live = fallbackLives[0];
            }
        }
        if (!live) {
            return res.status(404).json({ code: 404, message: '直播不存在' });
        }

        live = withResolvedLiveStatus(live);
        const accessVerified = verifyLiveAccessToken(req.headers['x-live-access'], live.id);
        const updatedAt = live.updated_at ? new Date(live.updated_at).getTime() : 0;
        const totalPhotos = Number(live.total_photos || 0);
        const totalAlbums = Number(live.total_albums || 0);

        res.json({
            code: 200,
            data: {
                id: live.id,
                slug: live.slug,
                title: live.title,
                status: live.status,
                total_photos: totalPhotos,
                total_albums: totalAlbums,
                access_granted: !live.access_code || accessVerified,
                requires_access_code: Boolean(live.access_code),
                content_version: `${updatedAt}:${totalPhotos}:${totalAlbums}`
            }
        });
    } catch (error) {
        console.error('获取直播版本失败:', error);
        res.status(500).json({ code: 500, message: '获取直播版本失败' });
    }
});

router.get('/:id', authenticateToken, requirePhotographer, async (req, res) => {
    try {
        await assertManageLive(pool, req.user, req.params.id);
        const [rows] = await pool.query(
            `SELECT l.*,
                    (SELECT COUNT(*) FROM photos p WHERE p.live_id = l.id) AS total_photos,
                    (SELECT MAX(p.created_at) FROM photos p WHERE p.live_id = l.id) AS last_photo_uploaded_at
             FROM lives l
             WHERE l.id = ?
             LIMIT 1`,
            [req.params.id]
        );
        if (!rows[0]) {
            return res.status(404).json({ code: 404, message: '直播不存在' });
        }
        res.json({ code: 200, data: withResolvedLiveStatus(rows[0]) });
    } catch (error) {
        console.error('获取直播信息失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '获取直播信息失败' });
    }
});

router.post('/', authenticateToken, requirePhotographer, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const payload = normalizeLivePayload(req.body);
        if (!payload.title) {
            return res.status(400).json({ code: 400, message: '请填写直播标题' });
        }

        const liveSlug = slugify(payload.slug || payload.title, payload.event_date);
        const [result] = await connection.query(
            `INSERT INTO lives
            (title, slug, subtitle, description, cover_image, banner_image, opening_image, share_title, share_description, share_logo,
             background_music, event_date, location_name, status, access_code, theme_color, watermark_enabled,
             watermark_text, enable_share, enable_client_link_copy, allow_original_download, allow_watermarked_download, allow_batch_download,
             show_photographer, enable_guest_upload, require_photo_review, show_banner, show_opening, opening_duration, layout_mode, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                payload.title,
                liveSlug,
                payload.subtitle,
                payload.description,
                payload.cover_image,
                payload.banner_image,
                payload.opening_image,
                payload.share_title || payload.title,
                payload.share_description,
                payload.share_logo,
                payload.background_music,
                payload.event_date,
                payload.location_name,
                payload.status,
                payload.access_code,
                payload.theme_color,
                payload.watermark_enabled,
                payload.watermark_text || payload.title,
                payload.enable_share,
                payload.enable_client_link_copy,
                payload.allow_original_download,
                payload.allow_watermarked_download,
                payload.allow_batch_download,
                payload.show_photographer,
                payload.enable_guest_upload,
                payload.require_photo_review,
                payload.show_banner,
                payload.show_opening,
                payload.opening_duration,
                payload.layout_mode,
                req.user.id
            ]
        );

        await logActivity(connection, {
            liveId: result.insertId,
            user: req.user,
            action: 'live.create',
            targetType: 'live',
            targetId: String(result.insertId),
            detail: { title: payload.title, slug: liveSlug }
        });

        res.status(201).json({
            code: 200,
            message: '直播创建成功',
            data: {
                id: result.insertId,
                slug: liveSlug
            }
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ code: 400, message: '直播标识已存在，请更换 slug' });
        }

        console.error('创建直播失败:', error);
        res.status(500).json({ code: 500, message: '创建直播失败' });
    } finally {
        connection.release();
    }
});

router.put('/:id', authenticateToken, requirePhotographer, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const currentId = Number(req.params.id);
        await assertManageLive(connection, req.user, currentId);
        const payload = normalizeLivePayload(req.body);
        const [currentRows] = await connection.query('SELECT id, title FROM lives WHERE id = ? LIMIT 1', [currentId]);
        if (!currentRows[0]) {
            return res.status(404).json({ code: 404, message: '直播不存在' });
        }

        const nextTitle = payload.title || currentRows[0].title;
        const nextSlug = slugify(payload.slug || nextTitle, payload.event_date);

        await connection.query(
            `UPDATE lives
             SET title = ?, slug = ?, subtitle = ?, description = ?, cover_image = ?, banner_image = ?, opening_image = ?,
                 share_title = ?, share_description = ?, share_logo = ?, background_music = ?,
                 event_date = ?, location_name = ?, status = ?, access_code = ?, theme_color = ?,
                 watermark_enabled = ?, watermark_text = ?, enable_share = ?, enable_client_link_copy = ?, allow_original_download = ?,
                 allow_watermarked_download = ?, allow_batch_download = ?, show_photographer = ?,
                 enable_guest_upload = ?, require_photo_review = ?, show_banner = ?, show_opening = ?, opening_duration = ?, layout_mode = ?
             WHERE id = ?`,
            [
                nextTitle,
                nextSlug,
                payload.subtitle,
                payload.description,
                payload.cover_image,
                payload.banner_image,
                payload.opening_image,
                payload.share_title || nextTitle,
                payload.share_description,
                payload.share_logo,
                payload.background_music,
                payload.event_date,
                payload.location_name,
                payload.status,
                payload.access_code,
                payload.theme_color,
                payload.watermark_enabled,
                payload.watermark_text || nextTitle,
                payload.enable_share,
                payload.enable_client_link_copy,
                payload.allow_original_download,
                payload.allow_watermarked_download,
                payload.allow_batch_download,
                payload.show_photographer,
                payload.enable_guest_upload,
                payload.require_photo_review,
                payload.show_banner,
                payload.show_opening,
                payload.opening_duration,
                payload.layout_mode,
                currentId
            ]
        );

        await logActivity(connection, {
            liveId: currentId,
            user: req.user,
            action: 'live.update',
            targetType: 'live',
            targetId: String(currentId),
            detail: { title: nextTitle, slug: nextSlug }
        });

        res.json({ code: 200, message: '直播更新成功' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ code: 400, message: '直播标识已存在，请更换 slug' });
        }

        console.error('更新直播失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '更新直播失败' });
    } finally {
        connection.release();
    }
});

router.post('/:id/banner-image', authenticateToken, requirePhotographer, liveMediaUpload.single('image'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const liveId = Number(req.params.id);
        await assertManageLive(connection, req.user, liveId);

        if (!req.file) {
            return res.status(400).json({ code: 400, message: '请选择头图文件' });
        }

        const [rows] = await connection.query('SELECT id, title, cover_image, banner_image FROM lives WHERE id = ? LIMIT 1', [liveId]);
        const live = rows[0];
        if (!live) {
            return res.status(404).json({ code: 404, message: '相册不存在' });
        }

        const variants = await buildImageVariants(req.file.path, {
            maxWidth: 1800,
            compressedQuality: 84,
            thumbnailWidth: 1280,
            thumbnailHeight: 720,
            watermarkEnabled: false
        });

        const bannerKey = `live-banners/${liveId}/${Date.now()}-banner.webp`;
        const uploaded = await uploadBuffer(bannerKey, variants.compressedBuffer);
        const nextUrl = uploaded.url;

        await connection.query(
            'UPDATE lives SET banner_image = ?, cover_image = ?, show_banner = 1 WHERE id = ?',
            [nextUrl, nextUrl, liveId]
        );

        await logActivity(connection, {
            liveId,
            user: req.user,
            action: 'live.banner.upload',
            targetType: 'live',
            targetId: String(liveId),
            detail: { banner_image: nextUrl }
        });

        const previousUrls = [live.banner_image, live.cover_image].filter(Boolean).filter((url) => url !== nextUrl);
        for (const url of previousUrls) {
            const [references] = await connection.query(
                `SELECT COUNT(*) AS total
                 FROM lives
                 WHERE id <> ?
                   AND (cover_image = ? OR banner_image = ? OR share_logo = ? OR background_music = ?)`,
                [liveId, url, url, url, url]
            );
            if (Number(references[0]?.total || 0) === 0) {
                await safeDeleteByUrl(url);
            }
        }

        res.json({
            code: 200,
            message: '头图已更新',
            data: {
                banner_image: nextUrl,
                cover_image: nextUrl,
                width: variants.metadata.width || 0,
                height: variants.metadata.height || 0
            }
        });
    } catch (error) {
        console.error('上传头图失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '上传头图失败' });
    } finally {
        if (req.file?.path) {
            deleteTempFile(req.file.path);
        }
        connection.release();
    }
});

router.post('/:id/opening-image', authenticateToken, requirePhotographer, liveMediaUpload.single('image'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const liveId = Number(req.params.id);
        await assertManageLive(connection, req.user, liveId);

        if (!req.file) {
            return res.status(400).json({ code: 400, message: '请选择开场封面文件' });
        }

        const [rows] = await connection.query('SELECT id, title, opening_image FROM lives WHERE id = ? LIMIT 1', [liveId]);
        const live = rows[0];
        if (!live) {
            return res.status(404).json({ code: 404, message: '相册不存在' });
        }

        const variants = await buildImageVariants(req.file.path, {
            maxWidth: 1600,
            compressedQuality: 86,
            thumbnailWidth: 1280,
            thumbnailHeight: 2276,
            watermarkEnabled: false
        });

        const openingKey = `live-openings/${liveId}/${Date.now()}-opening.webp`;
        const uploaded = await uploadBuffer(openingKey, variants.compressedBuffer);
        const nextUrl = uploaded.url;

        await connection.query(
            'UPDATE lives SET opening_image = ?, show_opening = 1 WHERE id = ?',
            [nextUrl, liveId]
        );

        await logActivity(connection, {
            liveId,
            user: req.user,
            action: 'live.opening.upload',
            targetType: 'live',
            targetId: String(liveId),
            detail: { opening_image: nextUrl }
        });

        if (live.opening_image && live.opening_image !== nextUrl) {
            const [references] = await connection.query(
                `SELECT COUNT(*) AS total
                 FROM lives
                 WHERE id <> ?
                   AND opening_image = ?`,
                [liveId, live.opening_image]
            );
            if (Number(references[0]?.total || 0) === 0) {
                await safeDeleteByUrl(live.opening_image);
            }
        }

        res.json({
            code: 200,
            message: '开场封面已更新',
            data: {
                opening_image: nextUrl,
                width: variants.metadata.width || 0,
                height: variants.metadata.height || 0
            }
        });
    } catch (error) {
        console.error('上传开场封面失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '上传开场封面失败' });
    } finally {
        if (req.file?.path) {
            deleteTempFile(req.file.path);
        }
        connection.release();
    }
});

router.delete('/:id', authenticateToken, requirePhotographer, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const liveId = Number(req.params.id);
        await assertManageLive(connection, req.user, liveId);
        const [rows] = await connection.query(
            `SELECT id, title, cover_image, banner_image, opening_image, share_logo, background_music
             FROM lives
             WHERE id = ?
             LIMIT 1`,
            [liveId]
        );
        const live = rows[0];
        if (!live) {
            return res.status(404).json({ code: 404, message: '直播不存在' });
        }

        const [photos] = await connection.query(
            `SELECT id, original_url, compressed_url, thumbnail_url, watermarked_url
             FROM photos
             WHERE live_id = ?`,
            [liveId]
        );

        const [downloadJobs] = await connection.query(
            `SELECT archive_url
             FROM download_jobs
             WHERE live_id = ?`,
            [liveId]
        );

        await logActivity(connection, {
            liveId: live.id,
            user: req.user,
            action: 'live.delete',
            targetType: 'live',
            targetId: String(live.id),
            detail: { title: live.title }
        });

        await connection.query('DELETE FROM lives WHERE id = ?', [liveId]);
        await cleanupLivePhotoAssets(connection, liveId, photos);
        await cleanupLiveMetaAssets(connection, liveId, live);
        await cleanupLiveArchiveAssets(connection, liveId, downloadJobs);

        res.json({ code: 200, message: '直播删除成功' });
    } catch (error) {
        console.error('删除直播失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '删除直播失败' });
    } finally {
        connection.release();
    }
});

router.post('/:id/verify-access', async (req, res) => {
    try {
        const { code = '' } = req.body;
        const [rows] = await pool.query('SELECT id, access_code FROM lives WHERE id = ? LIMIT 1', [req.params.id]);
        const live = rows[0];
        if (!live) {
            return res.status(404).json({ code: 404, message: '直播不存在' });
        }

        if (!live.access_code) {
            return res.json({
                code: 200,
                data: {
                    accessToken: generateLiveAccessToken(live.id)
                }
            });
        }

        if (String(code).trim() !== String(live.access_code).trim()) {
            return res.status(401).json({ code: 401, message: '访问码错误' });
        }

        res.json({
            code: 200,
            data: {
                accessToken: generateLiveAccessToken(live.id)
            }
        });
    } catch (error) {
        console.error('校验访问码失败:', error);
        res.status(500).json({ code: 500, message: '校验访问码失败' });
    }
});

router.post('/:id/view', async (req, res) => {
    try {
        await pool.query('UPDATE lives SET view_count = view_count + 1 WHERE id = ?', [req.params.id]);
        await recordViewerEvent(pool, {
            req,
            liveId: Number(req.params.id),
            eventType: 'live_view'
        });
        res.json({ code: 200, message: 'ok' });
    } catch (error) {
        console.error('更新直播浏览失败:', error);
        res.status(500).json({ code: 500, message: '更新失败' });
    }
});

function normalizeLivePayload(body) {
    return {
        title: String(body.title || '').trim(),
        slug: String(body.slug || '').trim(),
        subtitle: String(body.subtitle || '').trim(),
        description: String(body.description || '').trim(),
        cover_image: String(body.cover_image || '').trim(),
        banner_image: String(body.banner_image || '').trim(),
        opening_image: String(body.opening_image || '').trim(),
        share_title: String(body.share_title || '').trim(),
        share_description: String(body.share_description || '').trim(),
        share_logo: String(body.share_logo || '').trim(),
        background_music: String(body.background_music || '').trim(),
        event_date: body.event_date || null,
        location_name: String(body.location_name || '').trim(),
        status: ['live', 'ended', 'draft'].includes(body.status) ? body.status : 'draft',
        access_code: String(body.access_code || '').trim(),
        theme_color: String(body.theme_color || '#c76b34').trim() || '#c76b34',
        watermark_enabled: toFlag(body.watermark_enabled, 0),
        watermark_text: String(body.watermark_text || '').trim(),
        enable_share: toFlag(body.enable_share, 1),
        enable_client_link_copy: toFlag(body.enable_client_link_copy, 0),
        allow_original_download: toFlag(body.allow_original_download, 0),
        allow_watermarked_download: toFlag(body.allow_watermarked_download, 0),
        allow_batch_download: toFlag(body.allow_batch_download, 0),
        show_photographer: toFlag(body.show_photographer, 1),
        enable_guest_upload: toFlag(body.enable_guest_upload, 0),
        require_photo_review: toFlag(body.require_photo_review, 0),
        show_banner: toFlag(body.show_banner, 1),
        show_opening: toFlag(body.show_opening, 0),
        opening_duration: Math.min(Math.max(Number(body.opening_duration) || 3, 1), 9),
        layout_mode: String(body.layout_mode || 'waterfall').trim() || 'waterfall'
    };
}

function toFlag(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    return Number(Boolean(Number(value)));
}

function mapPublicLive(live) {
    return {
        id: live.id,
        title: live.title,
        slug: live.slug,
        subtitle: live.subtitle || '',
        description: live.description || '',
        cover_image: live.cover_image || '',
        banner_image: live.banner_image || '',
        opening_image: live.opening_image || '',
        share_title: live.share_title || live.title,
        share_description: live.share_description || live.description || '',
        share_logo: live.share_logo || '',
        background_music: live.background_music || '',
        event_date: live.event_date,
        status: live.status,
        location_name: live.location_name || '',
        theme_color: live.theme_color || '#c76b34',
        watermark_enabled: Number(live.watermark_enabled || 0),
        watermark_text: live.watermark_text || live.title,
        enable_share: Number(live.enable_share || 0),
        enable_client_link_copy: Number(live.enable_client_link_copy || 0),
        allow_original_download: Number(live.allow_original_download || 0),
        allow_watermarked_download: Number(live.allow_watermarked_download || 0),
        allow_batch_download: Number(live.allow_batch_download || 0),
        show_photographer: Number(live.show_photographer || 0),
        enable_guest_upload: Number(live.enable_guest_upload || 0),
        require_photo_review: Number(live.require_photo_review || 0),
        show_banner: Number(live.show_banner || 0),
        show_opening: Number(live.show_opening || 0),
        opening_duration: Number(live.opening_duration || 3),
        layout_mode: live.layout_mode || 'waterfall',
        requires_access_code: Boolean(live.access_code)
    };
}

function withResolvedLiveStatus(live) {
    const totalPhotos = Number(live.total_photos || live.photo_total || 0);
    const lastUploadedAt = live.last_photo_uploaded_at ? new Date(live.last_photo_uploaded_at).getTime() : 0;

    let resolvedStatus = 'draft';
    if (totalPhotos > 0) {
        const idleWindowMs = LIVE_IDLE_END_MINUTES * 60 * 1000;
        resolvedStatus = (Date.now() - lastUploadedAt) <= idleWindowMs ? 'live' : 'ended';
    }

    return {
        ...live,
        status: resolvedStatus,
        resolved_status: resolvedStatus
    };
}

async function cleanupLivePhotoAssets(executor, liveId, photos) {
    const urls = Array.from(new Set(
        (photos || []).flatMap((photo) => [
            photo.original_url,
            photo.compressed_url,
            photo.thumbnail_url,
            photo.watermarked_url
        ]).filter(Boolean)
    ));

    for (const url of urls) {
        const [rows] = await executor.query(
            `SELECT COUNT(*) AS total
             FROM photos
             WHERE live_id <> ?
               AND (original_url = ? OR compressed_url = ? OR thumbnail_url = ? OR watermarked_url = ?)`,
            [liveId, url, url, url, url]
        );

        if (Number(rows[0]?.total || 0) === 0) {
            await safeDeleteByUrl(url);
        }
    }
}

async function cleanupLiveMetaAssets(executor, liveId, live) {
    const urls = Array.from(new Set([
        live.cover_image,
        live.banner_image,
        live.opening_image,
        live.share_logo,
        live.background_music
    ].filter(Boolean)));

    for (const url of urls) {
        const [rows] = await executor.query(
            `SELECT COUNT(*) AS total
             FROM lives
             WHERE id <> ?
               AND (cover_image = ? OR banner_image = ? OR opening_image = ? OR share_logo = ? OR background_music = ?)`,
            [liveId, url, url, url, url, url]
        );

        if (Number(rows[0]?.total || 0) === 0) {
            await safeDeleteByUrl(url);
        }
    }
}

async function cleanupLiveArchiveAssets(executor, liveId, downloadJobs) {
    const urls = Array.from(new Set((downloadJobs || []).map((job) => job.archive_url).filter(Boolean)));
    for (const url of urls) {
        const [rows] = await executor.query(
            `SELECT COUNT(*) AS total
             FROM download_jobs
             WHERE live_id <> ?
               AND archive_url = ?`,
            [liveId, url]
        );

        if (Number(rows[0]?.total || 0) === 0) {
            await safeDeleteByUrl(url);
        }
    }
}

async function safeDeleteByUrl(url) {
    try {
        await deleteByUrl(url);
    } catch (error) {
        console.error('删除直播关联文件失败:', url, error.message);
    }
}

module.exports = router;
