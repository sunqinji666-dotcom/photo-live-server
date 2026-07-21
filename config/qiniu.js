const qiniu = require('qiniu');
require('dotenv').config();

const {
    QINIU_ACCESS_KEY,
    QINIU_SECRET_KEY,
    QINIU_BUCKET,
    QINIU_DOMAIN,
    QINIU_ZONE
} = process.env;

// 配置七牛云区域
const zoneMap = {
    'Zone_z0': qiniu.zone.Zone_z0,      // 华东
    'Zone_z1': qiniu.zone.Zone_z1,      // 华北
    'Zone_z2': qiniu.zone.Zone_z2,      // 华南
    'Zone_na0': qiniu.zone.Zone_na0,    // 北美
    'Zone_as0': qiniu.zone.Zone_as0     // 东南亚
};

const config = new qiniu.conf.Config();
config.zone = zoneMap[QINIU_ZONE] || qiniu.zone.Zone_z0;

// 创建上传凭证
const putPolicy = new qiniu.rs.PutPolicy({
    scope: QINIU_BUCKET,
    expires: 3600  // 凭证有效期1小时
});

const mac = new qiniu.auth.digest.Mac(QINIU_ACCESS_KEY, QINIU_SECRET_KEY);
const uploadToken = putPolicy.uploadToken(mac);

// 创建表单上传对象
const formUploader = new qiniu.form_up.FormUploader(config);
const putExtra = new qiniu.form_up.PutExtra();

/**
 * 上传文件到七牛云
 * @param {string} key - 文件在七牛云的key（文件名）
 * @param {string} filePath - 本地文件路径
 * @returns {Promise<{key: string, url: string}>}
 */
async function uploadFile(key, filePath) {
    return new Promise((resolve, reject) => {
        formUploader.putFile(uploadToken, key, filePath, putExtra, (respErr, respBody, respInfo) => {
            if (respErr) {
                reject(new Error(`上传失败: ${respErr.message}`));
                return;
            }
            
            if (respInfo.statusCode === 200) {
                resolve({
                    key: respBody.key,
                    hash: respBody.hash,
                    url: `${QINIU_DOMAIN}/${respBody.key}`
                });
            } else {
                reject(new Error(`上传失败: ${respInfo.statusCode} - ${JSON.stringify(respBody)}`));
            }
        });
    });
}

/**
 * 删除七牛云上的文件
 * @param {string} key - 文件key
 */
async function deleteFile(key) {
    const bucketManager = new qiniu.rs.BucketManager(mac, config);
    
    return new Promise((resolve, reject) => {
        bucketManager.delete(QINIU_BUCKET, key, (respErr, respBody, respInfo) => {
            if (respErr) {
                reject(new Error(`删除失败: ${respErr.message}`));
                return;
            }
            
            if (respInfo.statusCode === 200) {
                resolve({ success: true });
            } else if (respInfo.statusCode === 612) {
                resolve({ success: true, message: '文件不存在' });
            } else {
                reject(new Error(`删除失败: ${respInfo.statusCode}`));
            }
        });
    });
}

/**
 * 生成图片压缩URL
 * @param {string} key - 文件key
 * @param {object} options - 压缩选项
 * @returns {string}
 */
function getCompressedUrl(key, options = {}) {
    const {
        width = 0,
        height = 0,
        quality = 80,
        format = 'webp'
    } = options;
    
    let imageMogr = 'imageMogr2';
    const params = [];
    
    if (width) params.push(`thumbnail/${width}x`);
    if (height) params.push(`thumbnail/x${height}`);
    if (width && height) params.pop(); // 清除单个参数，使用宽高组合
    
    if (width || height) {
        params.push(`thumbnail/${width}x${height}!`);
    }
    
    params.push(`quality/${quality}`);
    params.push(`format/${format}`);
    
    const imageUrl = `${QINIU_DOMAIN}/${key}`;
    const separator = imageUrl.includes('?') ? '&' : '?';
    
    return `${imageUrl}${separator}${params.join('&')}`;
}

/**
 * 批量获取文件信息
 * @param {string[]} keys - 文件key列表
 * @returns {Promise<Array>}
 */
async function getFileInfo(keys) {
    const bucketManager = new qiniu.rs.BucketManager(mac, config);
    
    return new Promise((resolve, reject) => {
        const operations = keys.map(key => ({
            op: '/stat',
            bucket: QINIU_BUCKET,
            key: key
        }));
        
        bucketManager.batch(operations, (respErr, respBody, respInfo) => {
            if (respErr) {
                reject(new Error(`获取文件信息失败: ${respErr.message}`));
                return;
            }
            
            resolve(respBody);
        });
    });
}

module.exports = {
    uploadFile,
    deleteFile,
    getCompressedUrl,
    getFileInfo,
    QINIU_DOMAIN
};
