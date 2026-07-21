# 🚀 宝塔面板部署指南

## 准备工作

### 1. 服务器要求
- 操作系统：Linux（推荐 Ubuntu 20.04+ 或 CentOS 7+）
- 内存：至少 1GB RAM
- 硬盘：至少 10GB 可用空间
- 已安装宝塔面板（最新版本）

### 2. 软件环境
在宝塔面板「软件商店」中安装：
- ✅ MySQL 5.7+ 或 MariaDB 10.3+
- ✅ Node.js 16+（通过 PM2 管理器安装）
- ✅ Nginx 1.20+

## 详细部署步骤

### 第一步：创建网站

1. 登录宝塔面板
2. 点击左侧菜单「网站」
3. 点击「添加站点」
4. 填写信息：
   - **域名**：`photo.yourdomain.com`（替换为你的域名）
   - **根目录**：`/www/wwwroot/photo-live`
   - **PHP 版本**：纯静态
   - **数据库**：暂不创建（下一步单独创建）
5. 点击「提交」

### 第二步：创建数据库

1. 点击左侧菜单「数据库」
2. 点击「添加数据库」
3. 填写信息：
   - **数据库名**：`photo_live`
   - **用户名**：`photo_live`
   - **密码**：点击「自动生成」（或自定义，**请记录此密码**）
   - **数据编码**：`utf8mb4`
4. 点击「提交」
5. 点击刚创建的数据库右侧的「导入」
6. 上传项目中的 `database/init.sql` 文件
7. 点击「导入」

### 第三步：上传项目文件

**方式一：通过 Git（推荐）**
```bash
# SSH 登录服务器
ssh root@your-server-ip

# 进入网站目录
cd /www/wwwroot/photo-live

# 克隆项目（替换为你的仓库地址）
git clone https://your-repo-url.git .
```

**方式二：通过宝塔文件管理器**
1. 点击左侧菜单「文件」
2. 进入 `/www/wwwroot/photo-live`
3. 点击「上传」>「上传文件」
4. 上传项目的 ZIP 压缩包
5. 右键上传的文件 >「解压」

### 第四步：安装依赖

通过 SSH 执行：
```bash
cd /www/wwwroot/photo-live
npm install --production
```

或在宝塔面板中：
1. 点击「Node.js 项目」
2. 点击「安装依赖」
3. 等待安装完成

### 第五步：配置环境变量

1. 在宝塔文件管理器中，进入 `/www/wwwroot/photo-live`
2. 复制 `.env.example` 为 `.env`
3. 编辑 `.env` 文件，填写以下配置：

```env
# 服务器配置
PORT=3000
NODE_ENV=production

# MySQL 数据库配置（替换为你的实际配置）
DB_HOST=localhost
DB_USER=photo_live
DB_PASSWORD=你的数据库密码
DB_NAME=photo_live
DB_PORT=3306

# JWT 密钥（自定义一个随机字符串）
JWT_SECRET=your_super_secret_key_change_this_2024
JWT_EXPIRES_IN=7d

# 七牛云配置（如不使用可留空，但图片上传功能将不可用）
QINIU_ACCESS_KEY=你的七牛云 AccessKey
QINIU_SECRET_KEY=你的七牛云 SecretKey
QINIU_BUCKET=你的七牛云空间名称
QINIU_DOMAIN=https://你的七牛云 CDN 域名
QINIU_ZONE=Zone_z0

# 文件上传配置
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/webp,image/gif

# 图片压缩配置
IMAGE_COMPRESS_QUALITY=80
IMAGE_MAX_WIDTH=1920
IMAGE_THUMBNAIL_WIDTH=400
IMAGE_THUMBNAIL_HEIGHT=300
```

### 第六步：创建 Node.js 项目

1. 点击左侧菜单「Node.js 项目」
2. 点击「添加项目」
3. 填写信息：
   - **项目名称**：`photo-live`
   - **项目路径**：`/www/wwwroot/photo-live`
   - **启动文件**：`server.js`
   - **Node 版本**：选择 16+
   - **端口**：`3000`
   - **启用域名**：勾选
   - **域名**：`photo.yourdomain.com`
4. 点击「提交」
5. 等待项目启动，状态变为「运行中」

### 第七步：配置反向代理

如果你已经通过 Node.js 项目绑定了域名，宝塔会自动配置反向代理。

**手动配置反向代理（如需）：**

