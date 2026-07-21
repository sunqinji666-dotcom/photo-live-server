const archiver = require('archiver');
const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { pool } = require('../config/database');
const {
    authenticateToken,
    optionalAuth,
    readLiveAccessToken,
    requirePhotographer,
    verifyLiveAccessToken
} = require('../middleware/auth');
const {
    buildImageVariants,
    deleteTempFile,
    readRemoteImageMetadata
} = require('../middleware/imageProcessor');
const { logActivity } = require('../lib/activity-log');
const { assertManageLive } = require('../lib/live-permissions');
const { buildPhotoSearchFields } = require('../lib/photo-search');
const { recordViewerEvent } = require('../lib/viewer-analytics');
const {
    buildAttachmentUrl,
    buildQiniuImageUrls,
    buildQiniuUrl,
    createQiniuArchiveJob,
    createQiniuUploadToken,
    deleteByUrl,
    getQiniuUploadHost,
    queryQiniuArchiveJob,
    qiniuEnabled,
    resolveLocalPathFromUrl,
    storageMode,
    uploadBuffer
} = require('../lib/storage');

const router = express.Router();

const tempRoot = path.join(__dirname, '..', 'uploads', 'temp');
const maxPhotoUploadSize = 25 * 1024 * 1024;

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => {
            fs.mkdirSync(tempRoot, { recursive: true });
            cb(null, tempRoot);
        },
        filename: (_req, file, cb) => {
            const ext = path.extname(file.originalname) || '.jpg';
            cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
        }
    }),
    limits: {
        fileSize: Number(process.env.UPLOAD_MAX_SIZE) || maxPhotoUploadSize
    },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            cb(new Error('仅支持图片文件上传'));
            return;
        }
        cb(null, true);
    }
});

const DIRECT_UPLOAD_PREPARE_LIMIT = 30;
const SERVER_UPLOAD_BATCH_LIMIT = 100;

router.get('/', optionalAuth, async (req, res) => {
    try {
        const {
            live_id,
            album_id = 'all',
            page = 1,
            limit = 24,
            keyword = '',
            sort = 'latest',
            camera = '',
            lens = '',
            focal_length = '',
            aperture = '',
            iso = '',
            format = ''
        } = req.query;

        if (!live_id) {
            return res.status(400).json({ code: 400, message: '缺少 live_id 参数' });
        }

        const live = await ensureLiveViewAccess(pool, req, Number(live_id));
        if (!live.ok) {
            return res.status(live.status).json({ code: live.status, message: live.message });
        }

        const pageNumber = Math.max(1, Number(page) || 1);
        const pageSize = Math.min(Number(limit) || 24, 60);
        const offset = (pageNumber - 1) * pageSize;

        const whereParts = ['p.live_id = ?', 'p.is_public = 1'];
        const params = [Number(live_id)];

        if (album_id !== 'all') {
            whereParts.push('p.album_id = ?');
            params.push(Number(album_id));
        }

        if (camera) {
            whereParts.push('p.camera_search = ?');
            params.push(normalizeSearchKeyword(camera));
        }

        if (lens) {
            whereParts.push('p.lens_search = ?');
            params.push(normalizeSearchKeyword(lens));
        }

        if (focal_length) {
            whereParts.push('p.focal_length_search = ?');
            params.push(normalizeSearchKeyword(focal_length));
        }

        if (aperture) {
            whereParts.push('p.aperture_search = ?');
            params.push(normalizeSearchKeyword(aperture));
        }

        const exactIsoFilter = parseIsoSearchValue(iso);
        if (exactIsoFilter) {
            whereParts.push('p.iso_value = ?');
            params.push(exactIsoFilter);
        }

        const exactFormatFilter = parseFormatSearchValue(format);
        if (exactFormatFilter) {
            whereParts.push('p.format_value = ?');
            params.push(exactFormatFilter);
        }

        if (keyword) {
            const searchTerms = String(keyword)
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 6);

            if (searchTerms.length) {
                const termSqlParts = [];
                searchTerms.forEach((term) => {
                    const normalizedTerm = normalizeSearchKeyword(term);
                    if (!normalizedTerm) {
                        return;
                    }
                    const likeKeyword = `%${normalizedTerm}%`;
                    const conditionParts = [
                        'p.search_text LIKE ?',
                        'p.camera_search LIKE ?',
                        'p.lens_search LIKE ?',
                        'p.focal_length_search LIKE ?',
                        'p.aperture_search LIKE ?',
                        'p.shutter_speed_search LIKE ?',
                        'p.format_value LIKE ?',
                        'a.name LIKE ?',
                        'CAST(p.file_size AS CHAR) LIKE ?'
                    ];
                    const termParams = [
                        likeKeyword,
                        likeKeyword,
                        likeKeyword,
                        likeKeyword,
                        likeKeyword,
                        likeKeyword,
                        likeKeyword,
                        likeKeyword,
                        likeKeyword,
                    ];

                    const exactIso = parseIsoSearchValue(normalizedTerm);
                    if (exactIso) {
                        conditionParts.push('p.iso_value = ?');
                        termParams.push(exactIso);
                    } else {
                        conditionParts.push('CAST(p.iso_value AS CHAR) LIKE ?');
                        termParams.push(likeKeyword);
                    }

                    const exactFormat = parseFormatSearchValue(normalizedTerm);
                    if (exactFormat) {
                        conditionParts.push('p.format_value = ?');
                        termParams.push(exactFormat);
                    }

                    termSqlParts.push(`(${conditionParts.join(' OR ')})`);
                    params.push(...termParams);
                });

                if (termSqlParts.length) {
                    whereParts.push(`(${termSqlParts.join(' OR ')})`);
                }
            }
        }

        let orderBy = 'p.created_at DESC';
        if (sort === 'popular') {
            orderBy = 'p.like_count DESC, p.created_at DESC';
        } else if (sort === 'oldest') {
            orderBy = 'p.created_at ASC';
        } else if (sort === 'views') {
            orderBy = 'p.view_count DESC, p.created_at DESC';
        }

        const whereClause = `WHERE ${whereParts.join(' AND ')}`;

        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS total
             FROM photos p
             LEFT JOIN albums a ON a.id = p.album_id
             ${whereClause}`,
            params
        );

        const [rows] = await pool.query(
            `SELECT
                p.id,
                p.live_id,
                p.album_id,
                p.photographer_id,
                p.original_url,
                p.compressed_url,
                p.thumbnail_url,
                p.watermarked_url,
                p.title,
                p.description,
                p.tags,
                p.original_name,
                p.file_size,
                p.view_count,
                p.like_count,
                p.download_count,
                p.is_public,
                p.created_at,
                a.name AS album_name,
                u.nickname AS photographer_name
             FROM photos p
             LEFT JOIN albums a ON a.id = p.album_id
             LEFT JOIN users u ON u.id = p.photographer_id
             ${whereClause}
             ORDER BY ${orderBy}
             LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );

        res.json({
            code: 200,
            data: {
                photos: rows.map(mapPhotoListRow),
                total: countRows[0].total,
                page: pageNumber,
                limit: pageSize,
                pages: Math.max(1, Math.ceil(countRows[0].total / pageSize))
            }
        });
    } catch (error) {
        console.error('获取图片列表失败:', error);
        res.status(500).json({ code: 500, message: '获取图片列表失败' });
    }
});

router.get('/live/:liveId/filter-options', optionalAuth, async (req, res) => {
    try {
        const liveId = Number(req.params.liveId);
        const albumId = normalizeAlbumId(req.query.album_id);
        const live = await ensureLiveViewAccess(pool, req, liveId);
        if (!live.ok) {
            return res.status(live.status).json({ code: live.status, message: live.message });
        }

        const whereParts = ['live_id = ?', 'is_public = 1'];
        const params = [liveId];
        if (albumId) {
            whereParts.push('album_id = ?');
            params.push(albumId);
        }
        const whereSql = `WHERE ${whereParts.join(' AND ')}`;

        const [cameraRows, lensRows, focalRows, apertureRows, isoRows, formatRows] = await Promise.all([
            queryFilterValues('camera_search', whereSql, params, 8),
            queryFilterValues('lens_search', whereSql, params, 10),
            queryFilterValues('focal_length_search', whereSql, params, 8),
            queryFilterValues('aperture_search', whereSql, params, 8),
            queryFilterValues('iso_value', whereSql, params, 8),
            queryFilterValues('format_value', whereSql, params, 8)
        ]);

        const [albumRows] = await pool.query(
            `SELECT a.id, a.name, COUNT(p.id) AS total
             FROM albums a
             LEFT JOIN photos p
               ON p.album_id = a.id
              AND p.live_id = a.live_id
              AND p.is_public = 1
             WHERE a.live_id = ?
             GROUP BY a.id, a.name
             ORDER BY a.sort_order ASC, a.id ASC`,
            [liveId]
        );

        res.json({
            code: 200,
            data: {
                albums: albumRows.map((row) => ({
                    id: row.id,
                    label: row.name,
                    count: Number(row.total || 0)
                })),
                cameras: formatFilterRows(cameraRows, prettifyFilterLabel),
                lenses: formatFilterRows(lensRows, prettifyFilterLabel),
                focal_lengths: formatFilterRows(focalRows, prettifyFilterLabel),
                apertures: formatFilterRows(apertureRows, prettifyFilterLabel),
                iso_values: formatNumericFilterRows(isoRows, (value) => `ISO ${value}`),
                formats: formatFilterRows(formatRows, (value) => String(value).toUpperCase())
            }
        });
    } catch (error) {
        console.error('获取筛选项失败:', error);
        res.status(500).json({ code: 500, message: '获取筛选项失败' });
    }
});

