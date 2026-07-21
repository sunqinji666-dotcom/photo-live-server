const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function main() {
    const config = JSON.parse(process.env.SETUP_CONFIG_JSON || '{}');
    validateConfig(config);

    await ensureDatabase(config);
    writeEnvFile(config);

    Object.assign(process.env, {
        PORT: process.env.PORT || '3000',
        NODE_ENV: process.env.NODE_ENV || 'production',
        PUBLIC_BASE_URL: config.publicBaseUrl,
        DB_HOST: config.dbHost,
        DB_PORT: String(config.dbPort),
        DB_NAME: config.dbName,
        DB_USER: config.dbUser,
        DB_PASSWORD: config.dbPassword,
        JWT_SECRET: config.jwtSecret,
        STORAGE_MODE: config.storageMode,
        QINIU_ACCESS_KEY: config.qiniuAccessKey,
        QINIU_SECRET_KEY: config.qiniuSecretKey,
        QINIU_BUCKET: config.qiniuBucket,
        QINIU_DOMAIN: config.qiniuDomain,
        QINIU_ZONE: config.qiniuZone
    });

    const { ensureSchema, pool } = require('../config/database');
    await ensureSchema();
    await upsertAdmin(pool, config);
    await pool.end();
}

async function ensureDatabase(config) {
    const connection = await mysql.createConnection({
        host: config.dbHost,
        port: config.dbPort,
        user: config.dbUser,
        password: config.dbPassword,
        multipleStatements: true
    });
    try {
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } finally {
        await connection.end();
    }
}

function writeEnvFile(config) {
    const envPath = path.join(__dirname, '..', '.env');
    const lines = [
        `PORT=${process.env.PORT || 3000}`,
        `NODE_ENV=production`,
        `PUBLIC_BASE_URL=${escapeEnv(config.publicBaseUrl)}`,
        '',
        `DB_HOST=${escapeEnv(config.dbHost)}`,
        `DB_PORT=${config.dbPort}`,
        `DB_NAME=${escapeEnv(config.dbName)}`,
        `DB_USER=${escapeEnv(config.dbUser)}`,
        `DB_PASSWORD=${escapeEnv(config.dbPassword)}`,
        '',
        `JWT_SECRET=${escapeEnv(config.jwtSecret)}`,
        `JWT_EXPIRES_IN=7d`,
        '',
        `STORAGE_MODE=${escapeEnv(config.storageMode)}`,
        '',
        `QINIU_ACCESS_KEY=${escapeEnv(config.qiniuAccessKey)}`,
        `QINIU_SECRET_KEY=${escapeEnv(config.qiniuSecretKey)}`,
        `QINIU_BUCKET=${escapeEnv(config.qiniuBucket)}`,
        `QINIU_DOMAIN=${escapeEnv(config.qiniuDomain)}`,
        `QINIU_ZONE=${escapeEnv(config.qiniuZone)}`,
        '',
        `UPLOAD_MAX_SIZE=26214400`,
        `IMAGE_COMPRESS_QUALITY=76`,
        `IMAGE_MAX_WIDTH=1800`,
        `IMAGE_THUMBNAIL_WIDTH=420`,
        `IMAGE_THUMBNAIL_HEIGHT=420`
    ];
    fs.writeFileSync(envPath, `${lines.join('\n')}\n`, 'utf8');
}

async function upsertAdmin(pool, config) {
    const passwordHash = await bcrypt.hash(config.adminPassword, 10);
    const [rows] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [config.adminUsername]);
    if (rows[0]) {
        await pool.query(
            'UPDATE users SET password = ?, nickname = ?, role = ? WHERE id = ?',
            [passwordHash, config.adminNickname, 'admin', rows[0].id]
        );
        return;
    }

    await pool.query(
        'INSERT INTO users (username, password, nickname, role) VALUES (?, ?, ?, ?)',
        [config.adminUsername, passwordHash, config.adminNickname, 'admin']
    );
}

function validateConfig(config) {
    if (!config.publicBaseUrl) {
        throw new Error('请填写站点访问地址');
    }
    if (!config.dbHost || !config.dbName || !config.dbUser) {
        throw new Error('请填写完整的数据库信息');
    }
    if (!config.jwtSecret) {
        throw new Error('请填写 JWT 密钥');
    }
    if (!config.adminUsername || !config.adminPassword || !config.adminNickname) {
        throw new Error('请填写管理员信息');
    }
    if (config.storageMode === 'qiniu') {
        for (const field of ['qiniuAccessKey', 'qiniuSecretKey', 'qiniuBucket', 'qiniuDomain', 'qiniuZone']) {
            if (!config[field]) {
                throw new Error('七牛模式下请填写完整的七牛配置');
            }
        }
    }
}

function escapeEnv(value) {
    const text = String(value ?? '');
    if (!text) {
        return '';
    }
    if (/[\s#"']/u.test(text)) {
        return JSON.stringify(text);
    }
    return text;
}

main().catch((error) => {
    console.error(error.message || '安装失败');
    process.exit(1);
});
