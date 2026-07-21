const fs = require('fs');
const path = require('path');
const express = require('express');

const { pool } = require('../config/database');
const { logActivity } = require('../lib/activity-log');
const { assertManageLive } = require('../lib/live-permissions');
const { authenticateToken, requirePhotographer } = require('../middleware/auth');
const {
    deleteByUrl,
    deleteQiniuKeys,
    extractQiniuKeyFromUrl,
    listAllQiniuKeys,
    qiniuEnabled,
    storageMode,
    uploadRoot
} = require('../lib/storage');

const router = express.Router();
const activeJobs = new Set();

router.post('/photo-delete-jobs', authenticateToken, requirePhotographer, async (req, res) => {
    try {
        const liveId = Number(req.body.live_id);
        const ids = Array.from(new Set(
            (Array.isArray(req.body.ids) ? req.body.ids : [])
                .map((id) => Number(id))
                .filter((id) => Number.isInteger(id) && id > 0)
        )).slice(0, 1000);

        if (!liveId || !ids.length) {
            return res.status(400).json({ code: 400, message: '缺少 live_id 或待删除照片' });
        }

        await assertManageLive(pool, req.user, liveId);

        const [result] = await pool.query(
            `INSERT INTO maintenance_jobs
            (job_type, status, progress, phase, summary, stats, requested_by)
            VALUES ('delete_photos', 'queued', 0, '等待开始', '准备删除照片', ?, ?)`,
            [JSON.stringify({
                live_id: liveId,
                ids,
                total: ids.length,
                deleted_count: 0,
                failed_count: 0
            }), req.user.id]
        );

        const jobId = result.insertId;
        triggerDeletePhotos(jobId, req.user);
        const job = await getJob(jobId);
        res.status(202).json({ code: 200, data: serializeJob(job) });
    } catch (error) {
        console.error('创建删除任务失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '创建删除任务失败' });
    }
});

router.get('/photo-delete-jobs/:jobId', authenticateToken, requirePhotographer, async (req, res) => {
    try {
        const job = await getJob(Number(req.params.jobId));
        if (!job || job.job_type !== 'delete_photos') {
            return res.status(404).json({ code: 404, message: '删除任务不存在' });
        }
        res.json({ code: 200, data: serializeJob(job) });
    } catch (error) {
        console.error('获取删除任务失败:', error);
        res.status(500).json({ code: 500, message: '获取删除任务失败' });
    }
});

router.post('/cleanup-jobs', authenticateToken, requirePhotographer, async (req, res) => {
    try {
        const [runningRows] = await pool.query(
            `SELECT *
             FROM maintenance_jobs
             WHERE job_type = 'cleanup' AND status IN ('queued', 'processing')
             ORDER BY id DESC
             LIMIT 1`
        );
        if (runningRows[0]) {
            triggerCleanup(runningRows[0].id);
            return res.status(202).json({ code: 200, data: serializeJob(runningRows[0]) });
        }

        const [result] = await pool.query(
            `INSERT INTO maintenance_jobs
            (job_type, status, progress, phase, summary, stats, requested_by)
            VALUES ('cleanup', 'queued', 0, '等待开始', '准备扫描无用数据', ?, ?)`,
            [JSON.stringify({}), req.user.id]
        );

        const jobId = result.insertId;
        triggerCleanup(jobId);

        const job = await getJob(jobId);
        res.status(202).json({ code: 200, data: serializeJob(job) });
    } catch (error) {
        console.error('创建清理任务失败:', error);
        res.status(500).json({ code: 500, message: '创建清理任务失败' });
    }
});

router.get('/cleanup-jobs/:jobId', authenticateToken, requirePhotographer, async (req, res) => {
    try {
        const job = await getJob(Number(req.params.jobId));
        if (!job) {
            return res.status(404).json({ code: 404, message: '清理任务不存在' });
        }
        res.json({ code: 200, data: serializeJob(job) });
    } catch (error) {
        console.error('获取清理任务失败:', error);
        res.status(500).json({ code: 500, message: '获取清理任务失败' });
    }
});

function triggerCleanup(jobId) {
    if (activeJobs.has(jobId)) {
        return;
    }
    activeJobs.add(jobId);
    setImmediate(async () => {
        try {
            await runCleanupJob(jobId);
        } finally {
            activeJobs.delete(jobId);
        }
    });
}

function triggerDeletePhotos(jobId, user) {
    if (activeJobs.has(jobId)) {
        return;
    }
    activeJobs.add(jobId);
    setImmediate(async () => {
        try {
            await runDeletePhotosJob(jobId, user);
        } finally {
            activeJobs.delete(jobId);
        }
    });
}

async function runCleanupJob(jobId) {
    const stats = {
        storage_mode: storageMode,
        referenced_keys: 0,
        scanned_keys: 0,
        orphan_keys: 0,
        deleted_keys: 0,
        failed_keys: 0,
        expired_download_jobs_cleared: 0,
        stale_temp_files_deleted: 0
    };

    try {
        await updateJob(jobId, {
            status: 'processing',
            progress: 5,
            phase: '扫描数据库引用',
            summary: '正在收集相册、照片和下载任务的有效文件引用',
            stats
        });

        const referencedKeys = await collectReferencedKeys();
        stats.referenced_keys = referencedKeys.size;

        await updateJob(jobId, {
            status: 'processing',
            progress: 25,
            phase: '扫描七牛云文件',
            summary: qiniuEnabled ? '正在列出七牛云里由本站管理的文件' : '当前不是七牛模式，跳过云端扫描',
            stats
        });

        let orphanKeys = [];
        if (qiniuEnabled) {
            const allKeys = await listAllQiniuKeys('');
            const managedKeys = allKeys.filter(isManagedBucketKey);
            stats.scanned_keys = managedKeys.length;
            orphanKeys = managedKeys.filter((key) => !referencedKeys.has(key));
            stats.orphan_keys = orphanKeys.length;
        }

        await updateJob(jobId, {
            status: 'processing',
            progress: 45,
            phase: '清理无用云端文件',
            summary: orphanKeys.length
                ? `发现 ${orphanKeys.length} 个无引用文件，正在删除`
                : '没有发现需要删除的无用云端文件',
            stats
        });

        if (orphanKeys.length) {
            const chunks = chunk(orphanKeys, 100);
            for (let index = 0; index < chunks.length; index += 1) {
                const batch = chunks[index];
                const result = await deleteQiniuKeys(batch);
                stats.deleted_keys += Number(result.deleted || 0);
                stats.failed_keys += Array.isArray(result.failed) ? result.failed.length : 0;
                const progress = 45 + Math.round(((index + 1) / chunks.length) * 35);
                await updateJob(jobId, {
                    status: 'processing',
                    progress,
                    phase: '清理无用云端文件',
                    summary: `正在删除无引用云端文件 ${index + 1} / ${chunks.length}`,
                    stats
                });
            }
        }

        await updateJob(jobId, {
            status: 'processing',
            progress: 84,
            phase: '清理过期缓存',
            summary: '正在清理过期下载任务和临时文件',
            stats
        });

        stats.expired_download_jobs_cleared = await clearExpiredDownloadJobs();
        stats.stale_temp_files_deleted = await clearStaleTempFiles();

        const summary = buildCleanupSummary(stats);
        await updateJob(jobId, {
            status: 'ready',
            progress: 100,
            phase: '清理完成',
            summary,
            stats
        });
    } catch (error) {
        console.error('执行清理任务失败:', error);
        await updateJob(jobId, {
            status: 'failed',
            progress: 100,
            phase: '清理失败',
            summary: '清理过程中发生错误',
            stats,
            error_message: error.message || '执行清理任务失败'
        });
    }
}

async function runDeletePhotosJob(jobId, user) {
    const job = await getJob(jobId);
    const stats = typeof job?.stats === 'string' ? safeJsonParse(job.stats, {}) : (job?.stats || {});
    const liveId = Number(stats.live_id || 0);
    const ids = Array.isArray(stats.ids) ? stats.ids.map((id) => Number(id)).filter(Boolean) : [];

    try {
        await updateJob(jobId, {
            status: 'processing',
            progress: 5,
            phase: '准备删除',
            summary: `准备删除 ${ids.length} 张照片`,
            stats: {
                ...stats,
                total: ids.length,
                deleted_count: 0,
                failed_count: 0
            }
        });

        const [rows] = await pool.query(
            `SELECT * FROM photos WHERE live_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
            [liveId, ...ids]
        );

        if (!rows.length) {
            await updateJob(jobId, {
                status: 'failed',
                progress: 100,
                phase: '删除失败',
                summary: '没有找到可删除的照片',
                stats: { ...stats, total: ids.length, deleted_count: 0, failed_count: ids.length },
                error_message: '没有找到可删除的照片'
            });
            return;
        }

        const albumCounts = rows.reduce((map, photo) => {
            if (!photo.album_id) {
                return map;
            }
            map.set(photo.album_id, (map.get(photo.album_id) || 0) + 1);
            return map;
        }, new Map());

        await pool.query(
            `DELETE FROM photos WHERE live_id = ? AND id IN (${rows.map(() => '?').join(',')})`,
            [liveId, ...rows.map((row) => row.id)]
        );

        for (const [albumId, count] of albumCounts.entries()) {
            await pool.query(
                'UPDATE albums SET photo_count = GREATEST(photo_count - ?, 0) WHERE id = ?',
                [count, albumId]
            );
        }

        await updateJob(jobId, {
            status: 'processing',
            progress: 78,
            phase: '清理云端引用',
            summary: `已删除记录，正在清理 ${rows.length} 张照片的独占文件`,
            stats: {
                ...stats,
                total: ids.length,
                deleted_count: rows.length,
                failed_count: 0
            }
        });

        await Promise.allSettled(rows.map((photo) => deletePhotoAssetsIfOrphan(pool, photo)));

        await logActivity(pool, {
            liveId,
            user,
            action: 'photo.delete.batch',
            targetType: 'photo',
            targetId: rows.map((row) => row.id).join(','),
            detail: {
                count: rows.length,
                jobId
            }
        });

        await updateJob(jobId, {
            status: 'ready',
            progress: 100,
            phase: '删除完成',
            summary: `已删除 ${rows.length} 张照片`,
            stats: {
                ...stats,
                total: ids.length,
                deleted_count: rows.length,
                failed_count: Math.max(0, ids.length - rows.length)
            }
        });
    } catch (error) {
        console.error('执行删除任务失败:', error);
        await updateJob(jobId, {
            status: 'failed',
            progress: 100,
            phase: '删除失败',
            summary: '删除任务执行失败',
            stats,
            error_message: error.message || '删除任务执行失败'
        });
    }
}

async function collectReferencedKeys() {
    const keys = new Set();

    const [photoRows] = await pool.query(
        `SELECT original_url, compressed_url, thumbnail_url, watermarked_url
         FROM photos`
    );
    photoRows.forEach((row) => {
        [row.original_url, row.compressed_url, row.thumbnail_url, row.watermarked_url].forEach((url) => {
            const key = extractQiniuKeyFromUrl(url);
            if (key) {
                keys.add(key);
            }
        });
    });

    const [liveRows] = await pool.query(
        `SELECT cover_image, banner_image, share_logo, background_music
         FROM lives`
    );
    liveRows.forEach((row) => {
        [row.cover_image, row.banner_image, row.share_logo, row.background_music].forEach((url) => {
            const key = extractQiniuKeyFromUrl(url);
            if (key) {
                keys.add(key);
            }
        });
    });

    const [downloadRows] = await pool.query(
        `SELECT archive_key, source_index_key
         FROM download_jobs
         WHERE status IN ('queued', 'processing')
            OR expires_at IS NULL
            OR expires_at > NOW()`
    );
    downloadRows.forEach((row) => {
        [row.archive_key, row.source_index_key].forEach((key) => {
            const normalized = String(key || '').trim();
            if (normalized) {
                keys.add(normalized);
            }
        });
    });

    return keys;
}

async function clearExpiredDownloadJobs() {
    const [result] = await pool.query(
        `DELETE FROM download_jobs
         WHERE expires_at IS NOT NULL
           AND expires_at < NOW()
           AND status IN ('ready', 'failed')`
    );
    return Number(result.affectedRows || 0);
}

async function clearStaleTempFiles() {
    const tempDir = path.join(uploadRoot, 'temp');
    if (!fs.existsSync(tempDir)) {
        return 0;
    }

    const now = Date.now();
    const files = fs.readdirSync(tempDir);
    let deleted = 0;

    files.forEach((name) => {
        const filePath = path.join(tempDir, name);
        try {
            const stat = fs.statSync(filePath);
            if (!stat.isFile()) {
                return;
            }
            if (now - stat.mtimeMs < 6 * 60 * 60 * 1000) {
                return;
            }
            fs.unlinkSync(filePath);
            deleted += 1;
        } catch (_error) {
            // ignore individual temp cleanup errors
        }
    });

    return deleted;
}

function isManagedBucketKey(key) {
    return /^(\d+\/|archives\/)/.test(String(key || ''));
}

function chunk(list, size) {
    const result = [];
    for (let index = 0; index < list.length; index += size) {
        result.push(list.slice(index, index + size));
    }
    return result;
}

function buildCleanupSummary(stats) {
    return `已扫描 ${stats.scanned_keys} 个云端文件，清理 ${stats.deleted_keys} 个无引用文件，清理 ${stats.expired_download_jobs_cleared} 条过期下载记录，删除 ${stats.stale_temp_files_deleted} 个临时文件。`;
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
               AND (original_url = ? OR compressed_url = ? OR thumbnail_url = ? OR watermarked_url = ?)`,
            [photo.id, url, url, url, url]
        );
        if (Number(rows[0]?.total || 0) === 0) {
            await deleteByUrl(url);
        }
    }
}

async function updateJob(jobId, patch) {
    const stats = patch.stats === undefined ? undefined : JSON.stringify(patch.stats || {});
    await pool.query(
        `UPDATE maintenance_jobs
         SET status = COALESCE(?, status),
             progress = COALESCE(?, progress),
             phase = COALESCE(?, phase),
             summary = COALESCE(?, summary),
             stats = COALESCE(?, stats),
             error_message = COALESCE(?, error_message),
             updated_at = NOW()
         WHERE id = ?`,
        [
            patch.status ?? null,
            patch.progress ?? null,
            patch.phase ?? null,
            patch.summary ?? null,
            stats ?? null,
            patch.error_message ?? null,
            jobId
        ]
    );
}

async function getJob(jobId) {
    const [rows] = await pool.query(
        `SELECT *
         FROM maintenance_jobs
         WHERE id = ?
         LIMIT 1`,
        [jobId]
    );
    return rows[0] || null;
}

function serializeJob(job) {
    const stats = typeof job.stats === 'string' ? safeJsonParse(job.stats, {}) : (job.stats || {});
    return {
        id: job.id,
        job_type: job.job_type,
        status: job.status,
        progress: Number(job.progress || 0),
        phase: job.phase || '',
        summary: job.summary || '',
        stats,
        live_id: Number(stats.live_id || 0),
        error_message: job.error_message || '',
        created_at: job.created_at || null,
        updated_at: job.updated_at || null
    };
}

function safeJsonParse(input, fallback) {
    try {
        return JSON.parse(input);
    } catch (_error) {
        return fallback;
    }
}

module.exports = router;
