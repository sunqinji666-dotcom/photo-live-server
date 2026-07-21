require('dotenv').config();

const fs = require('fs');
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const socketIo = require('socket.io');

const { ensureSchema, testConnection } = require('./config/database');
const { ensureUploadRoot } = require('./lib/storage');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: true,
        credentials: true
    }
});

app.set('io', io);
app.set('trust proxy', true);

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const uploadsStaticOptions = {
    etag: true,
    maxAge: '7d'
};

const assetStaticOptions = {
    etag: true,
    immutable: true,
    maxAge: '30d'
};

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), uploadsStaticOptions));
app.use('/assets', express.static(path.join(__dirname, 'public', 'shared'), assetStaticOptions));
app.use('/admin-assets', express.static(path.join(__dirname, 'public', 'admin'), assetStaticOptions));
app.use('/live-assets', express.static(path.join(__dirname, 'public', 'live'), assetStaticOptions));
app.use('/setup-assets', express.static(path.join(__dirname, 'public', 'setup'), assetStaticOptions));

app.use('/api/setup', require('./routes/setup'));

app.use((req, res, next) => {
    if (!app.get('setupRequired')) {
        return next();
    }

    const allowed = req.path === '/setup'
        || req.path.startsWith('/setup-assets')
        || req.path.startsWith('/api/setup')
        || req.path.startsWith('/assets');

    if (allowed) {
        return next();
    }

    if (req.path.startsWith('/api/')) {
        return res.status(503).json({
            code: 503,
            message: '系统尚未完成安装，请先打开 /setup 完成安装向导'
        });
    }

    return res.redirect('/setup');
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/photos', require('./routes/photos'));
app.use('/api/lives', require('./routes/lives'));
app.use('/api/albums', require('./routes/albums'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/members', require('./routes/members'));
app.use('/api/maintenance', require('./routes/maintenance'));

app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        storageMode: process.env.STORAGE_MODE || 'local'
    });
});

app.get('/admin', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.type('html').send(renderManagedHtml(path.join(__dirname, 'public', 'admin', 'index.html'), 'admin'));
});

app.get('/setup', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, 'public', 'setup', 'index.html'));
});

app.get('/live/:slug', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.type('html').send(renderManagedHtml(path.join(__dirname, 'public', 'live', 'index.html'), 'live'));
});

app.get('/', (_req, res) => {
    res.redirect('/admin');
});

app.get('/favicon.ico', (_req, res) => {
    res.status(204).end();
});

app.use((err, _req, res, _next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        code: 500,
        message: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误'
    });
});

io.on('connection', (socket) => {
    socket.on('join-live', (liveId) => {
        socket.join(`live-${liveId}`);
    });
});

const PORT = Number(process.env.PORT) || 3000;

function readAssetManifest() {
    try {
        const raw = fs.readFileSync(path.join(__dirname, 'public', 'asset-manifest.json'), 'utf8');
        return JSON.parse(raw);
    } catch (_error) {
        return {};
    }
}

function renderManagedHtml(filePath, target) {
    let html = fs.readFileSync(filePath, 'utf8');
    const manifest = readAssetManifest();
    const entry = manifest[target] || {};

    if (target === 'admin') {
        html = html
            .replace(/<link rel="stylesheet" href="\/admin-assets\/[^"]+">/, `<link rel="stylesheet" href="${entry.style || '/admin-assets/style.css'}">`)
            .replace(/<script src="\/admin-assets\/[^"]+"><\/script>/, `<script src="${entry.script || '/admin-assets/app.js'}"></script>`);
    }

    if (target === 'live') {
        html = html
            .replace(/<link rel="stylesheet" href="\/live-assets\/[^"]+">/, `<link rel="stylesheet" href="${entry.style || '/live-assets/style.css'}">`)
            .replace(/<script src="\/live-assets\/[^"]+"><\/script>/, `<script src="${entry.script || '/live-assets/app.js'}"></script>`);
    }

    return html;
}

async function startServer() {
    try {
        ensureUploadRoot();
        try {
            await testConnection();
            await ensureSchema();
            app.set('setupRequired', false);
            app.set('setupError', '');
        } catch (error) {
            app.set('setupRequired', true);
            app.set('setupError', error.message || '数据库尚未配置');
            console.error('安装模式启动:', error.message);
        }

        server.listen(PORT, () => {
            console.log(`Photo Live Server: http://localhost:${PORT}`);
            console.log(`Admin: http://localhost:${PORT}/admin`);
            if (app.get('setupRequired')) {
                console.log(`Setup Wizard: http://localhost:${PORT}/setup`);
            }
        });
    } catch (error) {
        console.error('启动失败:', error);
        process.exit(1);
    }
}

startServer();

module.exports = { app, io };
