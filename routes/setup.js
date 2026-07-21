const fs = require('fs');
const path = require('path');
const express = require('express');
const mysql = require('mysql2/promise');
const { spawnSync } = require('child_process');

const router = express.Router();
const projectRoot = path.join(__dirname, '..');
const envPath = path.join(projectRoot, '.env');
const setupScriptPath = path.join(projectRoot, 'scripts', 'setup-install.js');

router.get('/status', (_req, res) => {
    res.json({
        code: 200,
        data: {
            setup_required: Boolean(_req.app.get('setupRequired')),
            setup_error: _req.app.get('setupError') || '',
            env_exists: fs.existsSync(envPath)
        }
    });
});

router.post('/test-db', async (req, res) => {
    let connection;
    try {
        const config = normalizeSetupPayload(req.body);
        connection = await mysql.createConnection({
            host: config.dbHost,
            port: config.dbPort,
            user: config.dbUser,
            password: config.dbPassword,
            multipleStatements: true
        });

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await connection.changeUser({ database: config.dbName });
        await connection.query('SELECT 1');

        res.json({ code: 200, message: '数据库连接成功' });
    } catch (error) {
        res.status(400).json({ code: 400, message: error.message || '数据库连接失败' });
    } finally {
        await connection?.end().catch(() => {});
    }
});

router.post('/install', async (req, res) => {
    try {
        const config = normalizeSetupPayload(req.body);
        const result = spawnSync(process.execPath, [setupScriptPath], {
            cwd: projectRoot,
            env: {
                ...process.env,
                SETUP_CONFIG_JSON: JSON.stringify(config)
            },
            encoding: 'utf8'
        });

        if (result.status !== 0) {
            const message = result.stderr?.trim() || result.stdout?.trim() || '安装失败';
            return res.status(500).json({ code: 500, message });
        }

        res.json({
            code: 200,
            message: '安装完成，请重启服务后进入后台登录',
            data: {
                restart_required: true
            }
        });
    } catch (error) {
        res.status(500).json({ code: 500, message: error.message || '安装失败' });
    }
});

function normalizeSetupPayload(body) {
    const storageMode = body.storage_mode === 'qiniu' ? 'qiniu' : 'local';
    return {
        publicBaseUrl: String(body.public_base_url || '').trim(),
        dbHost: String(body.db_host || '127.0.0.1').trim(),
        dbPort: Number(body.db_port || 3306),
        dbName: String(body.db_name || 'photo_live').trim(),
        dbUser: String(body.db_user || 'root').trim(),
        dbPassword: String(body.db_password || ''),
        jwtSecret: String(body.jwt_secret || '').trim(),
        storageMode,
        qiniuAccessKey: String(body.qiniu_access_key || '').trim(),
        qiniuSecretKey: String(body.qiniu_secret_key || '').trim(),
        qiniuBucket: String(body.qiniu_bucket || '').trim(),
        qiniuDomain: String(body.qiniu_domain || '').trim(),
        qiniuZone: String(body.qiniu_zone || 'Zone_z0').trim(),
        adminUsername: String(body.admin_username || 'admin').trim(),
        adminPassword: String(body.admin_password || 'admin123').trim(),
        adminNickname: String(body.admin_nickname || '系统管理员').trim()
    };
}

module.exports = router;
