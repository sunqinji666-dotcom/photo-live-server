#!/usr/bin/env node

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const { readImageMetadata, readRemoteImageMetadata } = require('../middleware/imageProcessor');
const { resolveLocalPathFromUrl } = require('../lib/storage');

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const where = [];
    const params = [];

    if (options.liveId) {
        where.push('live_id = ?');
        params.push(options.liveId);
    }

    if (options.photoId) {
        where.push('id = ?');
        params.push(options.photoId);
    }

    const [rows] = await pool.query(
        `SELECT id, live_id, title, original_url, exif_data
         FROM photos
         ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
         ORDER BY id ASC`
        ,
        params
    );

    console.log(`准备检查 ${rows.length} 张照片`);

    let updated = 0;
    for (const row of rows) {
        const currentExif = typeof row.exif_data === 'string'
            ? safeJsonParse(row.exif_data, {})
            : row.exif_data || {};

        if (hasUsefulExif(currentExif) && !options.force) {
            continue;
        }

        try {
            const metadata = await loadMetadata(row.original_url);
            const payload = {
                ...currentExif,
                ...metadata
            };

            await pool.query(
                `UPDATE photos
                 SET exif_data = ?, width = ?, height = ?
                 WHERE id = ?`,
                [
                    JSON.stringify(payload),
                    payload.width || 0,
                    payload.height || 0,
                    row.id
                ]
            );

            updated += 1;
            console.log(`已更新 #${row.id} ${row.title || ''}`.trim());
        } catch (error) {
            console.error(`跳过 #${row.id}: ${error.message}`);
        }
    }

    console.log(`完成，更新 ${updated} 张照片`);
    await pool.end();
}

async function loadMetadata(originalUrl) {
    const localPath = resolveLocalPathFromUrl(originalUrl);
    if (localPath && fs.existsSync(path.resolve(localPath))) {
        return readImageMetadata(path.resolve(localPath));
    }
    return readRemoteImageMetadata(originalUrl);
}

function hasUsefulExif(exif) {
    return Boolean(exif && (exif.camera || exif.aperture || exif.shutterSpeed || exif.iso || exif.focalLength));
}

function parseArgs(args) {
    return args.reduce((result, arg) => {
        if (arg.startsWith('--live=')) {
            result.liveId = Number(arg.slice(7)) || null;
        } else if (arg.startsWith('--photo=')) {
            result.photoId = Number(arg.slice(8)) || null;
        } else if (arg === '--force') {
            result.force = true;
        }
        return result;
    }, {
        liveId: null,
        photoId: null,
        force: false
    });
}

function safeJsonParse(input, fallback) {
    try {
        return JSON.parse(input);
    } catch (_error) {
        return fallback;
    }
}

main().catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
});
