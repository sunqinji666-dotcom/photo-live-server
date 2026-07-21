-- ================================================
-- 图片直播系统 - 测试数据脚本
-- 用于生成本地测试数据
-- ================================================

USE photo_live;

-- 创建测试摄影师账号
INSERT INTO users (username, password, nickname, role) VALUES 
('photographer1', '$2a$10$X7VpS6Fk7gK.8YqJxY5ZGOqJxY5ZGOqJxY5ZGOqJxY5ZGOqJxY5ZG', '摄影师小王', 'photographer'),
('photographer2', '$2a$10$X7VpS6Fk7gK.8YqJxY5ZGOqJxY5ZGOqJxY5ZGOqJxY5ZGOqJxY5ZG', '摄影师小李', 'photographer')
ON DUPLICATE KEY UPDATE nickname = VALUES(nickname);

-- 更新管理员密码为 admin123
UPDATE users SET password = '$2a$10$X7VpS6Fk7gK.8YqJxY5ZGOqJxY5ZGOqJxY5ZGOqJxY5ZGOqJxY5ZG' 
WHERE username = 'admin';

-- 插入更多测试相册
INSERT INTO albums (live_id, name, icon, sort_order) VALUES 
(1, '签到合影', '📸', 5),
(1, '茶歇交流', '☕', 6)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 插入测试图片记录（使用占位图）
INSERT INTO photos 
(live_id, album_id, photographer_id, original_url, compressed_url, thumbnail_url, 
 title, tags, exif_data, width, height, view_count, like_count, created_at) VALUES

-- 开幕仪式
(1, 1, 1, 
 'https://picsum.photos/seed/ceremony1/1920/1080',
 'https://picsum.photos/seed/ceremony1/800/450',
 'https://picsum.photos/seed/ceremony1/400/225',
 '开幕致辞环节', '["开幕", "致辞", "领导"]',
 '{"make":"Canon","model":"EOS R5","exposureTime":0.008,"fNumber":2.8,"iso":400}',
 1920, 1080, 120, 45, '2024-04-03 14:00:00'),

(1, 1, 1,
 'https://picsum.photos/seed/ceremony2/1920/1280',
 'https://picsum.photos/seed/ceremony2/800/533',
 'https://picsum.photos/seed/ceremony2/400/267',
 '剪彩仪式', '["剪彩", "仪式"]',
 '{"make":"Sony","model":"A7M4","exposureTime":0.004,"fNumber":2,"iso":200}',
 1920, 1280, 98, 38, '2024-04-03 14:10:00'),

(1, 1, 1,
 'https://picsum.photos/seed/ceremony3/1920/1080',
 'https://picsum.photos/seed/ceremony3/800/450',
 'https://picsum.photos/seed/ceremony3/400/225',
 '嘉宾合影', '["合影", "嘉宾"]',
 '{}',
 1920, 1080, 85, 32, '2024-04-03 14:20:00'),

-- 文艺表演
(1, 2, 2,
 'https://picsum.photos/seed/performance1/1920/1440',
 'https://picsum.photos/seed/performance1/800/600',
 'https://picsum.photos/seed/performance1/400/300',
 '舞蹈表演', '["舞蹈", "表演"]',
 '{"make":"Nikon","model":"Z8","exposureTime":0.002,"fNumber":1.8,"iso":800}',
 1920, 1440, 156, 67, '2024-04-03 15:00:00'),

(1, 2, 2,
 'https://picsum.photos/seed/performance2/1920/1280',
 'https://picsum.photos/seed/performance2/800/533',
 'https://picsum.photos/seed/performance2/400/267',
 '乐队演奏', '["音乐", "乐队"]',
 '{"make":"Canon","model":"EOS R6","exposureTime":0.005,"fNumber":2.8,"iso":640}',
 1920, 1280, 134, 52, '2024-04-03 15:20:00'),

