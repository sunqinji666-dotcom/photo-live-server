const express = require('express');
const { pool } = require('../config/database');
const { authenticateToken, requirePhotographer } = require('../middleware/auth');
const { logActivity } = require('../lib/activity-log');

const router = express.Router();

const DEFAULT_PERMISSIONS = {
    manager: ['manage_live', 'upload_photo', 'edit_photo', 'delete_photo', 'download_original', 'download_watermarked'],
    photographer: ['upload_photo', 'edit_photo', 'download_watermarked'],
    retoucher: ['edit_photo', 'download_watermarked'],
    viewer: []
};

router.get('/live/:liveId', authenticateToken, requirePhotographer, async (req, res) => {
    try {
        const liveId = Number(req.params.liveId);
        const [liveRows] = await pool.query(
            `SELECT l.id, l.created_by, u.username, u.nickname, u.avatar
             FROM lives l
             LEFT JOIN users u ON u.id = l.created_by
             WHERE l.id = ?
             LIMIT 1`,
            [liveId]
        );

        if (!liveRows[0]) {
            return res.status(404).json({ code: 404, message: '直播不存在' });
        }

        const [memberRows] = await pool.query(
            `SELECT lm.id, lm.live_id, lm.user_id, lm.role, lm.permissions,
                    u.username, u.nickname, u.avatar, u.mobile, u.role AS user_role
             FROM live_members lm
             LEFT JOIN users u ON u.id = lm.user_id
             WHERE lm.live_id = ?
             ORDER BY lm.created_at ASC`,
            [liveId]
        );

        const creator = {
            id: 0,
            live_id: liveId,
            user_id: liveRows[0].created_by,
            role: 'creator',
            permissions: DEFAULT_PERMISSIONS.manager,
            username: liveRows[0].username,
            nickname: liveRows[0].nickname,
            avatar: liveRows[0].avatar,
            mobile: ''
        };

        const [photoUsers] = await pool.query(
            `SELECT DISTINCT u.id AS user_id, u.username, u.nickname, u.avatar, u.mobile, u.role AS user_role
             FROM photos p
             INNER JOIN users u ON u.id = p.photographer_id
             WHERE p.live_id = ?`,
            [liveId]
        );

        const assigned = new Set([creator.user_id, ...memberRows.map((item) => item.user_id)]);
        const implicitMembers = photoUsers
            .filter((item) => !assigned.has(item.user_id))
            .map((item) => ({
                id: 0,
                live_id: liveId,
                user_id: item.user_id,
                role: 'photographer',
                permissions: DEFAULT_PERMISSIONS.photographer,
                username: item.username,
                nickname: item.nickname,
                avatar: item.avatar,
                mobile: item.mobile,
                user_role: item.user_role,
                source: 'photo'
            }));

        res.json({
            code: 200,
            data: [
                creator,
                ...memberRows.map((row) => ({
                    ...row,
                    permissions: parsePermissions(row.permissions, row.role),
                    source: 'member'
                })),
                ...implicitMembers
            ]
        });
    } catch (error) {
        console.error('获取成员列表失败:', error);
        res.status(500).json({ code: 500, message: '获取成员列表失败' });
    }
});

router.post('/live/:liveId', authenticateToken, requirePhotographer, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const liveId = Number(req.params.liveId);
        const { username = '', mobile = '', role = 'photographer', permissions } = req.body;
        const [users] = await connection.query(
            `SELECT id, username, nickname, avatar, mobile
             FROM users
             WHERE username = ? OR mobile = ?
             LIMIT 1`,
            [username.trim(), mobile.trim()]
        );

        const user = users[0];
        if (!user) {
            return res.status(404).json({ code: 404, message: '未找到对应账号' });
        }

        await connection.query(
            `INSERT INTO live_members (live_id, user_id, role, permissions)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE role = VALUES(role), permissions = VALUES(permissions)`,
            [liveId, user.id, role, JSON.stringify(normalizePermissions(role, permissions))]
        );

        await logActivity(connection, {
            liveId,
            user: req.user,
            action: 'member.add',
            targetType: 'member',
            targetId: String(user.id),
            detail: { username: user.username, nickname: user.nickname, role }
        });

        res.status(201).json({ code: 200, message: '成员已添加' });
    } catch (error) {
        console.error('添加成员失败:', error);
        res.status(500).json({ code: 500, message: '添加成员失败' });
    } finally {
        connection.release();
    }
});

router.put('/:id', authenticateToken, requirePhotographer, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { role = 'photographer', permissions } = req.body;
        const [rows] = await connection.query('SELECT live_id, user_id FROM live_members WHERE id = ? LIMIT 1', [req.params.id]);
        const member = rows[0];
        if (!member) {
            return res.status(404).json({ code: 404, message: '成员不存在' });
        }

        await connection.query(
            'UPDATE live_members SET role = ?, permissions = ? WHERE id = ?',
            [role, JSON.stringify(normalizePermissions(role, permissions)), req.params.id]
        );

        await logActivity(connection, {
            liveId: member.live_id,
            user: req.user,
            action: 'member.update',
            targetType: 'member',
            targetId: String(member.user_id),
            detail: { role }
        });

        res.json({ code: 200, message: '成员权限已更新' });
    } catch (error) {
        console.error('更新成员失败:', error);
        res.status(500).json({ code: 500, message: '更新成员失败' });
    } finally {
        connection.release();
    }
});

router.delete('/:id', authenticateToken, requirePhotographer, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.query('SELECT live_id, user_id FROM live_members WHERE id = ? LIMIT 1', [req.params.id]);
        const member = rows[0];
        if (!member) {
            return res.status(404).json({ code: 404, message: '成员不存在' });
        }

        await connection.query('DELETE FROM live_members WHERE id = ?', [req.params.id]);

        await logActivity(connection, {
            liveId: member.live_id,
            user: req.user,
            action: 'member.remove',
            targetType: 'member',
            targetId: String(member.user_id)
        });

        res.json({ code: 200, message: '成员已移除' });
    } catch (error) {
        console.error('删除成员失败:', error);
        res.status(500).json({ code: 500, message: '删除成员失败' });
    } finally {
        connection.release();
    }
});

function normalizePermissions(role, permissions) {
    if (Array.isArray(permissions) && permissions.length) {
        return permissions.map((item) => String(item).trim()).filter(Boolean);
    }

    return DEFAULT_PERMISSIONS[role] || [];
}

function parsePermissions(value, role) {
    if (!value) {
        return DEFAULT_PERMISSIONS[role] || [];
    }

    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : DEFAULT_PERMISSIONS[role] || [];
    } catch (_error) {
        return DEFAULT_PERMISSIONS[role] || [];
    }
}

module.exports = router;
