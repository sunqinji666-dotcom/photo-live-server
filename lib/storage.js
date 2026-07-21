const fs = require('fs');
const path = require('path');
const qiniu = require('qiniu');

const uploadRoot = path.join(__dirname, '..', 'uploads');
const publicBaseUrl = process.env.PUBLIC_BASE_URL || '';
const storageMode = process.env.STORAGE_MODE || 'local';
const qiniuDomain = normalizeAbsoluteUrl(process.env.QINIU_DOMAIN || '');

const qiniuEnabled = storageMode === 'qiniu' && Boolean(
    process.env.QINIU_ACCESS_KEY &&
    process.env.QINIU_SECRET_KEY &&
    process.env.QINIU_BUCKET &&
    qiniuDomain
);

const zoneMap = {
    Zone_z0: qiniu.zone.Zone_z0,
    Zone_z1: qiniu.zone.Zone_z1,
    Zone_z2: qiniu.zone.Zone_z2,
    Zone_na0: qiniu.zone.Zone_na0,
    Zone_as0: qiniu.zone.Zone_as0
};

const uploadHostMap = {
    Zone_z0: 'https://up-z0.qiniup.com',
    Zone_z1: 'https://up-z1.qiniup.com',
    Zone_z2: 'https://up-z2.qiniup.com',
    Zone_na0: 'https://up-na0.qiniup.com',
    Zone_as0: 'https://up-as0.qiniup.com'
};

let formUploader;
let bucketManager;
let qiniuMac;
let qiniuConfig;
let operationManager;

if (qiniuEnabled) {
    qiniuConfig = new qiniu.conf.Config();
    qiniuConfig.zone = zoneMap[process.env.QINIU_ZONE] || qiniu.zone.Zone_z0;

    qiniuMac = new qiniu.auth.digest.Mac(process.env.QINIU_ACCESS_KEY, process.env.QINIU_SECRET_KEY);
    formUploader = new qiniu.form_up.FormUploader(qiniuConfig);
    bucketManager = new qiniu.rs.BucketManager(qiniuMac, qiniuConfig);
    operationManager = new qiniu.fop.OperationManager(qiniuMac, qiniuConfig);
}

