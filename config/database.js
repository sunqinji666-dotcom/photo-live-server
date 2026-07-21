const mysql = require('mysql2/promise');
require('dotenv').config();
const { buildPhotoSearchFields } = require('../lib/photo-search');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'photo_live',
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

async function testConnection() {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
}

async function ensureSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            nickname VARCHAR(50) NOT NULL,
            avatar VARCHAR(255) DEFAULT '',
            mobile VARCHAR(30) DEFAULT '',
            role ENUM('admin', 'photographer', 'retoucher', 'viewer') DEFAULT 'viewer',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS lives (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(200) NOT NULL,
            slug VARCHAR(100) NOT NULL UNIQUE,
            subtitle VARCHAR(200) DEFAULT '',
            description TEXT,
            cover_image VARCHAR(500) DEFAULT '',
            banner_image VARCHAR(500) DEFAULT '',
            opening_image VARCHAR(500) DEFAULT '',
            share_title VARCHAR(200) DEFAULT '',
            share_description TEXT,
            share_logo VARCHAR(500) DEFAULT '',
            background_music VARCHAR(500) DEFAULT '',
            status ENUM('live', 'ended', 'draft') DEFAULT 'draft',
            access_code VARCHAR(20) DEFAULT '',
            event_date DATETIME NULL,
            location_name VARCHAR(120) DEFAULT '',
            theme_color VARCHAR(20) DEFAULT '#c76b34',
            watermark_enabled TINYINT(1) DEFAULT 0,
            watermark_text VARCHAR(200) DEFAULT '',
            enable_share TINYINT(1) DEFAULT 1,
            enable_client_link_copy TINYINT(1) DEFAULT 0,
            allow_original_download TINYINT(1) DEFAULT 0,
            allow_watermarked_download TINYINT(1) DEFAULT 0,
            allow_batch_download TINYINT(1) DEFAULT 0,
            show_photographer TINYINT(1) DEFAULT 1,
            enable_guest_upload TINYINT(1) DEFAULT 0,
            require_photo_review TINYINT(1) DEFAULT 0,
            show_banner TINYINT(1) DEFAULT 1,
            show_opening TINYINT(1) DEFAULT 0,
            opening_duration INT DEFAULT 3,
            layout_mode VARCHAR(40) DEFAULT 'waterfall',
            view_count INT DEFAULT 0,
            like_count INT DEFAULT 0,
            created_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS albums (
            id INT AUTO_INCREMENT PRIMARY KEY,
            live_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            icon VARCHAR(50) DEFAULT '📷',
            cover_image VARCHAR(500) DEFAULT '',
            sort_order INT DEFAULT 0,
            photo_count INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (live_id) REFERENCES lives(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS photos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            live_id INT NOT NULL,
            album_id INT NULL,
            photographer_id INT NOT NULL,
            original_url VARCHAR(500) NOT NULL,
            compressed_url VARCHAR(500) NOT NULL,
            thumbnail_url VARCHAR(500) NOT NULL,
            watermarked_url VARCHAR(500) DEFAULT '',
            title VARCHAR(200) DEFAULT '',
            description TEXT,
            tags JSON,
            exif_data JSON,
            width INT DEFAULT 0,
            height INT DEFAULT 0,
            file_size INT DEFAULT 0,
            file_hash VARCHAR(64) NULL,
            original_name VARCHAR(255) DEFAULT '',
            view_count INT DEFAULT 0,
            like_count INT DEFAULT 0,
            download_count INT DEFAULT 0,
            is_public TINYINT(1) DEFAULT 1,
            sort_order INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (live_id) REFERENCES lives(id) ON DELETE CASCADE,
            FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL,
            FOREIGN KEY (photographer_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS likes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NULL,
            photo_id INT NOT NULL,
            ip_address VARCHAR(45) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            photo_id INT NOT NULL,
            user_id INT NULL,
            nickname VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            ip_address VARCHAR(45),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS live_members (
            id INT AUTO_INCREMENT PRIMARY KEY,
            live_id INT NOT NULL,
            user_id INT NOT NULL,
            role VARCHAR(40) DEFAULT 'photographer',
            permissions JSON,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_live_member (live_id, user_id),
            FOREIGN KEY (live_id) REFERENCES lives(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            live_id INT NOT NULL,
            user_id INT NULL,
            actor_name VARCHAR(80) DEFAULT '',
            action VARCHAR(120) NOT NULL,
            target_type VARCHAR(60) DEFAULT '',
            target_id VARCHAR(120) DEFAULT '',
            detail TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (live_id) REFERENCES lives(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS download_jobs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            live_id INT NOT NULL,
            requester_user_id INT NULL,
            scope ENUM('viewer', 'admin') DEFAULT 'viewer',
            job_kind ENUM('selection', 'full') DEFAULT 'selection',
            source_signature VARCHAR(64) NOT NULL,
            selection_count INT DEFAULT 0,
            storage_mode VARCHAR(20) DEFAULT 'local',
            preferred_url_field VARCHAR(40) DEFAULT 'original_url',
            file_name VARCHAR(255) DEFAULT '',
            archive_key VARCHAR(255) DEFAULT '',
            archive_url VARCHAR(500) DEFAULT '',
            source_index_key VARCHAR(255) DEFAULT '',
            persistent_id VARCHAR(160) DEFAULT '',
            status ENUM('queued', 'processing', 'ready', 'failed') DEFAULT 'queued',
            error_message TEXT,
            detail JSON,
            expires_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (live_id) REFERENCES lives(id) ON DELETE CASCADE,
            FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS maintenance_jobs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            job_type VARCHAR(40) DEFAULT 'cleanup',
            status ENUM('queued', 'processing', 'ready', 'failed') DEFAULT 'queued',
            progress INT DEFAULT 0,
            phase VARCHAR(80) DEFAULT '',
            summary TEXT,
            stats JSON,
            error_message TEXT,
            requested_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS viewer_events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            live_id INT NOT NULL,
            photo_id INT NULL,
            event_type ENUM('live_view', 'photo_view') DEFAULT 'live_view',
            visitor_key CHAR(40) NOT NULL,
            ip_address VARCHAR(45) DEFAULT '',
            user_agent TEXT,
            device_type VARCHAR(32) DEFAULT '',
            device_name VARCHAR(120) DEFAULT '',
            browser_name VARCHAR(120) DEFAULT '',
            os_name VARCHAR(120) DEFAULT '',
            country_name VARCHAR(80) DEFAULT '',
            province_name VARCHAR(120) DEFAULT '',
            city_name VARCHAR(120) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (live_id) REFERENCES lives(id) ON DELETE CASCADE,
            FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS viewer_sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            live_id INT NOT NULL,
            visitor_key CHAR(40) NOT NULL,
            ip_address VARCHAR(45) DEFAULT '',
            user_agent TEXT,
            device_type VARCHAR(32) DEFAULT '',
            device_name VARCHAR(120) DEFAULT '',
            browser_name VARCHAR(120) DEFAULT '',
            os_name VARCHAR(120) DEFAULT '',
            country_name VARCHAR(80) DEFAULT '',
            province_name VARCHAR(120) DEFAULT '',
            city_name VARCHAR(120) DEFAULT '',
            entry_path VARCHAR(255) DEFAULT '',
            exit_path VARCHAR(255) DEFAULT '',
            last_photo_id INT NULL,
            started_at DATETIME NOT NULL,
            ended_at DATETIME NULL,
            duration_seconds INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (live_id) REFERENCES lives(id) ON DELETE CASCADE,
            FOREIGN KEY (last_photo_id) REFERENCES photos(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            name VARCHAR(120) NOT NULL,
            token_prefix VARCHAR(24) NOT NULL,
            token_hash CHAR(64) NOT NULL,
            status ENUM('active', 'revoked') DEFAULT 'active',
            last_used_at DATETIME NULL,
            expires_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_api_keys_hash (token_hash),
            INDEX idx_api_keys_user_status (user_id, status, created_at DESC),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'photographer', 'retoucher', 'viewer') DEFAULT 'viewer'`);

    await addColumnIfMissing('users', 'mobile', "VARCHAR(30) DEFAULT '' AFTER avatar");

    await addColumnIfMissing('lives', 'slug', 'VARCHAR(100) NOT NULL DEFAULT "" AFTER title');
    await addColumnIfMissing('lives', 'subtitle', "VARCHAR(200) DEFAULT '' AFTER slug");
    await addColumnIfMissing('lives', 'banner_image', "VARCHAR(500) DEFAULT '' AFTER cover_image");
    await addColumnIfMissing('lives', 'opening_image', "VARCHAR(500) DEFAULT '' AFTER banner_image");
    await addColumnIfMissing('lives', 'share_title', "VARCHAR(200) DEFAULT '' AFTER banner_image");
    await addColumnIfMissing('lives', 'share_description', 'TEXT AFTER share_title');
    await addColumnIfMissing('lives', 'share_logo', "VARCHAR(500) DEFAULT '' AFTER share_description");
    await addColumnIfMissing('lives', 'background_music', "VARCHAR(500) DEFAULT '' AFTER share_logo");
    await addColumnIfMissing('lives', 'event_date', 'DATETIME NULL AFTER access_code');
    await addColumnIfMissing('lives', 'location_name', "VARCHAR(120) DEFAULT '' AFTER event_date");
    await addColumnIfMissing('lives', 'theme_color', "VARCHAR(20) DEFAULT '#c76b34' AFTER location_name");
    await addColumnIfMissing('lives', 'watermark_enabled', 'TINYINT(1) DEFAULT 0 AFTER theme_color');
    await addColumnIfMissing('lives', 'watermark_text', "VARCHAR(200) DEFAULT '' AFTER watermark_enabled");
    await addColumnIfMissing('lives', 'enable_share', 'TINYINT(1) DEFAULT 1 AFTER watermark_text');
    await addColumnIfMissing('lives', 'enable_client_link_copy', 'TINYINT(1) DEFAULT 0 AFTER enable_share');
    await addColumnIfMissing('lives', 'allow_original_download', 'TINYINT(1) DEFAULT 0 AFTER enable_share');
    await addColumnIfMissing('lives', 'allow_watermarked_download', 'TINYINT(1) DEFAULT 0 AFTER allow_original_download');
    await addColumnIfMissing('lives', 'allow_batch_download', 'TINYINT(1) DEFAULT 0 AFTER allow_watermarked_download');
    await addColumnIfMissing('lives', 'show_photographer', 'TINYINT(1) DEFAULT 1 AFTER allow_batch_download');
    await addColumnIfMissing('lives', 'enable_guest_upload', 'TINYINT(1) DEFAULT 0 AFTER show_photographer');
    await addColumnIfMissing('lives', 'require_photo_review', 'TINYINT(1) DEFAULT 0 AFTER enable_guest_upload');
    await addColumnIfMissing('lives', 'show_banner', 'TINYINT(1) DEFAULT 1 AFTER require_photo_review');
    await addColumnIfMissing('lives', 'show_opening', 'TINYINT(1) DEFAULT 0 AFTER show_banner');
    await addColumnIfMissing('lives', 'opening_duration', 'INT DEFAULT 3 AFTER show_opening');
    await addColumnIfMissing('lives', 'layout_mode', "VARCHAR(40) DEFAULT 'waterfall' AFTER opening_duration");

    await addColumnIfMissing('albums', 'cover_image', "VARCHAR(500) DEFAULT '' AFTER icon");
    await addColumnIfMissing('albums', 'updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
    await addColumnIfMissing('photos', 'watermarked_url', "VARCHAR(500) DEFAULT '' AFTER thumbnail_url");
    await addColumnIfMissing('photos', 'file_hash', 'VARCHAR(64) NULL AFTER file_size');
    await addColumnIfMissing('photos', 'original_name', "VARCHAR(255) DEFAULT '' AFTER file_hash");
    await addColumnIfMissing('photos', 'camera_search', "VARCHAR(191) DEFAULT '' AFTER original_name");
    await addColumnIfMissing('photos', 'lens_search', "VARCHAR(191) DEFAULT '' AFTER camera_search");
    await addColumnIfMissing('photos', 'focal_length_search', "VARCHAR(64) DEFAULT '' AFTER lens_search");
    await addColumnIfMissing('photos', 'aperture_search', "VARCHAR(64) DEFAULT '' AFTER focal_length_search");
    await addColumnIfMissing('photos', 'shutter_speed_search', "VARCHAR(64) DEFAULT '' AFTER aperture_search");
    await addColumnIfMissing('photos', 'iso_value', 'INT NULL AFTER shutter_speed_search');
    await addColumnIfMissing('photos', 'format_value', "VARCHAR(32) DEFAULT '' AFTER iso_value");
    await addColumnIfMissing('photos', 'search_text', 'TEXT AFTER format_value');

    await pool.query("ALTER TABLE lives MODIFY COLUMN watermark_enabled TINYINT(1) DEFAULT 0");
    await pool.query("ALTER TABLE lives MODIFY COLUMN allow_watermarked_download TINYINT(1) DEFAULT 0");

    await pool.query('UPDATE lives SET slug = LOWER(REPLACE(REPLACE(title, " ", "-"), "/", "-")) WHERE slug = "" OR slug IS NULL');
    await pool.query('UPDATE lives SET share_title = title WHERE share_title = "" OR share_title IS NULL');
    await pool.query('UPDATE lives SET watermark_text = title WHERE watermark_text = "" OR watermark_text IS NULL');

    await ensureUniqueIndex('lives', 'uniq_lives_slug', 'slug');
    await ensureIndex('photos', 'idx_live_created', '(live_id, created_at DESC)');
    await ensureIndex('photos', 'idx_live_public_created', '(live_id, is_public, created_at DESC)');
    await ensureIndex('photos', 'idx_live_public_likes', '(live_id, is_public, like_count DESC, created_at DESC)');
    await ensureIndex('photos', 'idx_live_album_public_created', '(live_id, album_id, is_public, created_at DESC)');
    await ensureIndex('photos', 'idx_album', '(album_id)');
    await ensureIndex('photos', 'idx_live_iso_value', '(live_id, iso_value)');
    await ensureIndex('photos', 'idx_live_format_value', '(live_id, format_value)');
    await ensureIndex('photos', 'idx_live_camera_search', '(live_id, camera_search)');
    await ensureIndex('photos', 'idx_live_lens_search', '(live_id, lens_search)');
    await ensureUniqueIndex('photos', 'uniq_photos_live_hash', '(live_id, file_hash)');
    await ensureIndex('activity_logs', 'idx_logs_live_created', '(live_id, created_at DESC)');
    await ensureIndex('download_jobs', 'idx_download_jobs_lookup', '(live_id, scope, status, created_at DESC)');
    await ensureIndex('download_jobs', 'idx_download_jobs_signature', '(live_id, scope, source_signature)');
    await ensureIndex('maintenance_jobs', 'idx_maintenance_jobs_status', '(job_type, status, created_at DESC)');
    await ensureIndex('viewer_events', 'idx_viewer_events_live_created', '(live_id, created_at DESC)');
    await ensureIndex('viewer_events', 'idx_viewer_events_live_type_created', '(live_id, event_type, created_at DESC)');
    await ensureIndex('viewer_events', 'idx_viewer_events_photo_created', '(photo_id, created_at DESC)');
    await ensureIndex('viewer_events', 'idx_viewer_events_visitor_live', '(visitor_key, live_id, created_at DESC)');
    await ensureIndex('viewer_sessions', 'idx_viewer_sessions_live_started', '(live_id, started_at DESC)');
    await ensureIndex('viewer_sessions', 'idx_viewer_sessions_live_ended', '(live_id, ended_at DESC)');
    await ensureIndex('viewer_sessions', 'idx_viewer_sessions_visitor_live', '(visitor_key, live_id, started_at DESC)');
    await ensureIndex('api_keys', 'idx_api_keys_user_status', '(user_id, status, created_at DESC)');

    await backfillPhotoSearchFields();
    await createDefaultAdmin();
}

async function addColumnIfMissing(tableName, columnName, definition) {
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [tableName, columnName]
    );

    if (!rows[0].total) {
        await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
}

async function ensureIndex(tableName, indexName, definition) {
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [tableName, indexName]
    );

    if (!rows[0].total) {
        await pool.query(`CREATE INDEX ${indexName} ON ${tableName} ${definition}`);
    }
}

async function ensureUniqueIndex(tableName, indexName, columnName) {
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [tableName, indexName]
    );

    if (!rows[0].total) {
        const definition = /^\s*\(/.test(columnName) ? columnName : `(${columnName})`;
        await pool.query(`CREATE UNIQUE INDEX ${indexName} ON ${tableName} ${definition}`);
    }
}

async function createDefaultAdmin() {
    const [rows] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', ['admin']);
    if (rows[0]) {
        return;
    }

    await pool.query(
        'INSERT INTO users (username, password, nickname, role) VALUES (?, ?, ?, ?)',
        ['admin', '$2b$10$jB.H4RrKdudUAdn7NFdqf.Fip0Pf7AipVd0boq71L3QwwhD/jaqb.', '系统管理员', 'admin']
    );
}

async function backfillPhotoSearchFields() {
    const batchSize = 200;
    let lastId = 0;

    while (true) {
        const [rows] = await pool.query(
            `SELECT id, title, description, tags, original_name, exif_data
             FROM photos
             WHERE id > ?
               AND (
                    search_text IS NULL OR search_text = ''
                    OR camera_search IS NULL
                    OR lens_search IS NULL
                    OR format_value IS NULL
               )
             ORDER BY id ASC
             LIMIT ?`,
            [lastId, batchSize]
        );

        if (!rows.length) {
            break;
        }

        for (const row of rows) {
            const fields = buildPhotoSearchFields({
                title: row.title,
                description: row.description,
                tags: row.tags,
                originalName: row.original_name,
                exifData: row.exif_data
            });

            await pool.query(
                `UPDATE photos
                 SET camera_search = ?,
                     lens_search = ?,
                     focal_length_search = ?,
                     aperture_search = ?,
                     shutter_speed_search = ?,
                     iso_value = ?,
                     format_value = ?,
                     search_text = ?
                 WHERE id = ?`,
                [
                    fields.camera_search,
                    fields.lens_search,
                    fields.focal_length_search,
                    fields.aperture_search,
                    fields.shutter_speed_search,
                    fields.iso_value,
                    fields.format_value,
                    fields.search_text,
                    row.id
                ]
            );
        }

        lastId = rows[rows.length - 1].id;
    }
}

module.exports = {
    ensureSchema,
    pool,
    testConnection
};
