const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requirePhotographer } = require('../middleware/auth');
const { assertManageLive } = require('../lib/live-permissions');
const { endViewerSession, formatLocationLabel, startViewerSession } = require('../lib/viewer-analytics');

const router = express.Router();

router.post('/live/:liveId/session-start', async (req, res) => {
    try {
        const liveId = Number(req.params.liveId);
        const entryPath = String(req.body?.entry_path || req.query.entry_path || '').trim();
        const { sessionId } = await startViewerSession(pool, { req, liveId, entryPath });
        res.json({ code: 200, data: { session_id: sessionId } });
    } catch (error) {
        console.error('启动观看会话失败:', error);
        res.status(500).json({ code: 500, message: '启动观看会话失败' });
    }
});

router.post('/sessions/:sessionId/end', async (req, res) => {
    try {
        await endViewerSession(pool, {
            sessionId: Number(req.params.sessionId),
            exitPath: String(req.body?.exit_path || '').trim(),
            lastPhotoId: req.body?.last_photo_id ? Number(req.body.last_photo_id) : null,
            durationSeconds: Number(req.body?.duration_seconds || 0)
        });
        res.json({ code: 200, message: 'ok' });
    } catch (error) {
        console.error('结束观看会话失败:', error);
        res.status(500).json({ code: 500, message: '结束观看会话失败' });
    }
});

router.post('/photos/:photoId/download', async (req, res) => {
    try {
        const photoId = Number(req.params.photoId);
        await pool.query(
            'UPDATE photos SET download_count = download_count + 1 WHERE id = ? LIMIT 1',
            [photoId]
        );
        res.json({ code: 200, message: 'ok' });
    } catch (error) {
        console.error('记录图片下载失败:', error);
        res.status(500).json({ code: 500, message: '记录图片下载失败' });
    }
});

router.get('/live/:liveId', authenticateToken, requirePhotographer, async (req, res) => {
    try {
        const liveId = Number(req.params.liveId);
        await assertManageLive(pool, req.user, liveId);

        const [
            summaryRows,
            topPhotosRows,
            topAlbumsRows,
            deviceRows,
            browserRows,
            locationRows,
            recentRows,
            sessionRows,
            downloadRows
        ] = await Promise.all([
            pool.query(
                `SELECT
                    COUNT(*) AS total_events,
                    COUNT(DISTINCT visitor_key) AS unique_visitors,
                    COUNT(DISTINCT ip_address) AS unique_ips,
                    MAX(created_at) AS last_visit_at
                 FROM viewer_events
                 WHERE live_id = ?`,
                [liveId]
            ),
            pool.query(
                `SELECT id, title, thumbnail_url, view_count, like_count, download_count, original_name
                 FROM photos
                 WHERE live_id = ?
                 ORDER BY view_count DESC, like_count DESC, created_at DESC
                 LIMIT 6`,
                [liveId]
            ),
            pool.query(
                `SELECT
                    a.id,
                    a.name,
                    a.icon,
                    COUNT(p.id) AS photo_count,
                    COALESCE(SUM(p.view_count), 0) AS total_views
                 FROM albums a
                 LEFT JOIN photos p ON p.album_id = a.id
                 WHERE a.live_id = ?
                 GROUP BY a.id
                 ORDER BY total_views DESC, photo_count DESC, a.id ASC
                 LIMIT 6`,
                [liveId]
            ),
            pool.query(
                `SELECT
                    device_type,
                    COUNT(*) AS total_events,
                    COUNT(DISTINCT visitor_key) AS unique_visitors
                 FROM viewer_events
                 WHERE live_id = ?
                 GROUP BY device_type
                 ORDER BY total_events DESC`,
                [liveId]
            ),
            pool.query(
                `SELECT
                    browser_name,
                    os_name,
                    COUNT(*) AS total_events
                 FROM viewer_events
                 WHERE live_id = ?
                 GROUP BY browser_name, os_name
                 ORDER BY total_events DESC
                 LIMIT 8`,
                [liveId]
            ),
            pool.query(
                `SELECT
                    country_name,
                    province_name,
                    city_name,
                    COUNT(*) AS total_events,
                    COUNT(DISTINCT visitor_key) AS unique_visitors,
                    COUNT(DISTINCT ip_address) AS unique_ips
                 FROM viewer_events
                 WHERE live_id = ?
                 GROUP BY country_name, province_name, city_name
                 ORDER BY total_events DESC, unique_visitors DESC
                 LIMIT 12`,
                [liveId]
            ),
            pool.query(
                `SELECT
                    ip_address,
                    device_type,
                    device_name,
                    browser_name,
                    os_name,
                    country_name,
                    province_name,
                    city_name,
                    event_type,
                    created_at
                 FROM viewer_events
                 WHERE live_id = ?
                 ORDER BY created_at DESC, id DESC
                 LIMIT 12`,
                [liveId]
            ),
            pool.query(
                `SELECT
                    COUNT(*) AS completed_sessions,
                    COALESCE(AVG(NULLIF(duration_seconds, 0)), 0) AS average_duration_seconds
                 FROM viewer_sessions
                 WHERE live_id = ?
                   AND ended_at IS NOT NULL`,
                [liveId]
            ),
            pool.query(
                `SELECT COALESCE(SUM(download_count), 0) AS total_downloads
                 FROM photos
                 WHERE live_id = ?`,
                [liveId]
            )
        ]);

        const summary = summaryRows[0][0] || {};
        const topPhotos = topPhotosRows[0] || [];
        const topAlbums = topAlbumsRows[0] || [];
        const devices = (deviceRows[0] || []).map((row) => ({
            ...row,
            label: mapDeviceLabel(row.device_type)
        }));
        const browsers = browserRows[0] || [];
        const locations = (locationRows[0] || []).map((row) => ({
            ...row,
            label: formatLocationLabel(row)
        }));
        const sessionSummary = sessionRows[0][0] || {};
        const downloadSummary = downloadRows[0][0] || {};
        const recentVisitors = (recentRows[0] || []).map((row) => ({
            ...row,
            location_label: formatLocationLabel(row),
            ip_display: row.ip_address || '未知 IP'
        }));

        res.json({
            code: 200,
            data: {
                summary: {
                    total_events: Number(summary.total_events || 0),
                    unique_visitors: Number(summary.unique_visitors || 0),
                    unique_ips: Number(summary.unique_ips || 0),
                    last_visit_at: summary.last_visit_at || null,
                    completed_sessions: Number(sessionSummary.completed_sessions || 0),
                    average_duration_seconds: Math.round(Number(sessionSummary.average_duration_seconds || 0)),
                    total_downloads: Number(downloadSummary.total_downloads || 0),
                    top_device: devices[0]?.label || '暂无数据',
                    top_location: locations[0]?.label || '暂无数据',
                    top_photo: topPhotos[0]?.title || '暂无数据',
                    top_album: topAlbums[0]?.name || '暂无数据'
                },
                top_photos: topPhotos,
                top_albums: topAlbums,
                devices,
                browsers,
                locations,
                recent_visitors: recentVisitors
            }
        });
    } catch (error) {
        console.error('获取观看数据失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '获取观看数据失败' });
    }
});

function mapDeviceLabel(value) {
    switch (String(value || '').toLowerCase()) {
    case 'mobile':
        return '手机';
    case 'tablet':
        return '平板';
    case 'desktop':
        return '电脑';
    case 'tv':
        return '电视';
    case 'console':
        return '游戏机';
    default:
        return value || '未知设备';
    }
}

module.exports = router;