function ensureDir(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalizeAbsoluteUrl(input) {
    const value = String(input || '').trim();
    if (!value) {
        return '';
    }

    if (/^https?:\/\//.test(value)) {
        return value.replace(/\/$/, '');
    }

    return `https://${value.replace(/\/$/, '')}`;
}

function normalizeUrl(url) {
    if (!url) {
        return '';
    }

    if (/^https?:\/\//.test(url)) {
        return url;
    }

    if (!publicBaseUrl) {
        return url;
    }

    return `${publicBaseUrl.replace(/\/$/, '')}${url}`;
}

function localUrlFromKey(key) {
    return normalizeUrl(`/uploads/${key}`);
}

function toUrlSafeBase64(value) {
    return Buffer.from(String(value || ''))
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function buildQiniuUrl(key, operations = '') {
    if (!qiniuDomain) {
        return '';
    }

    const encodedKey = encodeURI(String(key || '')).replace(/#/g, '%23');
    const base = `${qiniuDomain}/${encodedKey}`;
    if (!operations) {
        return base;
    }

    return `${base}${operations}`;
}

function buildQiniuImageUrls(key, options = {}) {
    const quality = Math.min(Math.max(Number(process.env.IMAGE_COMPRESS_QUALITY) || 76, 1), 100);
    const maxWidth = Math.max(Number(process.env.IMAGE_MAX_WIDTH) || 1800, 200);
    const thumbWidth = Math.max(Number(process.env.IMAGE_THUMBNAIL_WIDTH) || 420, 80);
    const thumbHeight = Math.max(Number(process.env.IMAGE_THUMBNAIL_HEIGHT) || 420, 80);
    const watermarkText = String(options.watermarkText || '').trim();

    const originalUrl = buildQiniuUrl(key);
    const compressedOps = `?imageView2/2/w/${maxWidth}/interlace/1/q/${quality}/format/webp`;
    const thumbnailOps = `?imageView2/1/w/${thumbWidth}/h/${thumbHeight}/m_fill/interlace/1/q/${quality}/format/webp`;
    let watermarkedOps = compressedOps;

    if (watermarkText) {
        watermarkedOps += `|watermark/2/text/${toUrlSafeBase64(watermarkText)}/fontsize/420/fill/${toUrlSafeBase64('#FFFFFF')}/dissolve/75/gravity/SouthEast/dx/28/dy/28`;
    }

    return {
        originalUrl,
        compressedUrl: buildQiniuUrl(key, compressedOps),
        thumbnailUrl: buildQiniuUrl(key, thumbnailOps),
        watermarkedUrl: buildQiniuUrl(key, watermarkedOps)
    };
}

function withQuery(url, queryPart) {
    if (!url) {
        return '';
    }

    return `${url}${url.includes('?') ? '&' : '?'}${queryPart}`;
}

function buildAttachmentUrl(url, fileName) {
    if (!url) {
        return '';
    }

    if (!fileName) {
        return url;
    }

    return withQuery(url, `attname=${encodeURIComponent(String(fileName))}`);
}

function extractQiniuKeyFromUrl(url) {
    if (!url || !qiniuDomain) {
        return '';
    }

    const [cleanUrl] = String(url).split(/[?#]/);
    if (!cleanUrl.startsWith(`${qiniuDomain}/`)) {
        return '';
    }

    return decodeURIComponent(cleanUrl.slice(qiniuDomain.length + 1));
}

function createQiniuUploadToken(key, options = {}) {
    if (!qiniuEnabled || !qiniuMac) {
        throw new Error('七牛直传尚未配置完成');
    }

    const putPolicy = new qiniu.rs.PutPolicy({
        scope: `${process.env.QINIU_BUCKET}:${key}`,
        expires: Number(options.expires) || 3600,
        returnBody: '{"key":"$(key)","hash":"$(etag)","fname":"$(fname)","bucket":"$(bucket)"}'
    });

    return putPolicy.uploadToken(qiniuMac);
}

async function createQiniuArchiveJob({ inputKey, fops, pipeline = '', force = true }) {
    if (!qiniuEnabled || !operationManager) {
        throw new Error('七牛归档打包尚未配置完成');
    }

    return new Promise((resolve, reject) => {
        operationManager.pfop(
            process.env.QINIU_BUCKET,
            inputKey,
            Array.isArray(fops) ? fops : [fops],
            pipeline,
            { force },
            (respErr, respBody, respInfo) => {
                if (respErr) {
                    reject(respErr);
                    return;
                }

                if (respInfo.statusCode !== 200) {
                    reject(new Error(`七牛归档打包提交失败: ${respInfo.statusCode}`));
                    return;
                }

                resolve(respBody);
            }
        );
    });
}

async function queryQiniuArchiveJob(persistentId) {
    if (!qiniuEnabled || !operationManager) {
        throw new Error('七牛归档打包尚未配置完成');
    }

    return new Promise((resolve, reject) => {
        operationManager.prefop(persistentId, (respErr, respBody, respInfo) => {
            if (respErr) {
                reject(respErr);
                return;
            }

            if (respInfo.statusCode !== 200) {
                reject(new Error(`七牛归档打包状态查询失败: ${respInfo.statusCode}`));
                return;
            }

            resolve(respBody);
        });
    });
}

function getQiniuUploadHost() {
    return uploadHostMap[process.env.QINIU_ZONE] || uploadHostMap.Zone_z0;
}

async function uploadBuffer(key, buffer) {
    if (qiniuEnabled) {
        return new Promise((resolve, reject) => {
            formUploader.put(createQiniuUploadToken(key), key, buffer, new qiniu.form_up.PutExtra(), (respErr, respBody, respInfo) => {
                if (respErr) {
                    reject(respErr);
                    return;
                }

                if (respInfo.statusCode !== 200) {
                    reject(new Error(`七牛上传失败: ${respInfo.statusCode}`));
                    return;
                }

                resolve({
                    key,
                    url: buildQiniuUrl(respBody.key)
                });
            });
        });
    }

    const targetPath = path.join(uploadRoot, key);
    ensureDir(targetPath);
    fs.writeFileSync(targetPath, buffer);

    return {
        key,
        url: localUrlFromKey(key)
    };
}

async function deleteByUrl(url) {
    if (!url) {
        return;
    }

    if (qiniuEnabled) {
        const key = extractQiniuKeyFromUrl(url);
        if (!key) {
            return;
        }

        await new Promise((resolve, reject) => {
            bucketManager.delete(process.env.QINIU_BUCKET, key, (respErr, _respBody, respInfo) => {
                if (respErr) {
                    reject(respErr);
                    return;
                }

                if (respInfo.statusCode === 200 || respInfo.statusCode === 612) {
                    resolve();
                    return;
                }

                reject(new Error(`七牛删除失败: ${respInfo.statusCode}`));
            });
        });
        return;
    }

    const relative = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/uploads\//, '');
    const targetPath = path.join(uploadRoot, relative);
    if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
    }
}

async function listQiniuKeys({ prefix = '', limit = 1000, marker = '' } = {}) {
    if (!qiniuEnabled || !bucketManager) {
        throw new Error('七牛尚未配置完成');
    }

    return new Promise((resolve, reject) => {
        bucketManager.listPrefix(
            process.env.QINIU_BUCKET,
            { prefix, marker, limit },
            (respErr, respBody, respInfo) => {
                if (respErr) {
                    reject(respErr);
                    return;
                }

                if (respInfo.statusCode !== 200) {
                    reject(new Error(`七牛文件列表获取失败: ${respInfo.statusCode}`));
                    return;
                }

                resolve(respBody || {});
            }
        );
    });
}

async function listAllQiniuKeys(prefix = '') {
    const keys = [];
    let marker = '';

    do {
        const body = await listQiniuKeys({ prefix, marker, limit: 1000 });
        const items = Array.isArray(body.items) ? body.items : [];
        items.forEach((item) => {
            if (item?.key) {
                keys.push(item.key);
            }
        });
        marker = body.marker || '';
    } while (marker);

    return keys;
}

async function deleteQiniuKeys(keys) {
    if (!qiniuEnabled || !bucketManager) {
        throw new Error('七牛尚未配置完成');
    }

    const normalized = Array.from(new Set((keys || []).map((key) => String(key || '').trim()).filter(Boolean)));
    if (!normalized.length) {
        return { deleted: 0, failed: [] };
    }

    const chunks = [];
    for (let index = 0; index < normalized.length; index += 1000) {
        chunks.push(normalized.slice(index, index + 1000));
    }

    const failed = [];
    let deleted = 0;

    for (const chunk of chunks) {
        const operations = chunk.map((key) => qiniu.rs.deleteOp(process.env.QINIU_BUCKET, key));
        const result = await new Promise((resolve, reject) => {
            bucketManager.batch(operations, (respErr, respBody, respInfo) => {
                if (respErr) {
                    reject(respErr);
                    return;
                }

                if (respInfo.statusCode !== 200) {
                    reject(new Error(`七牛批量删除失败: ${respInfo.statusCode}`));
                    return;
                }

                resolve(Array.isArray(respBody) ? respBody : []);
            });
        });

        result.forEach((item, index) => {
            const code = Number(item?.code || 0);
            if (code === 200 || code === 612) {
                deleted += 1;
                return;
            }
            failed.push({
                key: chunk[index],
                code
            });
        });
    }

    return { deleted, failed };
}

function ensureUploadRoot() {
    fs.mkdirSync(uploadRoot, { recursive: true });
}

function resolveLocalPathFromUrl(url) {
    if (!url) {
        return '';
    }

    const relative = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/uploads\//, '');
    return path.join(uploadRoot, relative);
}

module.exports = {
    buildAttachmentUrl,
    buildQiniuImageUrls,
    buildQiniuUrl,
    createQiniuArchiveJob,
    createQiniuUploadToken,
    deleteByUrl,
    deleteQiniuKeys,
    ensureUploadRoot,
    extractQiniuKeyFromUrl,
    getQiniuUploadHost,
    listAllQiniuKeys,
    localUrlFromKey,
    normalizeUrl,
    queryQiniuArchiveJob,
    qiniuEnabled,
    resolveLocalPathFromUrl,
    storageMode,
    uploadBuffer,
    uploadRoot
};
