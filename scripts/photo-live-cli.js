#!/usr/bin/env node

require('dotenv').config();

const DEFAULT_SERVER = process.env.PHOTO_LIVE_SERVER || 'http://zhibo.jack-sun.com';

async function main() {
    const args = process.argv.slice(2);
    const [group, action] = args;
    const options = parseOptions(args.slice(2));

    if (!group || group === 'help' || options.help) {
        printHelp();
        return;
    }

    if (group === 'auth' && action === 'create-key') {
        await handleCreateApiKey(options);
        return;
    }

    if (group === 'auth' && action === 'whoami') {
        const data = await request('/api/auth/me', { apiKey: readApiKey(options) });
        printJson(data.data);
        return;
    }

    if (group === 'lives' && action === 'list') {
        const data = await request('/api/lives/admin/list', { apiKey: readApiKey(options) });
        printJson(data.data);
        return;
    }

    if (group === 'lives' && action === 'create') {
        const title = String(options.title || '').trim();
        if (!title) {
            throw new Error('缺少 --title');
        }

        const payload = {
            title,
            event_date: options.date || null,
            location_name: options.location || '',
            status: options.status || 'draft'
        };

        const data = await request('/api/lives', {
            apiKey: readApiKey(options),
            method: 'POST',
            body: payload
        });
        printJson(data.data);
        return;
    }

    if (group === 'cleanup' && action === 'run') {
        const data = await request('/api/maintenance/cleanup-jobs', {
            apiKey: readApiKey(options),
            method: 'POST'
        });
        printJson(data.data);
        return;
    }

    if (group === 'cleanup' && action === 'status') {
        const jobId = Number(options.job || options.id || 0);
        if (!jobId) {
            throw new Error('缺少 --job');
        }

        const data = await request(`/api/maintenance/cleanup-jobs/${jobId}`, {
            apiKey: readApiKey(options)
        });
        printJson(data.data);
        return;
    }

    throw new Error('不支持的命令，使用 help 查看示例');
}

async function handleCreateApiKey(options) {
    const username = String(options.username || '').trim();
    const password = String(options.password || '').trim();
    const server = readServer(options);

    if (!username || !password) {
        throw new Error('缺少 --username 或 --password');
    }

    const login = await request('/api/auth/login', {
        server,
        method: 'POST',
        body: { username, password }
    });

    const result = await request('/api/auth/api-keys', {
        server,
        token: login.data.token,
        method: 'POST',
        body: {
            name: options.name || 'CLI Access',
            expiresInDays: Number(options.days || 0)
        }
    });

    printJson({
        server,
        api_key: result.data.token,
        token_prefix: result.data.token_prefix,
        expires_at: result.data.expires_at || null
    });
}

async function request(path, { server, apiKey, token, method = 'GET', body } = {}) {
    const target = `${readServer({ server }).replace(/\/$/, '')}${path}`;
    const headers = {};

    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(target, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.message || `请求失败: ${response.status}`);
    }

    return data;
}

function readApiKey(options) {
    const apiKey = String(options.apiKey || options.api_key || process.env.PHOTO_LIVE_API_KEY || '').trim();
    if (!apiKey) {
        throw new Error('缺少 API Key，请传 --api-key 或设置 PHOTO_LIVE_API_KEY');
    }
    return apiKey;
}

function readServer(options) {
    return String(options.server || DEFAULT_SERVER).trim();
}

function parseOptions(args) {
    const result = {};
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (!arg.startsWith('--')) {
            continue;
        }

        const stripped = arg.slice(2);
        const equalIndex = stripped.indexOf('=');
        if (equalIndex >= 0) {
            const key = toCamelCase(stripped.slice(0, equalIndex));
            result[key] = stripped.slice(equalIndex + 1);
            continue;
        }

        const key = toCamelCase(stripped);
        const next = args[index + 1];
        if (!next || next.startsWith('--')) {
            result[key] = true;
            continue;
        }

        result[key] = next;
        index += 1;
    }

    return result;
}

function toCamelCase(input) {
    return String(input || '').replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function printJson(data) {
    process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function printHelp() {
    process.stdout.write(`
photo-live CLI

用法：
  node scripts/photo-live-cli.js auth create-key --username admin --password admin123 --name "Codex CLI"
  PHOTO_LIVE_API_KEY=plk_xxx node scripts/photo-live-cli.js auth whoami
  PHOTO_LIVE_API_KEY=plk_xxx node scripts/photo-live-cli.js lives list
  PHOTO_LIVE_API_KEY=plk_xxx node scripts/photo-live-cli.js lives create --title "新相册" --date "2026-04-04 10:00:00" --location "南宁"
  PHOTO_LIVE_API_KEY=plk_xxx node scripts/photo-live-cli.js cleanup run
  PHOTO_LIVE_API_KEY=plk_xxx node scripts/photo-live-cli.js cleanup status --job 2

可选参数：
  --server http://zhibo.jack-sun.com
  --api-key plk_xxx
`.trim() + '\n');
}

main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
});
