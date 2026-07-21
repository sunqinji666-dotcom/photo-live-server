const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const LIVE_ACCESS_AUDIENCE = 'photo-live-viewer';

function readToken(req) {
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    return null;
}

function readApiKey(req) {
    const headerKey = String(req.headers['x-api-key'] || '').trim();
    if (headerKey) {
        return headerKey;
    }

    const bearer = readToken(req);
    if (bearer && bearer.startsWith('plk_')) {
        return bearer;
    }

    return '';
}

function readLiveAccessToken(req) {
    return req.headers['x-live-access'] || '';
}

async function authenticateToken(req, res, next) {
    const token = readToken(req);

    if (token && !token.startsWith('plk_')) {
        try {
            req.user = jwt.verify(token, JWT_SECRET);
            return next();
        } catch (error) {
            return res.status(403).json({ code: 403, message: '认证令牌无效或已过期' });
        }
    }

    try {
        const apiKey = readApiKey(req);
        if (!apiKey) {
            return res.status(401).json({ code: 401, message: '未登录或登录已失效' });
        }

        const user = await findUserByApiKey(apiKey);
        if (!user) {
            return res.status(403).json({ code: 403, message: 'API Key 无效、已停用或已过期' });
        }

        req.user = user;
        return next();
    } catch (error) {
        return res.status(500).json({ code: 500, message: '认证失败，请稍后重试' });
    }
}

async function optionalAuth(req, _res, next) {
    const token = readToken(req);

    if (token && !token.startsWith('plk_')) {
        try {
            req.user = jwt.verify(token, JWT_SECRET);
            return next();
        } catch (_error) {
            req.user = null;
            return next();
        }
    }

    const apiKey = readApiKey(req);
    if (!apiKey) {
        return next();
    }

    try {
        req.user = await findUserByApiKey(apiKey);
    } catch (_error) {
        req.user = null;
    }

    return next();
}

function requireRoles(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ code: 403, message: '权限不足' });
        }
        next();
    };
}

function generateToken(user) {
    return jwt.sign(
        {
            id: user.id,
            username: user.username,
            nickname: user.nickname,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

function generateLiveAccessToken(liveId) {
    return jwt.sign(
        {
            type: 'live-access',
            liveId: Number(liveId)
        },
        JWT_SECRET,
        {
            audience: LIVE_ACCESS_AUDIENCE,
            expiresIn: process.env.LIVE_ACCESS_EXPIRES_IN || '12h'
        }
    );
}

function verifyLiveAccessToken(token, liveId) {
    if (!token) {
        return false;
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET, {
            audience: LIVE_ACCESS_AUDIENCE
        });
        return payload.type === 'live-access' && Number(payload.liveId) === Number(liveId);
    } catch (_error) {
        return false;
    }
}

function hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(String(apiKey || '')).digest('hex');
}

async function findUserByApiKey(apiKey) {
    const tokenHash = hashApiKey(apiKey);
    const [rows] = await pool.query(
        `SELECT
            u.id,
            u.username,
            u.nickname,
            u.role,
            u.avatar,
            k.id AS api_key_id
         FROM api_keys k
         INNER JOIN users u ON u.id = k.user_id
         WHERE k.token_hash = ?
           AND k.status = 'active'
           AND (k.expires_at IS NULL OR k.expires_at > NOW())
         LIMIT 1`,
        [tokenHash]
    );

    const user = rows[0] || null;
    if (!user) {
        return null;
    }

    await pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = ?', [user.api_key_id]);
    delete user.api_key_id;
    return user;
}

module.exports = {
    authenticateToken,
    generateToken,
    generateLiveAccessToken,
    hashApiKey,
    optionalAuth,
    readLiveAccessToken,
    requireAdmin: requireRoles('admin'),
    requirePhotographer: requireRoles('admin', 'photographer'),
    requireRoles,
    verifyLiveAccessToken
};