router.get('/admin/live/:liveId', authenticateToken, requirePhotographer, async (req, res) => {
    try {
        await assertManageLive(pool, req.user, req.params.liveId);
        const liveId = Number(req.params.liveId);
        const {
            page = 1,
            limit = 120,
            album_id = 'all',
            visibility = 'all',
            sort = 'latest',
            keyword = '',
            camera = '',
            lens = '',
            focal_length = '',
            aperture = '',
            iso = '',
            format = ''
        } = req.query;

        const pageNumber = Math.max(1, Number(page) || 1);
        const pageSize = Math.min(Math.max(24, Number(limit) || 120), 240);
        const offset = (pageNumber - 1) * pageSize;

        const whereParts = ['p.live_id = ?'];
        const params = [liveId];

        if (album_id !== 'all') {
            whereParts.push('p.album_id = ?');
            params.push(Number(album_id));
        }
        if (visibility === 'public') {
            whereParts.push('p.is_public = 1');
        } else if (visibility === 'private') {
            whereParts.push('p.is_public = 0');
        }
        if (camera) {
            whereParts.push('p.camera_search = ?');
            params.push(normalizeSearchKeyword(camera));
        }
        if (lens) {
            whereParts.push('p.lens_search = ?');
            params.push(normalizeSearchKeyword(lens));
        }
        if (focal_length) {
            whereParts.push('p.focal_length_search = ?');
            params.push(normalizeSearchKeyword(focal_length));
        }
        if (aperture) {
            whereParts.push('p.aperture_search = ?');
            params.push(normalizeSearchKeyword(aperture));
        }
        const exactIso = parseIsoSearchValue(iso);
        if (exactIso) {
            whereParts.push('p.iso_value = ?');
            params.push(exactIso);
        }
        const exactFormat = parseFormatSearchValue(format);
        if (exactFormat) {
            whereParts.push('p.format_value = ?');
            params.push(exactFormat);
        }
        if (keyword) {
            const normalizedKeyword = `%${normalizeSearchKeyword(keyword)}%`;
            whereParts.push(`(
                p.search_text LIKE ?
                OR a.name LIKE ?
                OR p.original_name LIKE ?
                OR p.title LIKE ?
            )`);
            params.push(normalizedKeyword, normalizedKeyword, normalizedKeyword, normalizedKeyword);
        }

        let orderBy = 'p.created_at DESC';
        if (sort === 'oldest') {
            orderBy = 'p.created_at ASC';
        } else if (sort === 'popular') {
            orderBy = 'p.like_count DESC, p.created_at DESC';
        } else if (sort === 'views') {
            orderBy = 'p.view_count DESC, p.created_at DESC';
        }

        const whereClause = `WHERE ${whereParts.join(' AND ')}`;
        const [countRows] = await pool.query(
            `SELECT COUNT(*) AS total
             FROM photos p
             LEFT JOIN albums a ON a.id = p.album_id
             ${whereClause}`,
            params
        );

        const [rows] = await pool.query(
            `SELECT
                p.id,
                p.live_id,
                p.album_id,
                p.photographer_id,
                p.original_url,
                p.compressed_url,
                p.thumbnail_url,
                p.watermarked_url,
                p.title,
                p.tags,
                p.original_name,
                p.file_size,
                p.view_count,
                p.like_count,
                p.download_count,
                p.is_public,
                p.created_at,
                p.width,
                p.height,
                p.camera_search,
                p.lens_search,
                p.focal_length_search,
                p.aperture_search,
                p.shutter_speed_search,
                p.iso_value,
                p.format_value,
                a.name AS album_name,
                u.nickname AS photographer_name
             FROM photos p
             LEFT JOIN albums a ON a.id = p.album_id
             LEFT JOIN users u ON u.id = p.photographer_id
             ${whereClause}
             ORDER BY ${orderBy}
             LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
        );

        res.json({
            code: 200,
            data: {
                photos: rows.map(mapPhotoListRow),
                total: countRows[0].total,
                page: pageNumber,
                limit: pageSize,
                pages: Math.max(1, Math.ceil(countRows[0].total / pageSize))
            }
        });
    } catch (error) {
        console.error('获取后台图片列表失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '获取后台图片列表失败' });
    }
});

router.get('/admin/:id', authenticateToken, requirePhotographer, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT p.*, a.name AS album_name, u.nickname AS photographer_name
             FROM photos p
             LEFT JOIN albums a ON a.id = p.album_id
             LEFT JOIN users u ON u.id = p.photographer_id
             WHERE p.id = ?
             LIMIT 1`,
            [req.params.id]
        );

        const row = rows[0];
        if (!row) {
            return res.status(404).json({ code: 404, message: '图片不存在' });
        }

        await assertManageLive(pool, req.user, row.live_id);
        res.json({ code: 200, data: mapPhotoRow(row) });
    } catch (error) {
        console.error('获取后台图片详情失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '获取后台图片详情失败' });
    }
});

router.post('/admin/live/:liveId/download-jobs', authenticateToken, requirePhotographer, async (req, res) => {
    try {
        const liveId = Number(req.params.liveId);
        await assertManageLive(pool, req.user, liveId);
        const ids = normalizeIdCollection(req.body.ids);
        const albumId = normalizeAlbumId(req.body.album_id);
        const live = await getLiveById(pool, liveId);
        if (!live) {
            return res.status(404).json({ code: 404, message: '直播不存在' });
        }

        const photos = await getPhotosForArchive({
            executor: pool,
            liveId,
            ids,
            albumId,
            onlyPublic: false,
            preferredUrlField: 'original_url'
        });

        if (!photos.length) {
            return res.status(404).json({ code: 404, message: '没有可下载的照片' });
        }

        const job = await createDownloadJob({
            executor: pool,
            scope: 'admin',
            requesterUserId: req.user.id,
            live,
            liveId,
            albumId,
            ids,
            photos,
            preferredUrlField: 'original_url',
            fileName: `${safeFileName(live.slug || live.title || `live-${liveId}`)}-admin.zip`
        });

        logActivity(pool, {
            liveId,
            user: req.user,
            action: 'photo.download.batch.admin.prepare',
            targetType: 'photo',
            targetId: ids.length ? ids.join(',') : null,
            detail: { count: photos.length, albumId, jobId: job.id || null }
        }).catch(() => {});

        res.status(job.status === 'ready' ? 200 : 202).json({ code: 200, data: serializeDownloadJob(job) });
    } catch (error) {
        console.error('后台创建打包任务失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '创建打包任务失败' });
    }
});

router.get('/admin/live/:liveId/download-jobs/:jobId', authenticateToken, requirePhotographer, async (req, res) => {
    try {
        await assertManageLive(pool, req.user, req.params.liveId);
        const job = await getDownloadJobById(pool, Number(req.params.jobId), Number(req.params.liveId), 'admin');
        if (!job) {
            return res.status(404).json({ code: 404, message: '打包任务不存在' });
        }

        const nextJob = await refreshDownloadJob(pool, job);
        res.json({ code: 200, data: serializeDownloadJob(nextJob) });
    } catch (error) {
        console.error('后台查询打包任务失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '查询打包任务失败' });
    }
});

router.post('/live/:liveId/download-jobs', optionalAuth, async (req, res) => {
    try {
        const liveId = Number(req.params.liveId);
        const liveAccess = await ensureLiveViewAccess(pool, req, liveId);
        if (!liveAccess.ok) {
            return res.status(liveAccess.status).json({ code: liveAccess.status, message: liveAccess.message });
        }

        const live = liveAccess.live;
        if (!Number(live.allow_batch_download)) {
            return res.status(403).json({ code: 403, message: '当前直播未开启批量下载' });
        }

        const ids = normalizeIdCollection(req.body.ids);
        const albumId = normalizeAlbumId(req.body.album_id);
        const preferredUrlField = 'original_url';

        const photos = await getPhotosForArchive({
            executor: pool,
            liveId,
            ids,
            albumId,
            onlyPublic: true,
            preferredUrlField
        });

        if (!photos.length) {
            return res.status(404).json({ code: 404, message: '没有可下载的照片' });
        }

        const suffix = ids.length ? 'selected' : albumId ? `album-${albumId}` : 'all';
        const job = await createDownloadJob({
            executor: pool,
            scope: 'viewer',
            requesterUserId: req.user?.id || null,
            live,
            liveId,
            albumId,
            ids,
            photos,
            preferredUrlField,
            fileName: `${safeFileName(live.slug || live.title || `live-${liveId}`)}-${suffix}.zip`
        });

        logActivity(pool, {
            liveId,
            user: req.user,
            action: 'photo.download.batch.viewer.prepare',
            targetType: 'photo',
            targetId: ids.length ? ids.join(',') : null,
            detail: { count: photos.length, albumId, preferredUrlField, jobId: job.id || null }
        }).catch(() => {});

        res.status(job.status === 'ready' ? 200 : 202).json({ code: 200, data: serializeDownloadJob(job) });
    } catch (error) {
        console.error('客户创建打包任务失败:', error);
        res.status(500).json({ code: 500, message: error.message || '创建打包任务失败' });
    }
});

router.get('/live/:liveId/download-jobs/:jobId', optionalAuth, async (req, res) => {
    try {
        const liveId = Number(req.params.liveId);
        const liveAccess = await ensureLiveViewAccess(pool, req, liveId);
        if (!liveAccess.ok) {
            return res.status(liveAccess.status).json({ code: liveAccess.status, message: liveAccess.message });
        }

        const job = await getDownloadJobById(pool, Number(req.params.jobId), liveId, 'viewer');
        if (!job) {
            return res.status(404).json({ code: 404, message: '打包任务不存在' });
        }

        const nextJob = await refreshDownloadJob(pool, job);
        res.json({ code: 200, data: serializeDownloadJob(nextJob) });
    } catch (error) {
        console.error('客户查询打包任务失败:', error);
        res.status(500).json({ code: 500, message: error.message || '查询打包任务失败' });
    }
});

router.get('/admin/live/:liveId/download', authenticateToken, requirePhotographer, async (req, res) => {
    try {
        const liveId = Number(req.params.liveId);
        const ids = parseIdList(req.query.ids);
        const albumId = req.query.album_id && req.query.album_id !== 'all' ? Number(req.query.album_id) : null;
        const live = await getLiveById(pool, liveId);
        if (!live) {
            return res.status(404).json({ code: 404, message: '直播不存在' });
        }

        const photos = await getPhotosForArchive({
            executor: pool,
            liveId,
            ids,
            albumId,
            onlyPublic: false,
            preferredUrlField: 'original_url'
        });

        if (!photos.length) {
            return res.status(404).json({ code: 404, message: '没有可下载的照片' });
        }

        await streamPhotoArchive({
            req,
            res,
            photos,
            fileName: `${safeFileName(live.slug || live.title || `live-${liveId}`)}-admin.zip`
        });

        logActivity(pool, {
            liveId,
            user: req.user,
            action: 'photo.download.batch.admin',
            targetType: 'photo',
            targetId: ids.length ? ids.join(',') : null,
            detail: { count: photos.length, albumId }
        }).catch(() => {});
    } catch (error) {
        console.error('后台批量打包失败:', error);
        if (!res.headersSent) {
            res.status(500).json({ code: 500, message: error.message || '批量打包失败' });
        }
    }
});

router.get('/live/:liveId/download', optionalAuth, async (req, res) => {
    try {
        const liveId = Number(req.params.liveId);
        const liveAccess = await ensureLiveViewAccess(pool, req, liveId);
        if (!liveAccess.ok) {
            return res.status(liveAccess.status).json({ code: liveAccess.status, message: liveAccess.message });
        }

        const live = liveAccess.live;
        if (!Number(live.allow_batch_download)) {
            return res.status(403).json({ code: 403, message: '当前直播未开启批量下载' });
        }

        const ids = parseIdList(req.query.ids);
        const albumId = req.query.album_id && req.query.album_id !== 'all' ? Number(req.query.album_id) : null;
        const preferredUrlField = 'original_url';

        const photos = await getPhotosForArchive({
            executor: pool,
            liveId,
            ids,
            albumId,
            onlyPublic: true,
            preferredUrlField
        });

        if (!photos.length) {
            return res.status(404).json({ code: 404, message: '没有可下载的照片' });
        }

        await streamPhotoArchive({
            req,
            res,
            photos,
            fileName: `${safeFileName(live.slug || live.title || `live-${liveId}`)}.zip`
        });

        logActivity(pool, {
            liveId,
            user: req.user,
            action: 'photo.download.batch.viewer',
            targetType: 'photo',
            targetId: ids.length ? ids.join(',') : null,
            detail: { count: photos.length, albumId, preferredUrlField }
        }).catch(() => {});
    } catch (error) {
        console.error('客户批量打包失败:', error);
        if (!res.headersSent) {
            res.status(500).json({ code: 500, message: error.message || '批量打包失败' });
        }
    }
});

router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT p.*, a.name AS album_name, u.nickname AS photographer_name,
                    l.id AS live_id, l.access_code
             FROM photos p
             LEFT JOIN albums a ON a.id = p.album_id
             LEFT JOIN users u ON u.id = p.photographer_id
             LEFT JOIN lives l ON l.id = p.live_id
             WHERE p.id = ?
             LIMIT 1`,
            [req.params.id]
        );

        const row = rows[0];
        if (!row) {
            return res.status(404).json({ code: 404, message: '图片不存在' });
        }

        const privileged = Boolean(req.user && ['admin', 'photographer'].includes(req.user.role));
        if (!privileged && Number(row.is_public) !== 1) {
            return res.status(404).json({ code: 404, message: '图片不存在' });
        }

        const liveAccess = await ensureLiveViewAccess(pool, req, Number(row.live_id));
        if (!liveAccess.ok) {
            return res.status(liveAccess.status).json({ code: liveAccess.status, message: liveAccess.message });
        }

        await pool.query('UPDATE photos SET view_count = view_count + 1 WHERE id = ?', [req.params.id]);
        await recordViewerEvent(pool, {
            req,
            liveId: Number(row.live_id),
            photoId: Number(row.id),
            eventType: 'photo_view'
        });
        res.json({ code: 200, data: mapPhotoRow({ ...row, view_count: Number(row.view_count || 0) + 1 }) });
    } catch (error) {
        console.error('获取图片详情失败:', error);
        res.status(500).json({ code: 500, message: '获取图片详情失败' });
    }
});

router.post('/direct-upload/prepare', authenticateToken, requirePhotographer, async (req, res) => {
    try {
        if (!qiniuEnabled) {
            return res.status(409).json({ code: 409, message: '当前未启用七牛直传，请先完成七牛配置' });
        }

        const liveId = Number(req.body.live_id);
        const requestFiles = Array.isArray(req.body.files) ? req.body.files : [];
        if (requestFiles.length > DIRECT_UPLOAD_PREPARE_LIMIT) {
            return res.status(400).json({
                code: 400,
                message: `单次直传准备最多支持 ${DIRECT_UPLOAD_PREPARE_LIMIT} 张照片，请分批上传`
            });
        }
        const files = requestFiles;
        const titlePrefix = String(req.body.title_prefix || '').trim();

        if (!liveId) {
            return res.status(400).json({ code: 400, message: '缺少 live_id 参数' });
        }

        await assertManageLive(pool, req.user, liveId);

        if (!files.length) {
            return res.status(400).json({ code: 400, message: '请选择图片文件' });
        }

        const oversizedFile = files.find((file) => Number(file.size || 0) > maxPhotoUploadSize);
        if (oversizedFile) {
            return res.status(400).json({
                code: 400,
                message: `照片“${oversizedFile.name}”超过 25MB，已拒绝上传`
            });
        }

        const [liveRows] = await pool.query(
            `SELECT id, title, watermark_text, require_photo_review
             FROM lives
             WHERE id = ?
             LIMIT 1`,
            [liveId]
        );
        const live = liveRows[0];
        if (!live) {
            return res.status(404).json({ code: 404, message: '直播不存在' });
        }

        const uploadHost = getQiniuUploadHost();
        const normalizedHashes = files.map((file) => normalizeFileHash(file.file_hash));
        const existingHashes = await findExistingHashes(pool, liveId, normalizedHashes);
        const reusablePhotos = await findReusablePhotosByHashes(pool, normalizedHashes);
        const seenHashes = new Set();

        const preparedFiles = files.map((file, index) => {
            const fileHash = normalizeFileHash(file.file_hash);
            const duplicateInBatch = fileHash && seenHashes.has(fileHash);
            if (fileHash) {
                seenHashes.add(fileHash);
            }
            if (duplicateInBatch || (fileHash && existingHashes.has(fileHash))) {
                return {
                    skipped: true,
                    file_hash: fileHash,
                    message: '重复照片，已跳过'
                };
            }

            const reusablePhoto = fileHash ? reusablePhotos.get(fileHash) : null;
            if (reusablePhoto) {
                return {
                    reused: true,
                    title: buildUploadedPhotoTitle({
                        titlePrefix,
                        index,
                        originalName: file.name
                    }),
                    file_hash: fileHash,
                    message: '云端已有同内容文件，将直接秒传'
                };
            }

            const ext = pickUploadExtension(file.name, file.type);
            const key = `${liveId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${index}${ext}`;
            const title = titlePrefix || stripFileExtension(file.name)
                ? buildUploadedPhotoTitle({
                    titlePrefix,
                    index,
                    originalName: file.name
                })
                : '';

            return {
                key,
                token: createQiniuUploadToken(key),
                upload_url: uploadHost,
                title,
                file_hash: fileHash
            };
        });

        res.json({
            code: 200,
            data: {
                upload_url: uploadHost,
                is_public: Number(live.require_photo_review) ? 0 : 1,
                files: preparedFiles
            }
        });
    } catch (error) {
        console.error('获取七牛直传配置失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '获取七牛直传配置失败' });
    }
});

router.post('/direct-upload/complete', authenticateToken, requirePhotographer, async (req, res) => {
    const connection = await pool.getConnection();
    const uploadedOriginalUrls = [];
    const hydrationQueue = [];

    try {
        if (!qiniuEnabled) {
            return res.status(409).json({ code: 409, message: '当前未启用七牛直传，请先完成七牛配置' });
        }

        const liveId = Number(req.body.live_id);
        const albumId = req.body.album_id ? Number(req.body.album_id) : null;
        const titlePrefix = String(req.body.title_prefix || '').trim();
        const tags = parseTags(req.body.tags);
        const files = normalizeDirectFiles(req.body.files);

        if (!liveId) {
            return res.status(400).json({ code: 400, message: '缺少 live_id 参数' });
        }

        await assertManageLive(connection, req.user, liveId);

        if (!files.length) {
            return res.status(400).json({ code: 400, message: '没有可登记的上传文件' });
        }

        const [liveRows] = await connection.query(
            `SELECT id, title, slug, watermark_enabled, watermark_text, require_photo_review
             FROM lives
             WHERE id = ?
             LIMIT 1`,
            [liveId]
        );
        const live = liveRows[0];
        if (!live) {
            return res.status(404).json({ code: 404, message: '直播不存在' });
        }

        await connection.beginTransaction();

        const results = [];
        const skipped = [];
        const nextIsPublic = Number(live.require_photo_review) ? 0 : 1;
        const batchHashes = new Set();
        let reusedCount = 0;

        for (const [index, file] of files.entries()) {
            const fileHash = normalizeFileHash(file.file_hash);
            const duplicateInBatch = fileHash && batchHashes.has(fileHash);
            if (fileHash) {
                batchHashes.add(fileHash);
            }
            const existingPhoto = fileHash
                ? await findExistingPhotoByHash(connection, liveId, fileHash)
                : null;
            if (duplicateInBatch || existingPhoto) {
                if (file.key) {
                    const duplicateUrls = buildQiniuImageUrls(file.key, {
                        watermarkText: live.watermark_text || live.title,
                        watermarkEnabled: Boolean(live.watermark_enabled)
                    });
                    await deleteByUrl(duplicateUrls.originalUrl);
                }
                skipped.push({
                    client_ref: file.client_ref || '',
                    original_name: file.original_name,
                    file_hash: fileHash,
                    reason: 'duplicate'
                });
                continue;
            }

            const title = String(file.title || buildUploadedPhotoTitle({
                titlePrefix,
                index,
                originalName: file.original_name
            })).trim();

            const reusablePhoto = !file.key && fileHash
                ? await findReusablePhotoByHash(connection, fileHash)
                : null;

            if (!file.key && reusablePhoto) {
                const metadata = normalizeExifData(reusablePhoto.exif_data, {
                    source: 'qiniu-reuse',
                    reused_from_photo_id: reusablePhoto.id
                });
                const searchFields = buildPhotoSearchFields({
                    title,
                    description: '',
                    tags,
                    originalName: String(file.original_name || reusablePhoto.original_name || '').trim(),
                    exifData: metadata
                });
                const [insertResult] = await connection.query(
                    `INSERT INTO photos
                    (live_id, album_id, photographer_id, original_url, compressed_url, thumbnail_url, watermarked_url,
                     title, description, tags, exif_data, width, height, file_size, file_hash, original_name, is_public,
                     camera_search, lens_search, focal_length_search, aperture_search, shutter_speed_search, iso_value, format_value, search_text)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        liveId,
                        albumId,
                        req.user.id,
                        reusablePhoto.original_url,
                        reusablePhoto.compressed_url,
                        reusablePhoto.thumbnail_url,
                        reusablePhoto.watermarked_url,
                        title,
                        '',
                        JSON.stringify(tags),
                        JSON.stringify(metadata),
                        toPositiveInt(file.width) || toPositiveInt(reusablePhoto.width) || 0,
                        toPositiveInt(file.height) || toPositiveInt(reusablePhoto.height) || 0,
                        toPositiveInt(file.file_size || reusablePhoto.file_size) || 0,
                        fileHash || null,
                        String(file.original_name || reusablePhoto.original_name || '').trim(),
                        nextIsPublic,
                        searchFields.camera_search,
                        searchFields.lens_search,
                        searchFields.focal_length_search,
                        searchFields.aperture_search,
                        searchFields.shutter_speed_search,
                        searchFields.iso_value,
                        searchFields.format_value,
                        searchFields.search_text
                    ]
                );

                reusedCount += 1;
                results.push({
                    client_ref: file.client_ref || '',
                    id: insertResult.insertId,
                    title: title || stripFileExtension(file.original_name) || `照片 ${index + 1}`,
                    thumbnail_url: reusablePhoto.thumbnail_url,
                    watermarked_url: reusablePhoto.watermarked_url,
                    compressed_url: reusablePhoto.compressed_url,
                    original_url: reusablePhoto.original_url,
                    original_name: String(file.original_name || reusablePhoto.original_name || '').trim(),
                    is_public: nextIsPublic
                });
                continue;
            }

            if (!file.key) {
                skipped.push({
                    client_ref: file.client_ref || '',
                    original_name: file.original_name,
                    file_hash: fileHash,
                    reason: 'invalid'
                });
                continue;
            }

            const urls = buildQiniuImageUrls(file.key, {
                watermarkText: live.watermark_text || live.title,
                watermarkEnabled: Boolean(live.watermark_enabled)
            });
            uploadedOriginalUrls.push(urls.originalUrl);

            const width = toPositiveInt(file.width);
            const height = toPositiveInt(file.height);
            const fileSize = toPositiveInt(file.file_size || file.size);
            const metadata = {
                width,
                height,
                format: inferFormat(file.original_name),
                source: 'qiniu-direct-pending'
            };
            const searchFields = buildPhotoSearchFields({
                title,
                description: '',
                tags,
                originalName: String(file.original_name || '').trim(),
                exifData: metadata
            });

            const [insertResult] = await connection.query(
                `INSERT INTO photos
                (live_id, album_id, photographer_id, original_url, compressed_url, thumbnail_url, watermarked_url,
                 title, description, tags, exif_data, width, height, file_size, file_hash, original_name, is_public,
                 camera_search, lens_search, focal_length_search, aperture_search, shutter_speed_search, iso_value, format_value, search_text)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    liveId,
                    albumId,
                    req.user.id,
                    urls.originalUrl,
                    urls.compressedUrl,
                    urls.thumbnailUrl,
                    urls.watermarkedUrl,
                    title,
                    '',
                    JSON.stringify(tags),
                    JSON.stringify(metadata),
                    width,
                    height,
                    fileSize,
                    fileHash || null,
                    String(file.original_name || '').trim(),
                    nextIsPublic,
                    searchFields.camera_search,
                    searchFields.lens_search,
                    searchFields.focal_length_search,
                    searchFields.aperture_search,
                    searchFields.shutter_speed_search,
                    searchFields.iso_value,
                    searchFields.format_value,
                    searchFields.search_text
                ]
            );

            results.push({
                client_ref: file.client_ref || '',
                id: insertResult.insertId,
                title: title || stripFileExtension(file.original_name) || `照片 ${index + 1}`,
                thumbnail_url: urls.thumbnailUrl,
                watermarked_url: urls.watermarkedUrl,
                compressed_url: urls.compressedUrl,
                original_url: urls.originalUrl,
                original_name: String(file.original_name || '').trim(),
                is_public: nextIsPublic
            });

            hydrationQueue.push({
                id: insertResult.insertId,
                original_url: urls.originalUrl,
                original_name: String(file.original_name || '').trim(),
                width,
                height,
                title,
                tags
            });
        }

        if (albumId) {
            await connection.query(
                'UPDATE albums SET photo_count = photo_count + ? WHERE id = ?',
                [results.length, albumId]
            );
        }

        await logActivity(connection, {
            liveId,
            user: req.user,
            action: 'photo.upload.batch.direct',
            targetType: 'photo',
            targetId: results.map((item) => item.id).join(','),
            detail: {
                count: results.length,
                albumId,
                reviewRequired: Boolean(Number(live.require_photo_review)),
                storageMode: 'qiniu-direct'
            }
        });

        await connection.commit();

        const io = req.app.get('io');
        results.slice(0, 6).forEach((photo) => {
            io.to(`live-${liveId}`).emit('photo-uploaded', photo);
        });

        res.status(201).json({
            code: 200,
            message: buildUploadResultMessage({
                uploadedCount: results.length,
                reusedCount,
                skippedCount: skipped.length,
                reviewRequired: Boolean(Number(live.require_photo_review))
            }),
            data: {
                uploaded: results,
                skipped
            }
        });

        scheduleQiniuMetadataHydration(hydrationQueue);
    } catch (error) {
        await connection.rollback();
        await Promise.allSettled(uploadedOriginalUrls.map((url) => deleteByUrl(url)));
        console.error('七牛直传登记失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: `七牛直传登记失败: ${error.message}` });
    } finally {
        connection.release();
    }
});

function scheduleQiniuMetadataHydration(records) {
    if (!Array.isArray(records) || !records.length) {
        return;
    }

    setImmediate(async () => {
        const concurrency = 3;
        let cursor = 0;
        const workers = Array.from({ length: Math.min(concurrency, records.length) }).map(async () => {
            while (cursor < records.length) {
                const index = cursor;
                cursor += 1;
                const record = records[index];
                try {
                    const remoteMetadata = await readRemoteImageMetadata(record.original_url);
                    const metadata = {
                        ...remoteMetadata,
                        width: remoteMetadata.width || record.width,
                        height: remoteMetadata.height || record.height,
                        format: remoteMetadata.format || inferFormat(record.original_name),
                        source: 'qiniu-direct'
                    };
                    const searchFields = buildPhotoSearchFields({
                        title: record.title,
                        description: '',
                        tags: record.tags,
                        originalName: record.original_name,
                        exifData: metadata
                    });

                    await pool.query(
                        `UPDATE photos
                         SET exif_data = ?,
                             width = ?,
                             height = ?,
                             camera_search = ?,
                             lens_search = ?,
                             focal_length_search = ?,
                             aperture_search = ?,
                             shutter_speed_search = ?,
                             iso_value = ?,
                             format_value = ?,
                             search_text = ?
                         WHERE id = ?`,
                        [
                            JSON.stringify(metadata),
                            metadata.width || 0,
                            metadata.height || 0,
                            searchFields.camera_search,
                            searchFields.lens_search,
                            searchFields.focal_length_search,
                            searchFields.aperture_search,
                            searchFields.shutter_speed_search,
                            searchFields.iso_value,
                            searchFields.format_value,
                            searchFields.search_text,
                            record.id
                        ]
                    );
                } catch (error) {
                    console.warn('后台异步补全直传图片元数据失败:', record.original_url, error.message);
                }
            }
        });

        await Promise.allSettled(workers);
    });
}

router.post('/upload-batch', authenticateToken, requirePhotographer, upload.array('images', SERVER_UPLOAD_BATCH_LIMIT), async (req, res) => {
    if (!req.files?.length) {
        return res.status(400).json({ code: 400, message: '请选择图片文件' });
    }

    const connection = await pool.getConnection();

    try {
        const liveId = Number(req.body.live_id);
        const albumId = req.body.album_id ? Number(req.body.album_id) : null;
        const titlePrefix = req.body.title_prefix || '';
        const tags = parseTags(req.body.tags);

        if (!liveId) {
            return res.status(400).json({ code: 400, message: '缺少 live_id 参数' });
        }

        await assertManageLive(connection, req.user, liveId);

        const [liveRows] = await connection.query(
            `SELECT id, title, slug, watermark_enabled, watermark_text, require_photo_review
             FROM lives
             WHERE id = ?
             LIMIT 1`,
            [liveId]
        );
        const live = liveRows[0];
        if (!live) {
            return res.status(404).json({ code: 404, message: '直播不存在' });
        }

        await connection.beginTransaction();

        const results = [];
        const skipped = [];
        const nextIsPublic = Number(live.require_photo_review) ? 0 : 1;
        const batchHashes = new Set();
        let reusedCount = 0;

        for (const [index, file] of req.files.entries()) {
            const fileHash = await hashLocalFile(file.path);
            const duplicateInBatch = fileHash && batchHashes.has(fileHash);
            if (fileHash) {
                batchHashes.add(fileHash);
            }
            const existingPhoto = fileHash
                ? await findExistingPhotoByHash(connection, liveId, fileHash)
                : null;
            if (duplicateInBatch || existingPhoto) {
                skipped.push({
                    original_name: file.originalname,
                    file_hash: fileHash,
                    reason: 'duplicate'
                });
                deleteTempFile(file.path);
                continue;
            }

            const reusablePhoto = fileHash
                ? await findReusablePhotoByHash(connection, fileHash)
                : null;
            if (reusablePhoto) {
                const title = titlePrefix ? `${titlePrefix} ${index + 1}` : '';
                const metadata = normalizeExifData(reusablePhoto.exif_data, {
                    source: 'storage-reuse',
                    reused_from_photo_id: reusablePhoto.id
                });
                const searchFields = buildPhotoSearchFields({
                    title,
                    description: '',
                    tags,
                    originalName: String(file.originalname || reusablePhoto.original_name || '').trim(),
                    exifData: metadata
                });
                const [insertResult] = await connection.query(
                    `INSERT INTO photos
                    (live_id, album_id, photographer_id, original_url, compressed_url, thumbnail_url, watermarked_url,
                     title, description, tags, exif_data, width, height, file_size, file_hash, original_name, is_public,
                     camera_search, lens_search, focal_length_search, aperture_search, shutter_speed_search, iso_value, format_value, search_text)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        liveId,
                        albumId,
                        req.user.id,
                        reusablePhoto.original_url,
                        reusablePhoto.compressed_url,
                        reusablePhoto.thumbnail_url,
                        reusablePhoto.watermarked_url,
                        title,
                        '',
                        JSON.stringify(tags),
                        JSON.stringify(metadata),
                        toPositiveInt(reusablePhoto.width) || 0,
                        toPositiveInt(reusablePhoto.height) || 0,
                        toPositiveInt(file.size || reusablePhoto.file_size) || 0,
                        fileHash || null,
                        String(file.originalname || reusablePhoto.original_name || '').trim(),
                        nextIsPublic,
                        searchFields.camera_search,
                        searchFields.lens_search,
                        searchFields.focal_length_search,
                        searchFields.aperture_search,
                        searchFields.shutter_speed_search,
                        searchFields.iso_value,
                        searchFields.format_value,
                        searchFields.search_text
                    ]
                );

                reusedCount += 1;
                results.push({
                    id: insertResult.insertId,
                    title: title || file.originalname,
                    thumbnail_url: reusablePhoto.thumbnail_url,
                    watermarked_url: reusablePhoto.watermarked_url,
                    original_name: String(file.originalname || reusablePhoto.original_name || '').trim(),
                    is_public: nextIsPublic
                });

                deleteTempFile(file.path);
                continue;
            }

            const variants = await buildImageVariants(file.path, {
                watermarkEnabled: Boolean(live.watermark_enabled),
                watermarkText: live.watermark_text || live.title
            });
            const photoMetadata = {
                ...variants.metadata,
                source: 'server-upload'
            };

            const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
            const keyBase = `${liveId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

            const original = await uploadBuffer(`${keyBase}-original${ext}`, variants.originalBuffer);
            const compressed = await uploadBuffer(`${keyBase}-compressed.webp`, variants.compressedBuffer);
            const thumbnail = await uploadBuffer(`${keyBase}-thumb.webp`, variants.thumbnailBuffer);
            const watermarked = await uploadBuffer(`${keyBase}-watermark.webp`, variants.watermarkedBuffer);

            const title = titlePrefix ? `${titlePrefix} ${index + 1}` : '';
            const searchFields = buildPhotoSearchFields({
                title,
                description: '',
                tags,
                originalName: String(file.originalname || '').trim(),
                exifData: photoMetadata
            });
            const [insertResult] = await connection.query(
                `INSERT INTO photos
                (live_id, album_id, photographer_id, original_url, compressed_url, thumbnail_url, watermarked_url,
                 title, description, tags, exif_data, width, height, file_size, file_hash, original_name, is_public,
                 camera_search, lens_search, focal_length_search, aperture_search, shutter_speed_search, iso_value, format_value, search_text)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    liveId,
                    albumId,
                    req.user.id,
                    original.url,
                    compressed.url,
                    thumbnail.url,
                    watermarked.url,
                    title,
                    '',
                    JSON.stringify(tags),
                    JSON.stringify(photoMetadata),
                    photoMetadata.width,
                    photoMetadata.height,
                    file.size,
                    fileHash || null,
                    String(file.originalname || '').trim(),
                    nextIsPublic,
                    searchFields.camera_search,
                    searchFields.lens_search,
                    searchFields.focal_length_search,
                    searchFields.aperture_search,
                    searchFields.shutter_speed_search,
                    searchFields.iso_value,
                    searchFields.format_value,
                    searchFields.search_text
                ]
            );

            results.push({
                id: insertResult.insertId,
                title: title || file.originalname,
                thumbnail_url: thumbnail.url,
                watermarked_url: watermarked.url,
                original_name: String(file.originalname || '').trim(),
                is_public: nextIsPublic
            });

            deleteTempFile(file.path);
        }

        if (albumId) {
            await connection.query(
                'UPDATE albums SET photo_count = photo_count + ? WHERE id = ?',
                [results.length, albumId]
            );
        }

        await logActivity(connection, {
            liveId,
            user: req.user,
            action: 'photo.upload.batch',
            targetType: 'photo',
            targetId: results.map((item) => item.id).join(','),
            detail: {
                count: results.length,
                albumId,
                reviewRequired: Boolean(Number(live.require_photo_review))
            }
        });

        await connection.commit();

        const io = req.app.get('io');
        results.slice(0, 6).forEach((photo) => {
            io.to(`live-${liveId}`).emit('photo-uploaded', photo);
        });

        res.status(201).json({
            code: 200,
            message: buildUploadResultMessage({
                uploadedCount: results.length,
                reusedCount,
                skippedCount: skipped.length,
                reviewRequired: Boolean(Number(live.require_photo_review))
            }),
            data: {
                uploaded: results,
                skipped
            }
        });
    } catch (error) {
        await connection.rollback();
        req.files?.forEach((file) => deleteTempFile(file.path));
        console.error('批量上传失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: `批量上传失败: ${error.message}` });
    } finally {
        connection.release();
    }
});

