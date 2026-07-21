const crypto = require('crypto');
const geoip = require('geoip-lite');
const UAParser = require('ua-parser-js');

function getClientIp(req) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map((item) => item.trim()).filter(Boolean);
    const rawIp = forwarded[0] || req.ip || req.socket?.remoteAddress || '';
    return normalizeIp(rawIp);
}

function normalizeIp(value) {
    const ip = String(value || '').trim();
    if (!ip) {
        return '';
    }
    if (ip.startsWith('::ffff:')) {
        return ip.slice(7);
    }
    return ip;
}

function buildViewerContext(req) {
    const ipAddress = getClientIp(req);
    const userAgent = String(req.headers['user-agent'] || '').trim();
    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();
    const geo = lookupGeo(ipAddress);
    const deviceType = normalizeDeviceType(device.type);
    const deviceName = [device.vendor, device.model].filter(Boolean).join(' ').trim() || deviceType;
    const browserName = [browser.name, browser.version].filter(Boolean).join(' ').trim() || '未知浏览器';
    const osName = [os.name, os.version].filter(Boolean).join(' ').trim() || '未知系统';

    return {
        ip_address: ipAddress,
        user_agent: userAgent,
        visitor_key: buildVisitorKey(ipAddress, userAgent),
        device_type: deviceType,
        device_name: deviceName,
        browser_name: browserName,
        os_name: osName,
        country_name: geo.country_name,
        province_name: geo.province_name,
        city_name: geo.city_name
    };
}

function lookupGeo(ipAddress) {
    if (!ipAddress || isPrivateIp(ipAddress)) {
        return {
            country_name: '',
            province_name: '',
            city_name: ''
        };
    }

    const result = geoip.lookup(ipAddress);
    if (!result) {
        return {
            country_name: '',
            province_name: '',
            city_name: ''
        };
    }

    return {
        country_name: result.country || '',
        province_name: result.region || '',
        city_name: result.city || ''
    };
}

function normalizeDeviceType(value) {
    if (!value) {
        return 'desktop';
    }
    if (value === 'smarttv') {
        return 'tv';
    }
    return value;
}

function buildVisitorKey(ipAddress, userAgent) {
    return crypto.createHash('sha1').update(`${ipAddress}::${userAgent}`).digest('hex');
}

async function recordViewerEvent(pool, { req, liveId, photoId = null, eventType }) {
    const context = buildViewerContext(req);
    const dedupeParams = [eventType, Number(liveId), context.visitor_key];
    let dedupeSql = `
        SELECT id
        FROM viewer_events
        WHERE event_type = ?
          AND live_id = ?
          AND visitor_key = ?
    `;

    if (photoId) {
        dedupeSql += ' AND photo_id = ?';
        dedupeParams.push(Number(photoId));
    } else {
        dedupeSql += ' AND photo_id IS NULL';
    }

    dedupeSql += ' AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE) LIMIT 1';

    const [existingRows] = await pool.query(dedupeSql, dedupeParams);
    if (existingRows[0]) {
        return { inserted: false, context };
    }

    await pool.query(
        `INSERT INTO viewer_events
        (live_id, photo_id, event_type, visitor_key, ip_address, user_agent, device_type, device_name, browser_name, os_name, country_name, province_name, city_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            Number(liveId),
            photoId ? Number(photoId) : null,
            eventType,
            context.visitor_key,
            context.ip_address,
            context.user_agent,
            context.device_type,
            context.device_name,
            context.browser_name,
            context.os_name,
            context.country_name,
            context.province_name,
            context.city_name
        ]
    );

    return { inserted: true, context };
}

async function startViewerSession(pool, { req, liveId, entryPath = '' }) {
    const context = buildViewerContext(req);
    const [result] = await pool.query(
        `INSERT INTO viewer_sessions
        (live_id, visitor_key, ip_address, user_agent, device_type, device_name, browser_name, os_name, country_name, province_name, city_name, entry_path, started_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
            Number(liveId),
            context.visitor_key,
            context.ip_address,
            context.user_agent,
            context.device_type,
            context.device_name,
            context.browser_name,
            context.os_name,
            context.country_name,
            context.province_name,
            context.city_name,
            String(entryPath || '').slice(0, 255)
        ]
    );

    return {
        sessionId: result.insertId,
        context
    };
}

async function endViewerSession(pool, { sessionId, exitPath = '', lastPhotoId = null, durationSeconds = 0 }) {
    await pool.query(
        `UPDATE viewer_sessions
         SET exit_path = ?,
             last_photo_id = ?,
             duration_seconds = ?,
             ended_at = COALESCE(ended_at, NOW())
         WHERE id = ?
         LIMIT 1`,
        [
            String(exitPath || '').slice(0, 255),
            lastPhotoId ? Number(lastPhotoId) : null,
            Math.max(0, Number(durationSeconds || 0)),
            Number(sessionId)
        ]
    );
}

function isPrivateIp(ipAddress) {
    return /^127\./.test(ipAddress)
        || /^10\./.test(ipAddress)
        || /^192\.168\./.test(ipAddress)
        || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ipAddress)
        || ipAddress === '::1'
        || ipAddress === 'localhost';
}

function formatLocationLabel(row = {}) {
    return [row.country_name, row.province_name, row.city_name].filter(Boolean).join(' · ') || '未识别地区';
}

module.exports = {
    buildViewerContext,
    endViewerSession,
    formatLocationLabel,
    getClientIp,
    recordViewerEvent,
    startViewerSession
};