(1, 2, 2,
 'https://picsum.photos/seed/performance3/1920/1080',
 'https://picsum.photos/seed/performance3/800/450',
 'https://picsum.photos/seed/performance3/400/225',
 '歌曲独唱', '["唱歌", "独唱"]',
 '{}',
 1920, 1080, 112, 48, '2024-04-03 15:40:00'),

-- 颁奖典礼
(1, 3, 1,
 'https://picsum.photos/seed/award1/1920/1280',
 'https://picsum.photos/seed/award1/800/533',
 'https://picsum.photos/seed/award1/400/267',
 '优秀员工颁奖', '["颁奖", "优秀员工"]',
 '{"make":"Sony","model":"A7S3","exposureTime":0.01,"fNumber":2,"iso":1600}',
 1920, 1280, 203, 89, '2024-04-03 16:00:00'),

(1, 3, 1,
 'https://picsum.photos/seed/award2/1920/1080',
 'https://picsum.photos/seed/award2/800/450',
 'https://picsum.photos/seed/award2/400/225',
 '团队奖颁发', '["团队", "荣誉"]',
 '{}',
 1920, 1080, 178, 73, '2024-04-03 16:20:00'),

(1, 3, 1,
 'https://picsum.photos/seed/award3/1920/1440',
 'https://picsum.photos/seed/award3/800/600',
 'https://picsum.photos/seed/award3/400/300',
 '特等奖揭晓', '["特等", "大奖"]',
 '{"make":"Canon","model":"EOS R5","exposureTime":0.008,"fNumber":2.8,"iso":500}',
 1920, 1440, 245, 95, '2024-04-03 16:40:00'),

-- 宴会合影
(1, 4, 2,
 'https://picsum.photos/seed/banquet1/1920/1080',
 'https://picsum.photos/seed/banquet1/800/450',
 'https://picsum.photos/seed/banquet1/400/225',
 '宴会开场', '["宴会", "干杯"]',
 '{}',
 1920, 1080, 89, 41, '2024-04-03 18:00:00'),

(1, 4, 2,
 'https://picsum.photos/seed/banquet2/1920/1280',
 'https://picsum.photos/seed/banquet2/800/533',
 'https://picsum.photos/seed/banquet2/400/267',
 '全员大合影', '["合影", "全家福"]',
 '{"make":"Nikon","model":"Z8","exposureTime":0.0125,"fNumber":4,"iso":200}',
 1920, 1280, 167, 62, '2024-04-03 18:30:00'),

-- 签到合影
(1, 5, 1,
 'https://picsum.photos/seed/checkin1/1920/1280',
 'https://picsum.photos/seed/checkin1/800/533',
 'https://picsum.photos/seed/checkin1/400/267',
 '嘉宾签到', '["签到", "嘉宾"]',
 '{}',
 1920, 1280, 56, 23, '2024-04-03 13:30:00'),

(1, 5, 1,
 'https://picsum.photos/seed/checkin2/1920/1080',
 'https://picsum.photos/seed/checkin2/800/450',
 'https://picsum.photos/seed/checkin2/400/225',
 '签名墙合影', '["签名", "合影"]',
 '{}',
 1920, 1080, 45, 19, '2024-04-03 13:45:00'),

-- 茶歇交流
(1, 6, 2,
 'https://picsum.photos/seed/tea1/1920/1080',
 'https://picsum.photos/seed/tea1/800/450',
 'https://picsum.photos/seed/tea1/400/225',
 '茶歇时间', '["茶歇", "交流"]',
 '{}',
 1920, 1080, 34, 15, '2024-04-03 15:50:00');

-- 插入一些点赞记录
INSERT INTO likes (user_id, photo_id, ip_address) VALUES
(1, 1, '127.0.0.1'),
(1, 5, '127.0.0.1'),
(1, 7, '127.0.0.1');

-- 更新图片点赞数
UPDATE photos SET like_count = like_count + 1 WHERE id IN (1, 5, 7);

SELECT '✅ 测试数据插入完成！' as message;