router.put('/:id', authenticateToken, requirePhotographer, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const photoId = Number(req.params.id);
        const [rows] = await connection.query('SELECT * FROM photos WHERE id = ? LIMIT 1', [photoId]);
        const current = rows[0];
        if (!current) {
            return res.status(404).json({ code: 404, message: '图片不存在' });
        }

        const {
            title = '',
            description = '',
            tags = [],
            album_id = null,
            is_public = 1
        } = req.body;
        const normalizedTags = parseTags(tags);
        const searchFields = buildPhotoSearchFields({
            title,
            description,
            tags: normalizedTags,
            originalName: current.original_name,
            exifData: current.exif_data
        });

        await connection.beginTransaction();
        await connection.query(
            `UPDATE photos
             SET title = ?, description = ?, tags = ?, album_id = ?, is_public = ?,
                 camera_search = ?, lens_search = ?, focal_length_search = ?, aperture_search = ?,
                 shutter_speed_search = ?, iso_value = ?, format_value = ?, search_text = ?
             WHERE id = ?`,
            [
                title,
                description,
                JSON.stringify(normalizedTags),
                album_id || null,
                Number(Boolean(Number(is_public))),
                searchFields.camera_search,
                searchFields.lens_search,
                searchFields.focal_length_search,
                searchFields.aperture_search,
                searchFields.shutter_speed_search,
                searchFields.iso_value,
                searchFields.format_value,
                searchFields.search_text,
                photoId
            ]
        );

        if (Number(current.album_id || 0) !== Number(album_id || 0)) {
            if (current.album_id) {
                await connection.query(
                    'UPDATE albums SET photo_count = GREATEST(photo_count - 1, 0) WHERE id = ?',
                    [current.album_id]
                );
            }

            if (album_id) {
                await connection.query(
                    'UPDATE albums SET photo_count = photo_count + 1 WHERE id = ?',
                    [album_id]
                );
            }
        }

        await logActivity(connection, {
            liveId: current.live_id,
            user: req.user,
            action: 'photo.update',
            targetType: 'photo',
            targetId: String(photoId),
            detail: {
                title,
                albumId: album_id || null,
                isPublic: Number(Boolean(Number(is_public)))
            }
        });

        await connection.commit();
        res.json({ code: 200, message: '图片信息已更新' });
    } catch (error) {
        await connection.rollback();
        console.error('更新图片失败:', error);
        res.status(500).json({ code: 500, message: '更新图片失败' });
    } finally {
        connection.release();
    }
});

