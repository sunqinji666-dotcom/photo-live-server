const fs = require('fs');
const http = require('http');
const https = require('https');
const exifReader = require('exif-reader');
const sharp = require('sharp');

function deleteTempFile(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error('删除临时文件失败:', error.message);
    }
}

async function readImageMetadata(input) {
    const metadata = await sharp(input).metadata();
    return normalizeImageMetadata(metadata);
}

async function readRemoteImageMetadata(url) {
    const buffer = await downloadRemoteBuffer(url);
    return readImageMetadata(buffer);
}

function normalizeImageMetadata(metadata) {
    const exif = extractExifSummary(metadata.exif);
    return {
        width: metadata.width || 0,
        height: metadata.height || 0,
        format: metadata.format || '',
        space: metadata.space || '',
        channels: metadata.channels || 0,
        depth: metadata.depth || '',
        hasAlpha: metadata.hasAlpha || false,
        orientation: metadata.orientation || 1,
        ...exif
    };
}

function extractExifSummary(exifBuffer) {
    if (!exifBuffer) {
        return {};
    }

    try {
        const parsed = exifReader(exifBuffer);
        const image = parsed.Image || {};
        const photo = parsed.Photo || {};
        const make = cleanExifText(image.Make);
        const model = cleanExifText(image.Model);
        const lens = cleanExifText(photo.LensModel || photo.LensSpecification);
        const camera = buildCameraLabel(make, model);
        const iso = photo.ISO || photo.ISOSpeedRatings || photo.RecommendedExposureIndex || null;
        const aperture = formatAperture(photo.FNumber);
        const shutterSpeed = formatShutterSpeed(photo.ExposureTime);
        const focalLength = formatFocalLength(photo.FocalLength);

        return compactObject({
            make,
            model,
            camera,
            lens,
            iso,
            aperture,
            shutterSpeed,
            focalLength,
            takenAt: cleanExifText(photo.DateTimeOriginal || photo.DateTimeDigitized || image.DateTime),
            Make: make,
            Model: model,
            LensModel: lens
        });
    } catch (error) {
        console.warn('读取 EXIF 失败:', error.message);
        return {};
    }
}

function buildCameraLabel(make, model) {
    if (!make && !model) {
        return '';
    }

    if (!make) {
        return model;
    }

    if (!model) {
        return make;
    }

    const lowerMake = String(make).toLowerCase();
    const lowerModel = String(model).toLowerCase();
    if (lowerModel.startsWith(lowerMake)) {
        return model;
    }
    return `${make} ${model}`.trim();
}

function cleanExifText(value) {
    if (Array.isArray(value)) {
        value = value.join(' ');
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Buffer.isBuffer(value)) {
        value = value.toString('utf8');
    }

    return String(value || '')
        .replace(/\0/g, '')
        .trim();
}

function formatAperture(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return '';
    }
    return `f/${trimNumber(numeric)}`;
}

function formatShutterSpeed(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return '';
    }

    if (numeric >= 1) {
        return `${trimNumber(numeric)}s`;
    }

    const denominator = Math.round(1 / numeric);
    if (Number.isFinite(denominator) && denominator > 0) {
        return `1/${denominator}s`;
    }

    return `${trimNumber(numeric)}s`;
}

function formatFocalLength(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return '';
    }
    return `${trimNumber(numeric)}mm`;
}

function trimNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '';
    }
    if (Number.isInteger(numeric)) {
        return String(numeric);
    }
    return String(Math.round(numeric * 10) / 10);
}

function compactObject(input) {
    return Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
}

function downloadRemoteBuffer(url, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        const client = String(url).startsWith('https://') ? https : http;
        const request = client.get(url, (response) => {
            const statusCode = Number(response.statusCode || 0);

            if ([301, 302, 303, 307, 308].includes(statusCode) && response.headers.location && redirectCount < 3) {
                response.resume();
                resolve(downloadRemoteBuffer(new URL(response.headers.location, url).toString(), redirectCount + 1));
                return;
            }

            if (statusCode < 200 || statusCode >= 300) {
                response.resume();
                reject(new Error(`远程图片读取失败: HTTP ${statusCode}`));
                return;
            }

            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        });

        request.setTimeout(15000, () => {
            request.destroy(new Error('远程图片读取超时'));
        });
        request.on('error', reject);
    });
}

async function buildImageVariants(filePath, options = {}) {
    const {
        maxWidth = Number(process.env.IMAGE_MAX_WIDTH) || 2200,
        compressedQuality = Number(process.env.IMAGE_COMPRESS_QUALITY) || 82,
        thumbnailWidth = Number(process.env.IMAGE_THUMBNAIL_WIDTH) || 520,
        thumbnailHeight = Number(process.env.IMAGE_THUMBNAIL_HEIGHT) || 520,
        watermarkText = '',
        watermarkEnabled = false
    } = options;

    const baseImage = sharp(filePath);
    const metadata = await readImageMetadata(filePath);
    const originalBuffer = await fs.promises.readFile(filePath);

    const resized = metadata.width > maxWidth
        ? baseImage.resize({ width: maxWidth, withoutEnlargement: true })
        : baseImage.clone();

    const compressedBuffer = await resized
        .clone()
        .webp({ quality: compressedQuality })
        .toBuffer();

    const thumbnailBuffer = await baseImage
        .clone()
        .resize(thumbnailWidth, thumbnailHeight, { fit: 'cover', position: 'attention' })
        .webp({ quality: 76 })
        .toBuffer();

    let watermarkedBuffer = compressedBuffer;
    if (watermarkEnabled && watermarkText.trim()) {
        const compressedMetadata = await sharp(compressedBuffer).metadata();
        const overlay = buildWatermarkSvg({
            width: compressedMetadata.width || metadata.width || 1600,
            height: compressedMetadata.height || metadata.height || 900,
            text: watermarkText.trim()
        });

        watermarkedBuffer = await sharp(compressedBuffer)
            .composite([{ input: Buffer.from(overlay), gravity: 'southeast' }])
            .webp({ quality: compressedQuality })
            .toBuffer();
    }

    return {
        metadata,
        originalBuffer,
        compressedBuffer,
        thumbnailBuffer,
        watermarkedBuffer
    };
}

function buildWatermarkSvg({ width, height, text }) {
    const fontSize = Math.max(20, Math.round(Math.min(width, height) * 0.035));
    const padding = Math.max(20, Math.round(width * 0.02));
    const boxWidth = Math.min(Math.max(220, Math.round(width * 0.28)), Math.max(220, width - padding * 2));
    const boxHeight = Math.max(48, Math.round(fontSize * 2));
    const rectX = Math.max(padding, width - boxWidth - padding);
    const rectY = Math.max(padding, height - boxHeight - padding);
    const textX = rectX + boxWidth / 2;
    const textY = rectY + boxHeight / 2 + fontSize * 0.35;
    return `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="shadow">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.5)" />
                </filter>
            </defs>
            <g filter="url(#shadow)">
                <rect x="${rectX}" y="${rectY}" width="${boxWidth}" height="${boxHeight}" rx="18" fill="rgba(0,0,0,0.22)" />
                <text
                    x="${textX}"
                    y="${textY}"
                    fill="rgba(255,255,255,0.88)"
                    font-size="${fontSize}"
                    text-anchor="middle"
                    font-family="PingFang SC, Microsoft YaHei, sans-serif"
                >${escapeXml(text)}</text>
            </g>
        </svg>
    `;
}

function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

module.exports = {
    buildImageVariants,
    deleteTempFile,
    readImageMetadata,
    readRemoteImageMetadata
};
