const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requirePhotographer } = require('../middleware/auth');
const { assertManageLive } = require('../lib/live-permissions');

const router = express.Router();

router.get('/live/:liveId', authenticateToken, requirePhotographer, async (req, res) => {
    try {
        await assertManageLive(pool, req.user, req.params.liveId);
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Number(req.query.limit) || 30);
        const offset = (page - 1) * limit;

        const [countRows] = await pool.query(
            'SELECT COUNT(*) AS total FROM activity_logs WHERE live_id = ?',
            [req.params.liveId]
        );

        const [rows] = await pool.query(
            `SELECT id, live_id, user_id, actor_name, action, target_type, target_id, detail, created_at
             FROM activity_logs
             WHERE live_id = ?
             ORDER BY created_at DESC, id DESC
             LIMIT ? OFFSET ?`,
            [req.params.liveId, limit, offset]
        );

        res.json({
            code: 200,
            data: {
                logs: rows.map((row) => ({
                    ...row,
                    detail: safeDetail(row.detail)
                })),
                total: countRows[0].total,
                page,
                limit
            }
        });
    } catch (error) {
        console.error('获取操作日志失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '获取操作日志失败' });
    }
});

function safeDetail(value) {
    if (!value) {
        return '';
    }

    try {
        return JSON.parse(value);
    } catch (_error) {
        return value;
    }
}

module.exports = router;