router.post('/batch-update', authenticateToken, requirePhotographer, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const ids = normalizeIdCollection(req.body.ids).slice(0, 500);
        const hasAlbumUpdate = Object.prototype.hasOwnProperty.call(req.body, 'album_id');
        const hasVisibilityUpdate = Object.prototype.hasOwnProperty.call(req.body, 'is_public');
        const appendTags = parseTags(req.body.append_tags);

        if (!ids.length) {
            return res.status(400).json({ code: 400, message: '请先选择要批量处理的照片' });
        }

        if (!hasAlbumUpdate && !hasVisibilityUpdate && !appendTags.length) {
            return res.status(400).json({ code: 400, message: '没有可执行的批量更新内容' });
        }

        const [rows] = await connection.query(
            `SELECT * FROM photos WHERE id IN (${ids.map(() => '?').join(',')})`,
            ids
        );
        if (!rows.length) {
            return res.status(404).json({ code: 404, message: '图片不存在' });
        }

        const unauthorized = rows.find((photo) => req.user.role !== 'admin' && photo.photographer_id !== req.user.id);
        if (unauthorized) {
            return res.status(403).json({ code: 403, message: '包含无权限处理的图片' });
        }

        await connection.beginTransaction();

        const nextAlbumId = hasAlbumUpdate ? normalizeAlbumId(req.body.album_id) : null;
        const nextVisibility = hasVisibilityUpdate ? Number(Boolean(Number(req.body.is_public))) : null;
        const oldAlbumCounts = new Map();
        const newAlbumCounts = new Map();

        for (const photo of rows) {
            const tags = appendTags.length
                ? Array.from(new Set([...(typeof photo.tags === 'string' ? safeJsonParse(photo.tags, []) : (photo.tags || [])), ...appendTags]))
                : (typeof photo.tags === 'string' ? safeJsonParse(photo.tags, []) : (photo.tags || []));
            const albumId = hasAlbumUpdate ? nextAlbumId : (photo.album_id || null);
            const isPublic = hasVisibilityUpdate ? nextVisibility : Number(photo.is_public ?? 1);
            const searchFields = buildPhotoSearchFields({
                title: photo.title || '',
                description: photo.description || '',
                tags,
                originalName: photo.original_name,
                exifData: photo.exif_data
            });

            await connection.query(
                `UPDATE photos
                 SET album_id = ?, is_public = ?, tags = ?,
                     camera_search = ?, lens_search = ?, focal_length_search = ?, aperture_search = ?,
                     shutter_speed_search = ?, iso_value = ?, format_value = ?, search_text = ?
                 WHERE id = ?`,
                [
                    albumId,
                    isPublic,
                    JSON.stringify(tags),
                    searchFields.camera_search,
                    searchFields.lens_search,
                    searchFields.focal_length_search,
                    searchFields.aperture_search,
                    searchFields.shutter_speed_search,
                    searchFields.iso_value,
                    searchFields.format_value,
                    searchFields.search_text,
                    photo.id
                ]
            );

            if (hasAlbumUpdate && Number(photo.album_id || 0) !== Number(albumId || 0)) {
                if (photo.album_id) {
                    oldAlbumCounts.set(photo.album_id, (oldAlbumCounts.get(photo.album_id) || 0) + 1);
                }
                if (albumId) {
                    newAlbumCounts.set(albumId, (newAlbumCounts.get(albumId) || 0) + 1);
                }
            }
        }

        for (const [albumId, count] of oldAlbumCounts.entries()) {
            await connection.query(
                'UPDATE albums SET photo_count = GREATEST(photo_count - ?, 0) WHERE id = ?',
                [count, albumId]
            );
        }

        for (const [albumId, count] of newAlbumCounts.entries()) {
            await connection.query(
                'UPDATE albums SET photo_count = photo_count + ? WHERE id = ?',
                [count, albumId]
            );
        }

        await logActivity(connection, {
            liveId: rows[0].live_id,
            user: req.user,
            action: 'photo.update.batch',
            targetType: 'photo',
            targetId: ids.join(','),
            detail: {
                count: rows.length,
                albumId: hasAlbumUpdate ? nextAlbumId : undefined,
                isPublic: hasVisibilityUpdate ? nextVisibility : undefined,
                appendTags
            }
        });

        await connection.commit();
        res.json({
            code: 200,
            message: `已批量更新 ${rows.length} 张照片`,
            data: {
                updated_count: rows.length
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('批量更新图片失败:', error);
        res.status(500).json({ code: 500, message: '批量更新图片失败' });
    } finally {
        connection.release();
    }
});

router.post('/batch-delete', authenticateToken, requirePhotographer, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const ids = Array.from(new Set(
            (Array.isArray(req.body?.ids) ? req.body.ids : [])
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id) && id > 0)
        )).slice(0, 200);

        if (!ids.length) {
            return res.status(400).json({ code: 400, message: '请先提供要删除的照片' });
        }

        const placeholders = ids.map(() => '?').join(', ');
        const [rows] = await connection.query(
            `SELECT * FROM photos WHERE id IN (${placeholders})`,
            ids
        );
        if (!rows.length) {
            return res.status(404).json({ code: 404, message: '图片不存在' });
        }

        const unauthorized = rows.find((photo) => req.user.role !== 'admin' && photo.photographer_id !== req.user.id);
        if (unauthorized) {
            return res.status(403).json({ code: 403, message: '包含无权限删除的图片' });
        }

        await connection.beginTransaction();
        await connection.query(
            `DELETE FROM photos WHERE id IN (${placeholders})`,
            ids
        );

        const albumCounts = rows.reduce((map, photo) => {
            if (!photo.album_id) {
                return map;
            }
            map.set(photo.album_id, (map.get(photo.album_id) || 0) + 1);
            return map;
        }, new Map());

        for (const [albumId, count] of albumCounts.entries()) {
            await connection.query(
                'UPDATE albums SET photo_count = GREATEST(photo_count - ?, 0) WHERE id = ?',
                [count, albumId]
            );
        }

        await logActivity(connection, {
            liveId: rows[0].live_id,
            user: req.user,
            action: 'photo.delete.batch',
            targetType: 'photo',
            targetId: ids.join(','),
            detail: {
                count: rows.length,
                ids,
                sampleTitles: rows.slice(0, 6).map((photo) => photo.title || photo.original_name || `photo-${photo.id}`)
            }
        });

        await connection.commit();
        await Promise.allSettled(rows.map((photo) => deletePhotoAssetsIfOrphan(pool, photo)));

        res.json({
            code: 200,
            message: `已删除 ${rows.length} 张照片`,
            data: {
                deleted_count: rows.length,
                ids
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('批量删除图片失败:', error);
        res.status(500).json({ code: 500, message: '批量删除图片失败' });
    } finally {
        connection.release();
    }
});