1. 点击「网站」> 找到你的站点 > 点击「设置」
2. 点击「反向代理」
3. 点击「添加反向代理」
4. 填写：
   - **代理名称**：`photo-live-api`
   - **目标 URL**：`http://127.0.0.1:3000`
   - **发送域名**：`$host`
5. 点击「提交」

**添加 WebSocket 支持：**

点击反向代理右侧的「配置文件」，在配置中添加：

```nginx
location /socket.io/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

### 第八步：配置 SSL 证书（推荐）

1. 点击「网站」> 找到你的站点 > 点击「设置」
2. 点击「SSL」
3. 选择「Let's Encrypt」
4. 勾选你的域名
5. 点击「申请」
6. 申请成功后，开启「强制 HTTPS」

### 第九步：设置目录权限

```bash
# SSH 执行
cd /www/wwwroot/photo-live
mkdir -p uploads/temp logs
chown -R www:www uploads logs
chmod -R 755 uploads logs
```

### 第十步：测试访问

1. 浏览器访问：`https://photo.yourdomain.com`
2. 使用默认管理员账号登录：
   - **用户名**：`admin`
   - **密码**：`admin123`
3. **⚠️ 首次登录后立即修改密码！**

## 日常运维

### 查看日志
```bash
# 通过 PM2
pm2 logs photo-live

# 或查看文件日志
tail -f /www/wwwroot/photo-live/logs/error.log
tail -f /www/wwwroot/photo-live/logs/output.log
```

### 重启服务
```bash
pm2 restart photo-live
```

### 停止服务
```bash
pm2 stop photo-live
```

### 更新代码
```bash
cd /www/wwwroot/photo-live
git pull
npm install --production
pm2 restart photo-live
```

### 备份数据库
```bash
# 导出数据库
mysqldump -u photo_live -p photo_live > photo_live_backup_$(date +%Y%m%d).sql

# 导入备份
mysql -u photo_live -p photo_live < photo_live_backup_20240403.sql
```

## 故障排查

### 1. 服务无法启动
```bash
# 检查端口占用
lsof -i:3000

# 检查 Node.js 版本
node -v

# 手动启动测试
cd /www/wwwroot/photo-live
node server.js
```

### 2. 数据库连接失败
- 检查 `.env` 中的数据库配置
- 确认 MySQL 服务运行状态
- 检查数据库用户权限

```bash
# 测试数据库连接
mysql -u photo_live -p -e "USE photo_live; SELECT COUNT(*) FROM users;"
```

### 3. 图片上传失败
- 检查七牛云配置
- 确认 `uploads/temp` 目录有写入权限
- 查看错误日志

### 4. WebSocket 无法连接
- 确认 Nginx 配置中包含 WebSocket 代理
- 检查防火墙设置
- 浏览器控制台查看连接状态

### 5. 502 Bad Gateway
- 检查 Node.js 服务是否运行：`pm2 status`
- 查看服务日志：`pm2 logs photo-live`
- 重启服务：`pm2 restart photo-live`

## 性能优化

### 1. 启用 Gzip 压缩
在网站 Nginx 配置中添加：
```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
```

### 2. 设置浏览器缓存
```nginx
location ~* \.(jpg|jpeg|png|gif|webp|css|js)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### 3. 优化 MySQL 配置
在宝塔面板「MySQL 管理」>「配置修改」中：
```ini
max_connections = 200
innodb_buffer_pool_size = 256M
query_cache_size = 32M
```

### 4. 使用 CDN 加速
- 七牛云自带 CDN 加速
- 可配置 Cloudflare 等第三方 CDN
- 启用浏览器缓存和 Gzip

## 安全加固

### 1. 修改默认端口
在 `.env` 中修改端口：
```env
PORT=3001  # 改为其他端口
```

### 2. 配置防火墙
在宝塔面板「安全」中：
- 只开放 80、443、22 端口
- 禁止直接访问 3000 端口

### 3. 定期更新
- 定期更新 Node.js 依赖
- 及时修复安全漏洞
- 备份数据库和文件

### 4. 监控告警
- 使用宝塔的「监控」功能
- 配置 CPU、内存、磁盘告警
- 定期检查错误日志

## 联系支持

如遇到问题，请检查：
1. 服务运行状态：`pm2 status`
2. 错误日志：`pm2 logs photo-live`
3. 数据库连接：MySQL 服务是否正常
4. 配置文件：`.env` 配置是否正确

---

**祝你部署顺利！🎉**
