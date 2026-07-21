const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requirePhotographer } = require('../middleware/auth');
const { logActivity } = require('../lib/activity-log');
const { assertManageLive } = require('../lib/live-permissions');

const router = express.Router();

router.get('/live/:liveId', async (req, res) => {
    try {
        const [albums] = await pool.query(
            `SELECT id, live_id, name, icon, cover_image, sort_order, photo_count, created_at
             FROM albums
             WHERE live_id = ?
             ORDER BY sort_order ASC, id ASC`,
            [req.params.liveId]
        );

        res.json({ code: 200, data: albums });
    } catch (error) {
        console.error('获取相册列表失败:', error);
        res.status(500).json({ code: 500, message: '获取相册列表失败' });
    }
});

router.post('/', authenticateToken, requirePhotographer, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { live_id, name, icon = '📷', cover_image = '', sort_order = 0 } = req.body;
        if (!live_id || !name) {
            return res.status(400).json({ code: 400, message: '请填写直播和相册名称' });
        }

        await assertManageLive(connection, req.user, live_id);

        const [result] = await connection.query(
            'INSERT INTO albums (live_id, name, icon, cover_image, sort_order) VALUES (?, ?, ?, ?, ?)',
            [live_id, name.trim(), icon, cover_image.trim(), Number(sort_order) || 0]
        );

        await logActivity(connection, {
            liveId: Number(live_id),
            user: req.user,
            action: 'album.create',
            targetType: 'album',
            targetId: String(result.insertId),
            detail: { name: name.trim() }
        });

        res.status(201).json({
            code: 200,
            message: '相册创建成功',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('创建相册失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '创建相册失败' });
    } finally {
        connection.release();
    }
});

router.put('/:id', authenticateToken, requirePhotographer, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { name, icon = '📷', cover_image = '', sort_order = 0 } = req.body;
        if (!name) {
            return res.status(400).json({ code: 400, message: '请填写相册名称' });
        }

        const [rows] = await connection.query('SELECT id, live_id FROM albums WHERE id = ? LIMIT 1', [req.params.id]);
        const album = rows[0];
        if (!album) {
            return res.status(404).json({ code: 404, message: '相册不存在' });
        }

        await assertManageLive(connection, req.user, album.live_id);

        await connection.query(
            'UPDATE albums SET name = ?, icon = ?, cover_image = ?, sort_order = ? WHERE id = ?',
            [name.trim(), icon, cover_image.trim(), Number(sort_order) || 0, req.params.id]
        );

        await logActivity(connection, {
            liveId: album.live_id,
            user: req.user,
            action: 'album.update',
            targetType: 'album',
            targetId: String(album.id),
            detail: { name: name.trim() }
        });

        res.json({ code: 200, message: '相册更新成功' });
    } catch (error) {
        console.error('更新相册失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '更新相册失败' });
    } finally {
        connection.release();
    }
});

router.delete('/:id', authenticateToken, requirePhotographer, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query('SELECT id, live_id, name FROM albums WHERE id = ? LIMIT 1', [req.params.id]);
        const album = rows[0];
        if (!album) {
            return res.status(404).json({ code: 404, message: '相册不存在' });
        }

        await assertManageLive(connection, req.user, album.live_id);

        await connection.beginTransaction();
        await connection.query('UPDATE photos SET album_id = NULL WHERE album_id = ?', [req.params.id]);
        await connection.query('DELETE FROM albums WHERE id = ?', [req.params.id]);

        await logActivity(connection, {
            liveId: album.live_id,
            user: req.user,
            action: 'album.delete',
            targetType: 'album',
            targetId: String(album.id),
            detail: { name: album.name }
        });

        await connection.commit();
        res.json({ code: 200, message: '相册删除成功' });
    } catch (error) {
        await connection.rollback();
        console.error('删除相册失败:', error);
        res.status(error.statusCode || 500).json({ code: error.statusCode || 500, message: error.message || '删除相册失败' });
    } finally {
        connection.release();
    }
});

module.exports = router;