router.delete('/:id', authenticateToken, requirePhotographer, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query('SELECT * FROM photos WHERE id = ? LIMIT 1', [req.params.id]);
        const photo = rows[0];
        if (!photo) {
            return res.status(404).json({ code: 404, message: '图片不存在' });
        }

        if (req.user.role !== 'admin' && photo.photographer_id !== req.user.id) {
            return res.status(403).json({ code: 403, message: '无权限删除此图片' });
        }

        await connection.beginTransaction();
        await connection.query('DELETE FROM photos WHERE id = ?', [req.params.id]);
        if (photo.album_id) {
            await connection.query(
                'UPDATE albums SET photo_count = GREATEST(photo_count - 1, 0) WHERE id = ?',
                [photo.album_id]
            );
        }

        await logActivity(connection, {
            liveId: photo.live_id,
            user: req.user,
            action: 'photo.delete',
            targetType: 'photo',
            targetId: String(photo.id),
            detail: { title: photo.title, albumId: photo.album_id }
        });

        await connection.commit();

        await deletePhotoAssetsIfOrphan(pool, photo);

        res.json({ code: 200, message: '图片删除成功' });
    } catch (error) {
        await connection.rollback();
        console.error('删除图片失败:', error);
        res.status(500).json({ code: 500, message: '删除图片失败' });
    } finally {
        connection.release();
    }
});

