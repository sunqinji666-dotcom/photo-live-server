CREATE DATABASE IF NOT EXISTS photo_live DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE photo_live;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    avatar VARCHAR(255) DEFAULT '',
    role ENUM('admin', 'photographer', 'viewer') DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lives (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    cover_image VARCHAR(500) DEFAULT '',
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
    view_count INT DEFAULT 0,
    like_count INT DEFAULT 0,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS albums (
    id INT AUTO_INCREMENT PRIMARY KEY,
    live_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(50) DEFAULT '📷',
    sort_order INT DEFAULT 0,
    photo_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (live_id) REFERENCES lives(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
    FOREIGN KEY (photographer_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_live_created (live_id, created_at DESC),
    INDEX idx_album (album_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    photo_id INT NOT NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

INSERT INTO users (username, password, nickname, role)
SELECT 'admin', '$2b$10$jB.H4RrKdudUAdn7NFdqf.Fip0Pf7AipVd0boq71L3QwwhD/jaqb.', '系统管理员', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');

INSERT INTO lives (title, slug, description, cover_image, status, event_date, location_name, theme_color, watermark_enabled, watermark_text, created_by)
SELECT
    '优利特团拜会 2026',
    'youlite-annual-party-2026',
    '企业年会照片直播示例，适合客户在手机和电脑上直接浏览。',
    'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1600&q=80',
    'live',
    '2026-02-06 18:30:00',
    '南宁 · 优利特会场',
    '#b05d2f',
    1,
    '优利特团拜会 2026',
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM lives WHERE slug = 'youlite-annual-party-2026');

INSERT INTO albums (live_id, name, icon, sort_order)
SELECT l.id, '签到与暖场', '✨', 1 FROM lives l
WHERE l.slug = 'youlite-annual-party-2026'
AND NOT EXISTS (SELECT 1 FROM albums WHERE live_id = l.id AND name = '签到与暖场');

INSERT INTO albums (live_id, name, icon, sort_order)
SELECT l.id, '舞台环节', '🎤', 2 FROM lives l
WHERE l.slug = 'youlite-annual-party-2026'
AND NOT EXISTS (SELECT 1 FROM albums WHERE live_id = l.id AND name = '舞台环节');

INSERT INTO albums (live_id, name, icon, sort_order)
SELECT l.id, '晚宴合影', '🥂', 3 FROM lives l
WHERE l.slug = 'youlite-annual-party-2026'
AND NOT EXISTS (SELECT 1 FROM albums WHERE live_id = l.id AND name = '晚宴合影');
