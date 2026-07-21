# 📸 图片直播系统 - 快速参考

## 项目概览

一个功能完整的图片直播平台，支持实时上传、在线浏览、点赞互动、移动端适配等功能。

### 核心功能清单

| 功能模块 | 状态 | 说明 |
|---------|------|------|
| 🖼️ 瀑布流布局 | ✅ | 响应式瀑布流/网格视图切换 |
| 🔍 图片灯箱 | ✅ | 全屏查看、左右切换、键盘/触摸操作 |
| 📂 相册分类 | ✅ | 多维度分类筛选 |
| ❤️ 点赞系统 | ✅ | 实时点赞、去重、计数显示 |
| 📡 实时推送 | ✅ | WebSocket 新照片通知 |
| 📤 图片上传 | ✅ | 单张/批量上传、拖拽上传 |
| ☁️ 七牛云存储 | ✅ | 自动上传、CDN 加速 |
| 🖼️ 图片压缩 | ✅ | WebP 转换、自动缩略图 |
| 📷 EXIF 显示 | ✅ | 自动提取拍摄参数 |
| 🔐 用户认证 | ✅ | JWT Token、多角色权限 |
| 🔍 标签搜索 | ✅ | 实时搜索过滤 |
| 📱 移动适配 | ✅ | 完美响应式设计 |
| 🔗 分享功能 | ✅ | 链接复制分享 |
| 🗑️ 图片管理 | ✅ | 删除、更新信息 |
| 📊 数据统计 | ✅ | 浏览/点赞实时统计 |

## 快速启动（本地测试）

```bash
# 1. 确保 MySQL 已运行
# 2. 创建数据库并导入
mysql -u root -p < database/init.sql
mysql -u root -p < database/seed.sql

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填写数据库配置

# 4. 启动
chmod +x start.sh
./start.sh

# 或手动启动
npm install
node server.js
```

访问：http://localhost:3000

## 快速部署（宝塔面板）

```bash
# 1. 上传文件到 /path/to/photo-live
# 2. SSH 执行
cd /path/to/photo-live
chmod +x deploy.sh
./deploy.sh

# 3. 在宝塔面板：
#    - 创建数据库并导入 init.sql
#    - 创建 Node.js 项目
#    - 配置反向代理
#    - 配置 SSL（推荐）
```

详细步骤查看：[DEPLOY.md](DEPLOY.md)

## 默认账号

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|------|------|
| 管理员 | admin | $DEFAULT_ADMIN_PASSWORD | 所有权限 |
| 摄影师 | photographer1 | $DEFAULT_ADMIN_PASSWORD | 上传/管理图片 |
| 摄影师 | photographer2 | $DEFAULT_ADMIN_PASSWORD | 上传/管理图片 |

**⚠️ 首次使用后请立即修改密码！**

## API 端点

### 认证
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 当前用户
- `PUT /api/auth/password` - 修改密码

### 图片
- `GET /api/photos?live_id=1&album_id=all` - 图片列表
- `GET /api/photos/:id` - 图片详情
- `POST /api/photos/upload` - 上传单张
- `POST /api/photos/upload-batch` - 批量上传
- `POST /api/photos/:id/like` - 点赞
- `DELETE /api/photos/:id` - 删除图片

### 直播
- `GET /api/lives/:id` - 直播详情
- `POST /api/lives` - 创建直播
- `PUT /api/lives/:id` - 更新直播

### 相册
- `GET /api/albums/live/:liveId` - 相册列表
- `POST /api/albums` - 创建相册

## 项目结构

```
photo-live-server/
├── config/              # 配置
│   ├── database.js     # 数据库连接池
│   └── qiniu.js        # 七牛云 SDK
├── database/           # 数据库
│   ├── init.sql       # 初始化脚本
│   └── seed.sql       # 测试数据
├── middleware/         # 中间件
│   ├── auth.js        # JWT 认证
│   └── imageProcessor.js # 图片处理
├── routes/            # API 路由
│   ├── auth.js       # 用户认证
│   ├── photos.js     # 图片管理
│   ├── lives.js      # 直播管理
│   └── albums.js     # 相册管理
├── photo-live/        # 前端文件
│   ├── index.html    # 页面
│   ├── style.css     # 样式
│   └── app.js        # 逻辑
├── uploads/           # 临时上传
├── logs/              # 日志
├── server.js          # 入口文件
├── ecosystem.config.js # PM2 配置
├── nginx.conf         # Nginx 配置
├── deploy.sh          # 部署脚本
└── start.sh           # 启动脚本
```

## 常用命令

```bash
# 启动服务
npm start

# 开发模式
npm run dev

# PM2 管理
pm2 start ecosystem.config.js    # 启动
pm2 stop photo-live              # 停止
pm2 restart photo-live           # 重启
pm2 logs photo-live              # 查看日志

# 数据库
npm run db:init                  # 初始化数据库

# 部署
npm run deploy                   # 运行部署脚本
```

## 环境变量

```env
# 必须配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=photo_live

# 七牛云（图片上传必需）
QINIU_ACCESS_KEY=
QINIU_SECRET_KEY=
QINIU_BUCKET=
QINIU_DOMAIN=

# 可选配置
PORT=3000
JWT_SECRET=your_secret
IMAGE_COMPRESS_QUALITY=80
```

## 七牛云配置步骤

1. 注册七牛云账号
2. 创建对象存储空间
3. 获取 AccessKey 和 SecretKey
4. 配置 CDN 域名
5. 填写到 `.env` 文件

## 故障排查

### 服务无法启动
```bash
# 检查端口
lsof -i:3000

# 测试数据库连接
mysql -u root -p -e "USE photo_live; SELECT 1;"

# 手动启动查看错误
node server.js
```

### 图片上传失败
- 检查七牛云配置
- 确认临时目录权限：`chmod 755 uploads/temp`
- 查看日志：`pm2 logs photo-live`

### 数据库错误
```bash
# 重新导入
mysql -u root -p < database/init.sql
mysql -u root -p < database/seed.sql
```

## 性能优化

1. **启用 CDN** - 七牛云自带 CDN 加速
2. **开启 Gzip** - Nginx 配置已包含
3. **浏览器缓存** - 静态资源缓存 30 天
4. **数据库索引** - 已优化查询索引
5. **图片压缩** - WebP + 自动缩略图

## 安全建议

1. ✅ 修改默认管理员密码
2. ✅ 配置 SSL 证书
3. ✅ 定期备份数据库
4. ✅ 限制上传文件大小
5. ✅ 配置防火墙规则
6. ✅ 定期更新依赖包

## 技术栈

- **后端**：Node.js + Express + MySQL
- **认证**：JWT + bcrypt
- **存储**：七牛云 OSS
- **图片处理**：Sharp
- **实时通信**：Socket.IO
- **前端**：原生 HTML/CSS/JavaScript
- **部署**：PM2 + Nginx

## 扩展建议

- [ ] 评论系统
- [ ] 人脸识别相册
- [ ] 水印功能
- [ ] 多语言支持
- [ ] 数据导出
- [ ] 访问密码
- [ ] 图片防盗链
- [ ] 更多云存储支持（阿里云 OSS、腾讯云 COS）

## 联系与支持

- 作者：Jack - 光感影视
- 问题反馈：查看 DEPLOY.md 和 README.md

---

**祝你使用愉快！🎉**