router.post('/:id/like', optionalAuth, async (req, res) => {
    try {
        const photoId = Number(req.params.id);
        const [photoRows] = await pool.query('SELECT id, live_id, is_public FROM photos WHERE id = ? LIMIT 1', [photoId]);
        const photo = photoRows[0];
        if (!photo || Number(photo.is_public) !== 1) {
            return res.status(404).json({ code: 404, message: '图片不存在' });
        }

        const liveAccess = await ensureLiveViewAccess(pool, req, Number(photo.live_id));
        if (!liveAccess.ok) {
            return res.status(liveAccess.status).json({ code: liveAccess.status, message: liveAccess.message });
        }

        const userId = req.user?.id || null;
        const ipAddress = req.ip;
        const io = req.app.get('io');

        const [existing] = await pool.query(
            `SELECT id FROM likes
             WHERE photo_id = ?
             AND ((user_id IS NOT NULL AND user_id = ?) OR (user_id IS NULL AND ip_address = ?))
             LIMIT 1`,
            [photoId, userId, ipAddress]
        );

        if (existing[0]) {
            await pool.query('DELETE FROM likes WHERE id = ?', [existing[0].id]);
            await pool.query('UPDATE photos SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?', [photoId]);
            io.emit('like-update', { photoId, liked: false });
            return res.json({ code: 200, message: '已取消点赞', liked: false });
        }

        await pool.query(
            'INSERT INTO likes (user_id, photo_id, ip_address) VALUES (?, ?, ?)',
            [userId, photoId, ipAddress]
        );
        await pool.query('UPDATE photos SET like_count = like_count + 1 WHERE id = ?', [photoId]);
        io.emit('like-update', { photoId, liked: true });
        res.json({ code: 200, message: '点赞成功', liked: true });
    } catch (error) {
        console.error('点赞失败:', error);
        res.status(500).json({ code: 500, message: '点赞失败' });
    }
});

async function ensureLiveViewAccess(executor, req, liveId) {
    const live = await getLiveById(executor, liveId);
    if (!live) {
        return { ok: false, status: 404, message: '直播不存在' };
    }

    if (live.access_code && !verifyLiveAccessToken(readLiveAccessToken(req), live.id)) {
        return { ok: false, status: 403, message: '当前直播需要访问密码' };
    }

    return { ok: true, live };
}

async function getLiveById(executor, liveId) {
    const [rows] = await executor.query(
        `SELECT id, slug, title, access_code, allow_batch_download,
                allow_original_download, allow_watermarked_download, watermark_enabled,
                require_photo_review
         FROM lives
         WHERE id = ?
         LIMIT 1`,
        [Number(liveId)]
    );
    return rows[0] || null;
}

