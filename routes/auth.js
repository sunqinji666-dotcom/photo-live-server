const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { authenticateToken, generateToken, hashApiKey, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ code: 400, message: '请输入用户名和密码' });
        }

        const [users] = await pool.query(
            'SELECT id, username, password, nickname, role, avatar FROM users WHERE username = ? LIMIT 1',
            [username]
        );

        const user = users[0];
        if (!user) {
            return res.status(401).json({ code: 401, message: '用户名或密码错误' });
        }

        const matched = await bcrypt.compare(password, user.password);
        if (!matched) {
            return res.status(401).json({ code: 401, message: '用户名或密码错误' });
        }

        res.json({
            code: 200,
            data: {
                token: generateToken(user),
                user: {
                    id: user.id,
                    username: user.username,
                    nickname: user.nickname,
                    role: user.role,
                    avatar: user.avatar || ''
                }
            }
        });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ code: 500, message: '登录失败，请稍后重试' });
    }
});

router.get('/me', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.query(
            'SELECT id, username, nickname, role, avatar, created_at FROM users WHERE id = ? LIMIT 1',
            [req.user.id]
        );

        if (!users[0]) {
            return res.status(404).json({ code: 404, message: '用户不存在' });
        }

        res.json({ code: 200, data: users[0] });
    } catch (error) {
        console.error('获取用户信息失败:', error);
        res.status(500).json({ code: 500, message: '获取用户信息失败' });
    }
});

router.put('/password', authenticateToken, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword || newPassword.length < 6) {
            return res.status(400).json({ code: 400, message: '请输入正确的旧密码和至少 6 位的新密码' });
        }

        const [users] = await pool.query('SELECT password FROM users WHERE id = ? LIMIT 1', [req.user.id]);
        const current = users[0];
        if (!current) {
            return res.status(404).json({ code: 404, message: '用户不存在' });
        }

        const matched = await bcrypt.compare(oldPassword, current.password);
        if (!matched) {
            return res.status(401).json({ code: 401, message: '旧密码错误' });
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

        res.json({ code: 200, message: '密码修改成功' });
    } catch (error) {
        console.error('修改密码失败:', error);
        res.status(500).json({ code: 500, message: '修改密码失败' });
    }
});

router.post('/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { username, password, nickname, role } = req.body;
        if (!username || !password || !nickname || !['admin', 'photographer'].includes(role)) {
            return res.status(400).json({ code: 400, message: '请填写完整的用户信息' });
        }

        const hashed = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (username, password, nickname, role) VALUES (?, ?, ?, ?)',
            [username, hashed, nickname, role]
        );

        res.status(201).json({ code: 200, message: '账号创建成功' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ code: 400, message: '用户名已存在' });
        }

        console.error('创建账号失败:', error);
        res.status(500).json({ code: 500, message: '创建账号失败' });
    }
});

router.get('/users', authenticateToken, requireAdmin, async (_req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, username, nickname, role, avatar, created_at
             FROM users
             ORDER BY created_at DESC, id DESC`
        );

        res.json({ code: 200, data: rows });
    } catch (error) {
        console.error('获取账号列表失败:', error);
        res.status(500).json({ code: 500, message: '获取账号列表失败' });
    }
});

router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const userId = Number(req.params.id);
        if (!userId) {
            return res.status(400).json({ code: 400, message: '账号编号不正确' });
        }

        if (userId === Number(req.user.id)) {
            return res.status(400).json({ code: 400, message: '不能删除当前登录账号' });
        }

        const [rows] = await pool.query('SELECT id, username, nickname FROM users WHERE id = ? LIMIT 1', [userId]);
        if (!rows[0]) {
            return res.status(404).json({ code: 404, message: '账号不存在' });
        }

        await pool.query('DELETE FROM users WHERE id = ?', [userId]);
        res.json({ code: 200, message: '账号已删除' });
    } catch (error) {
        console.error('删除账号失败:', error);
        res.status(500).json({ code: 500, message: '删除账号失败' });
    }
});

router.get('/api-keys', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, name, token_prefix, status, last_used_at, expires_at, created_at
             FROM api_keys
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [req.user.id]
        );

        res.json({ code: 200, data: rows });
    } catch (error) {
        console.error('获取 API Key 列表失败:', error);
        res.status(500).json({ code: 500, message: '获取 API Key 列表失败' });
    }
});

router.post('/api-keys', authenticateToken, async (req, res) => {
    try {
        const name = String(req.body.name || '').trim() || 'CLI Access';
        const expiresInDays = Number(req.body.expiresInDays || 0);
        const token = `plk_${crypto.randomBytes(24).toString('base64url')}`;
        const tokenPrefix = token.slice(0, 16);
        const tokenHash = hashApiKey(token);
        const expiresAt = expiresInDays > 0
            ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
            : null;

        const [result] = await pool.query(
            `INSERT INTO api_keys (user_id, name, token_prefix, token_hash, expires_at)
             VALUES (?, ?, ?, ?, ?)`,
            [req.user.id, name.slice(0, 120), tokenPrefix, tokenHash, expiresAt]
        );

        res.status(201).json({
            code: 200,
            data: {
                id: result.insertId,
                name: name.slice(0, 120),
                token,
                token_prefix: tokenPrefix,
                expires_at: expiresAt
            }
        });
    } catch (error) {
        console.error('创建 API Key 失败:', error);
        res.status(500).json({ code: 500, message: '创建 API Key 失败' });
    }
});

router.delete('/api-keys/:id', authenticateToken, async (req, res) => {
    try {
        const keyId = Number(req.params.id);
        if (!keyId) {
            return res.status(400).json({ code: 400, message: 'API Key 编号不正确' });
        }

        const [result] = await pool.query(
            `UPDATE api_keys
             SET status = 'revoked', updated_at = NOW()
             WHERE id = ? AND user_id = ? AND status = 'active'`,
            [keyId, req.user.id]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ code: 404, message: 'API Key 不存在或已停用' });
        }

        res.json({ code: 200, message: 'API Key 已停用' });
    } catch (error) {
        console.error('停用 API Key 失败:', error);
        res.status(500).json({ code: 500, message: '停用 API Key 失败' });
    }
});

module.exports = router;