async function getPhotosForArchive({
    executor,
    liveId,
    ids,
    albumId,
    onlyPublic,
    preferredUrlField
}) {
    const whereParts = ['p.live_id = ?'];
    const params = [liveId];

    if (onlyPublic) {
        whereParts.push('p.is_public = 1');
    }

    if (albumId) {
        whereParts.push('p.album_id = ?');
        params.push(albumId);
    }

    if (ids.length) {
        whereParts.push(`p.id IN (${ids.map(() => '?').join(',')})`);
        params.push(...ids);
    }

    const [rows] = await executor.query(
        `SELECT p.id, p.title, p.original_name, p.created_at, p.original_url, p.compressed_url, p.watermarked_url
         FROM photos p
         WHERE ${whereParts.join(' AND ')}
         ORDER BY p.created_at ASC`,
        params
    );

    return rows.map((row, index) => ({
        ...row,
        archiveUrl: row[preferredUrlField] || row.watermarked_url || row.compressed_url || row.original_url,
        fileLabel: row.title || row.original_name || `photo-${index + 1}`
    }));
}

async function streamPhotoArchive({ req, res, photos, fileName }) {
    if (storageMode !== 'local') {
        throw new Error('当前存储模式暂不支持服务器端打包下载');
    }

    const validFiles = photos
        .map((photo, index) => {
            const filePath = resolveLocalPathFromUrl(photo.archiveUrl);
            if (!filePath || !fs.existsSync(filePath)) {
                return null;
            }

            const ext = path.extname(filePath) || '.jpg';
            return {
                photo,
                filePath,
                archiveName: buildArchiveEntryName(photo, index, ext)
            };
        })
        .filter(Boolean);

    if (!validFiles.length) {
        throw new Error('未找到可打包的本地文件');
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (error) => {
        throw error;
    });
    archive.pipe(res);

    validFiles.forEach((item) => {
        archive.file(item.filePath, { name: item.archiveName });
    });

    req.on('close', () => {
        archive.abort();
    });

    await archive.finalize();
}

async function createDownloadJob({
    executor,
    scope,
    requesterUserId,
    live,
    liveId,
    albumId,
    ids,
    photos,
    preferredUrlField,
    fileName
}) {
    const normalizedFileName = String(fileName || `${safeFileName(live.slug || live.title || `live-${liveId}`)}.zip`).replace(/\.zip$/i, '') + '.zip';
    const sourceSignature = createDownloadSignature({
        scope,
        liveId,
        albumId,
        ids,
        preferredUrlField,
        photoIds: photos.map((photo) => photo.id)
    });

    const existing = await findReusableDownloadJob(executor, {
        liveId,
        scope,
        sourceSignature
    });
    if (existing) {
        return existing;
    }

    const detail = JSON.stringify({
        albumId,
        ids,
        preferredUrlField,
        photoIds: photos.map((photo) => photo.id)
    });

    if (storageMode !== 'qiniu' || !qiniuEnabled) {
        const directPath = buildDirectDownloadPath({
            scope,
            liveId,
            albumId,
            ids
        });
        const [insertResult] = await executor.query(
            `INSERT INTO download_jobs
            (live_id, requester_user_id, scope, job_kind, source_signature, selection_count, storage_mode,
             preferred_url_field, file_name, archive_url, status, detail, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', ?, DATE_ADD(NOW(), INTERVAL 1 DAY))`,
            [
                liveId,
                requesterUserId,
                scope,
                ids.length || albumId ? 'selection' : 'full',
                sourceSignature,
                photos.length,
                storageMode,
                preferredUrlField,
                normalizedFileName,
                directPath,
                detail
            ]
        );

        return {
            id: insertResult.insertId,
            live_id: liveId,
            scope,
            job_kind: ids.length || albumId ? 'selection' : 'full',
            selection_count: photos.length,
            storage_mode: storageMode,
            preferred_url_field: preferredUrlField,
            file_name: normalizedFileName,
            archive_url: directPath,
            status: 'ready',
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };
    }

    const archiveKey = `archives/${liveId}/${Date.now()}-${sourceSignature.slice(0, 12)}.zip`;
    const indexKey = `archives/${liveId}/indices/${Date.now()}-${sourceSignature.slice(0, 12)}.txt`;

    const [insertResult] = await executor.query(
        `INSERT INTO download_jobs
        (live_id, requester_user_id, scope, job_kind, source_signature, selection_count, storage_mode,
         preferred_url_field, file_name, archive_key, archive_url, source_index_key, status, detail, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, 'qiniu', ?, ?, ?, ?, ?, 'queued', ?, DATE_ADD(NOW(), INTERVAL 3 DAY))`,
        [
            liveId,
            requesterUserId,
            scope,
            ids.length || albumId ? 'selection' : 'full',
            sourceSignature,
            photos.length,
            preferredUrlField,
            normalizedFileName,
            archiveKey,
            buildQiniuUrl(archiveKey),
            indexKey,
            detail
        ]
    );

    try {
        const indexContent = buildMkzipIndexContent(photos);
        await uploadBuffer(indexKey, Buffer.from(indexContent, 'utf8'));
        const saveAsTarget = toUrlSafeBase64(`${process.env.QINIU_BUCKET}:${archiveKey}`);
        const encoding = toUrlSafeBase64('utf-8');
        const response = await createQiniuArchiveJob({
            inputKey: indexKey,
            fops: [`mkzip/4/encoding/${encoding}|saveas/${saveAsTarget}`]
        });

        await executor.query(
            `UPDATE download_jobs
             SET persistent_id = ?, status = 'processing', updated_at = NOW()
             WHERE id = ?`,
            [response.persistentId || '', insertResult.insertId]
        );
    } catch (error) {
        await executor.query(
            `UPDATE download_jobs
             SET status = 'failed', error_message = ?, updated_at = NOW()
             WHERE id = ?`,
            [error.message || '提交七牛打包任务失败', insertResult.insertId]
        );
        throw error;
    }

    return getDownloadJobById(executor, insertResult.insertId, liveId, scope);
}

async function refreshDownloadJob(executor, job) {
    if (!job) {
        return job;
    }

    if (job.storage_mode !== 'qiniu' || !job.persistent_id || !['queued', 'processing'].includes(job.status)) {
        return job;
    }

    try {
        const result = await queryQiniuArchiveJob(job.persistent_id);
        const nextStatus = Number(result.code) === 0
            ? 'ready'
            : Number(result.code) === 3
                ? 'failed'
                : 'processing';
        const errorMessage = Number(result.code) === 3
            ? result.items?.find((item) => item.error)?.error || result.desc || '七牛打包失败'
            : null;

        await executor.query(
            `UPDATE download_jobs
             SET status = ?, error_message = ?, updated_at = NOW()
             WHERE id = ?`,
            [nextStatus, errorMessage, job.id]
        );
        return getDownloadJobById(executor, job.id, job.live_id, job.scope);
    } catch (error) {
        return {
            ...job,
            error_message: error.message || job.error_message
        };
    }
}

async function findReusableDownloadJob(executor, { liveId, scope, sourceSignature }) {
    const [rows] = await executor.query(
        `SELECT *
         FROM download_jobs
         WHERE live_id = ? AND scope = ? AND source_signature = ?
           AND status IN ('queued', 'processing', 'ready')
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY id DESC
         LIMIT 1`,
        [liveId, scope, sourceSignature]
    );
    return rows[0] || null;
}

async function getDownloadJobById(executor, jobId, liveId, scope) {
    const [rows] = await executor.query(
        `SELECT *
         FROM download_jobs
         WHERE id = ? AND live_id = ? AND scope = ?
         LIMIT 1`,
        [jobId, liveId, scope]
    );
    return rows[0] || null;
}

function serializeDownloadJob(job) {
    if (!job) {
        return null;
    }

    const downloadUrl = job.status === 'ready'
        ? buildAttachmentUrl(job.archive_url, job.file_name)
        : '';

    return {
        id: job.id || null,
        status: job.status,
        stage: buildJobStage(job.status),
        file_name: job.file_name,
        selection_count: Number(job.selection_count || 0),
        scope: job.scope,
        storage_mode: job.storage_mode,
        preferred_url_field: job.preferred_url_field,
        download_url: downloadUrl,
        error_message: job.error_message || '',
        created_at: job.created_at || null,
        updated_at: job.updated_at || null,
        expires_at: job.expires_at || null
    };
}

function buildJobStage(status) {
    if (status === 'ready') {
        return '已完成';
    }
    if (status === 'failed') {
        return '打包失败';
    }
    if (status === 'processing') {
        return '七牛云端打包中';
    }
    return '任务已创建';
}

function createDownloadSignature({ scope, liveId, albumId, ids, preferredUrlField, photoIds }) {
    return crypto
        .createHash('sha1')
        .update(JSON.stringify({
            scope,
            liveId,
            albumId: albumId || null,
            ids: ids || [],
            preferredUrlField,
            photoIds
        }))
        .digest('hex');
}

function buildMkzipIndexContent(photos) {
    return photos.map((photo, index) => {
        const alias = buildArchiveEntryName(photo, index, pickArchiveExtension(photo.archiveUrl));
        return `/url/${toUrlSafeBase64(photo.archiveUrl)}/alias/${toUrlSafeBase64(alias)}`;
    }).join('\n');
}

function pickArchiveExtension(url) {
    const normalized = String(url || '');
    if (/format\/webp/i.test(normalized)) {
        return '.webp';
    }
    if (/format\/avif/i.test(normalized)) {
        return '.avif';
    }
    try {
        const pathname = new URL(normalized).pathname;
        return path.extname(pathname) || '.jpg';
    } catch (_error) {
        return path.extname(normalized.split('?')[0]) || '.jpg';
    }
}

function buildDirectDownloadPath({ scope, liveId, albumId, ids }) {
    const query = new URLSearchParams();
    if (albumId) {
        query.set('album_id', String(albumId));
    }
    if (ids.length) {
        query.set('ids', ids.join(','));
    }

    const base = scope === 'admin'
        ? `/api/photos/admin/live/${liveId}/download`
        : `/api/photos/live/${liveId}/download`;

    return query.toString() ? `${base}?${query.toString()}` : base;
}

function toUrlSafeBase64(value) {
    return Buffer.from(String(value || ''))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function normalizeDirectFiles(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .slice(0, 30)
        .map((file) => ({
            client_ref: String(file.client_ref || file.clientRef || '').trim(),
            key: String(file.key || '').trim(),
            title: String(file.title || '').trim(),
            original_name: String(file.original_name || file.originalName || '').trim(),
            width: toPositiveInt(file.width),
            height: toPositiveInt(file.height),
            file_size: toPositiveInt(file.file_size || file.size),
            file_hash: normalizeFileHash(file.file_hash || file.checksum)
        }))
        .filter((file) => file.key || file.file_hash);
}

async function hashLocalFile(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

function normalizeFileHash(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return /^[a-f0-9]{16,64}$/.test(normalized) ? normalized : '';
}

async function findExistingHashes(executor, liveId, hashes) {
    const filtered = Array.from(new Set((hashes || []).filter(Boolean)));
    if (!filtered.length) {
        return new Set();
    }

    const [rows] = await executor.query(
        `SELECT file_hash
         FROM photos
         WHERE live_id = ?
           AND file_hash IN (${filtered.map(() => '?').join(',')})`,
        [liveId, ...filtered]
    );

    return new Set(rows.map((row) => normalizeFileHash(row.file_hash)).filter(Boolean));
}

async function findExistingPhotoByHash(executor, liveId, fileHash) {
    if (!fileHash) {
        return null;
    }

    const [rows] = await executor.query(
        `SELECT id, title
         FROM photos
         WHERE live_id = ? AND file_hash = ?
         LIMIT 1`,
        [liveId, fileHash]
    );
    return rows[0] || null;
}

async function findReusablePhotosByHashes(executor, hashes) {
    const filtered = Array.from(new Set((hashes || []).filter(Boolean)));
    if (!filtered.length) {
        return new Map();
    }

    const [rows] = await executor.query(
        `SELECT id, file_hash, original_url, compressed_url, thumbnail_url, watermarked_url,
                width, height, file_size, exif_data, original_name
         FROM photos
         WHERE file_hash IN (${filtered.map(() => '?').join(',')})
         ORDER BY id ASC`,
        filtered
    );

    return rows.reduce((map, row) => {
        const key = normalizeFileHash(row.file_hash);
        if (key && !map.has(key)) {
            map.set(key, row);
        }
        return map;
    }, new Map());
}

async function findReusablePhotoByHash(executor, fileHash) {
    if (!fileHash) {
        return null;
    }

    const [rows] = await executor.query(
        `SELECT id, file_hash, original_url, compressed_url, thumbnail_url, watermarked_url,
                width, height, file_size, exif_data, original_name
         FROM photos
         WHERE file_hash = ?
         ORDER BY id ASC
         LIMIT 1`,
        [fileHash]
    );
    return rows[0] || null;
}

async function deletePhotoAssetsIfOrphan(executor, photo) {
    const urls = [
        photo.original_url,
        photo.compressed_url,
        photo.thumbnail_url,
        photo.watermarked_url
    ].filter(Boolean);

    for (const url of urls) {
        const [rows] = await executor.query(
            `SELECT COUNT(*) AS total
             FROM photos
             WHERE id <> ?
               AND (original_url = ? OR compressed_url = ? OR thumbnail_url = ? OR watermarked_url = ?)
             LIMIT 1`,
            [photo.id, url, url, url, url]
        );
        if (Number(rows[0]?.total || 0) === 0) {
            await deleteByUrl(url);
        }
    }
}

function normalizeExifData(value, append = {}) {
    const base = typeof value === 'string' ? safeJsonParse(value, {}) : value || {};
    return {
        ...base,
        ...append
    };
}

function normalizeSearchKeyword(value) {
    return String(value || '')
        .normalize('NFKC')
        .trim()
        .toLowerCase()
        .replace(/^\./, '')
        .replace(/^jpeg$/, 'jpg')
        .replace(/\s+/g, ' ');
}

async function queryFilterValues(columnName, whereSql, params, limit = 8) {
    const safeColumn = String(columnName);
    const [rows] = await pool.query(
        `SELECT ${safeColumn} AS value, COUNT(*) AS total
         FROM photos
         ${whereSql}
           AND ${safeColumn} IS NOT NULL
           AND ${safeColumn} <> ''
         GROUP BY ${safeColumn}
         ORDER BY total DESC, value ASC
         LIMIT ?`,
        [...params, limit]
    );
    return rows;
}

function formatFilterRows(rows, labelMapper = (value) => value) {
    return rows.map((row) => ({
        value: row.value,
        label: labelMapper(row.value),
        count: Number(row.total || 0)
    }));
}

function formatNumericFilterRows(rows, labelMapper = (value) => String(value)) {
    return rows
        .map((row) => ({
            value: Number(row.value),
            count: Number(row.total || 0)
        }))
        .filter((row) => Number.isFinite(row.value) && row.value > 0)
        .map((row) => ({
            value: row.value,
            label: labelMapper(row.value),
            count: row.count
        }));
}

function prettifyFilterLabel(value) {
    return String(value || '')
        .split(' ')
        .map((part) => {
            if (!part) {
                return part;
            }
            if (/^\d/.test(part) || /^f\/?\d/i.test(part)) {
                return part.toUpperCase();
            }
            return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join(' ');
}

function parseIsoSearchValue(value) {
    const normalized = normalizeSearchKeyword(value);
    const match = normalized.match(/^(?:iso\s*)?(\d{2,6})$/i);
    if (!match) {
        return null;
    }

    const isoValue = Number(match[1]);
    return Number.isFinite(isoValue) && isoValue > 0 ? isoValue : null;
}

function parseFormatSearchValue(value) {
    const normalized = normalizeSearchKeyword(value).replace(/^\./, '');
    const aliasMap = {
        jpeg: 'jpg',
        tiff: 'tif'
    };
    const format = aliasMap[normalized] || normalized;
    return /^(jpg|png|webp|heic|heif|raw|cr2|cr3|nef|arw|dng|tif|bmp|gif)$/i.test(format)
        ? format
        : '';
}

function buildUploadResultMessage({ uploadedCount, reusedCount = 0, skippedCount, reviewRequired }) {
    if (!uploadedCount && skippedCount) {
        return `没有新增照片，已跳过 ${skippedCount} 张重复照片`;
    }

    let message = reviewRequired
        ? `成功上传 ${uploadedCount} 张照片，当前处于待审核状态`
        : `成功上传 ${uploadedCount} 张照片`;

    if (reusedCount) {
        message += `，其中 ${reusedCount} 张为云端秒传`;
    }

    if (skippedCount) {
        message += `，跳过 ${skippedCount} 张重复照片`;
    }

    return message;
}

function buildUploadedPhotoTitle({ titlePrefix, index, originalName }) {
    const prefix = String(titlePrefix || '').trim();
    if (prefix) {
        return `${prefix} ${index + 1}`;
    }

    return String(originalName || '').trim() || `照片 ${index + 1}`;
}

function pickUploadExtension(name, type) {
    const extFromName = path.extname(String(name || '')).toLowerCase();
    if (extFromName) {
        return extFromName;
    }

    const mimeMap = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/heic': '.heic',
        'image/heif': '.heif'
    };

    return mimeMap[String(type || '').toLowerCase()] || '.jpg';
}

function stripFileExtension(name) {
    return path.basename(String(name || ''), path.extname(String(name || ''))).trim();
}

function inferFormat(name) {
    return pickUploadExtension(name, '').replace(/^\./, '') || 'jpg';
}

function toPositiveInt(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function parseTags(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item).trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
            return [];
        }

        if (trimmed.startsWith('[')) {
            try {
                return JSON.parse(trimmed).map((item) => String(item).trim()).filter(Boolean);
            } catch (_error) {
                return [];
            }
        }

        return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    }

    return [];
}

function parseIdList(value) {
    if (!value) {
        return [];
    }

    return String(value)
        .split(',')
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0);
}

function normalizeIdCollection(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) => Number(item))
            .filter((item) => Number.isInteger(item) && item > 0);
    }

    return parseIdList(value);
}

function normalizeAlbumId(value) {
    if (value === null || value === undefined || value === '' || value === 'all') {
        return null;
    }

    const albumId = Number(value);
    return Number.isInteger(albumId) && albumId > 0 ? albumId : null;
}

function mapPhotoRow(row) {
    return {
        ...row,
        tags: typeof row.tags === 'string' ? safeJsonParse(row.tags, []) : row.tags || [],
        exif_data: typeof row.exif_data === 'string' ? safeJsonParse(row.exif_data, {}) : row.exif_data || {}
    };
}

function mapPhotoListRow(row) {
    return {
        ...row,
        tags: typeof row.tags === 'string' ? safeJsonParse(row.tags, []) : row.tags || []
    };
}

function safeJsonParse(input, fallback) {
    try {
        return JSON.parse(input);
    } catch (_error) {
        return fallback;
    }
}

function safeFileName(input) {
    return String(input || 'photo')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) || 'photo';
}

function buildArchiveEntryName(photo, index, fallbackExt = '.jpg') {
    const sourceName = String(photo.original_name || '').trim();
    if (sourceName) {
        const basename = path.basename(sourceName).replace(/[\\/:*?"<>|]+/g, '-').trim();
        const ext = path.extname(basename) || fallbackExt;
        const body = path.basename(basename, path.extname(basename)).trim() || `photo-${index + 1}`;
        return `${String(index + 1).padStart(3, '0')}-${body}${ext}`;
    }

    return `${String(index + 1).padStart(3, '0')}-${safeFileName(photo.fileLabel)}${fallbackExt}`;
}

module.exports = router;
