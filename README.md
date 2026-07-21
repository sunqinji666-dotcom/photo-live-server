# 📸 图片直播系统
![Photo Live Server 主视觉](docs/assets/hero-system-v1.png)

**中文** · [English](docs/README.en.md) · [日本語](docs/README.ja.md) · [繁體中文](docs/README.zh-TW.md) · [한국어](docs/README.ko.md) · [Español](docs/README.es.md) · [Français](docs/README.fr.md) · [Deutsch](docs/README.de.md) · [Português](docs/README.pt-BR.md) · [Русский](docs/README.ru.md) · [العربية](docs/README.ar.md) · [हिन्दी](docs/README.hi.md) · [Bahasa Indonesia](docs/README.id.md)

Contact: **Jacksun** · [qinji@jack-sun.com](mailto:qinji@jack-sun.com)

> A self-hosted photo event delivery service for uploads, galleries, and live updates.


专业的图片直播平台，支持实时上传、在线浏览、点赞互动等功能。

## ✨ 功能特性

### 前端功能
- 🖼️ **瀑布流布局** - 响应式瀑布流/网格视图切换
- 🔍 **图片灯箱** - 全屏查看、左右切换、触摸滑动
- 📂 **相册分类** - 按相册/标签筛选浏览
- ❤️ **点赞互动** - 实时点赞、计数显示
- 📡 **实时更新** - WebSocket 实时推送新照片通知
- 📱 **移动适配** - 完美适配手机端浏览
- 🔗 **分享功能** - 一键分享直播链接

### 后端功能
- 🔐 **用户认证** - JWT Token 认证，支持多角色权限管理
- 📤 **图片上传** - 支持单张/批量上传，自动压缩优化
- ☁️ **七牛云存储** - 自动上传至七牛云，CDN 加速
- 🖼️ **图片处理** - 自动生成缩略图、WebP 压缩
- 📷 **EXIF 信息** - 自动提取拍摄参数
- 📊 **数据统计** - 浏览量、点赞数等实时统计

## 🚀 快速部署

### 环境要求
- Node.js >= 16
- MySQL >= 5.7
- 七牛云账号（可选，也可用本地存储）

### 宝塔面板部署步骤

#### 1. 创建网站
1. 登录宝塔面板
2. 点击「网站」>「添加站点」
3. 填写域名，选择 PHP 版本为「纯静态」
4. 记录网站根目录路径（如 `/path/to/photo-live`）

#### 2. 上传文件
```bash
# 方式一：通过 Git
cd /path/to/photo-live
git clone <your-repo-url> .

# 方式二：通过宝塔文件管理器
# 将整个项目上传到网站根目录
```

#### 3. 安装依赖
```bash
cd /path/to/photo-live
npm install --production
```

#### 4. 配置数据库
1. 在宝塔面板创建 MySQL 数据库
   - 数据库名：`photo_live`
   - 用户名：自定义
   - 密码：自定义
2. 导入数据库
   - 点击「数据库」>「导入」
   - 选择 `database/init.sql` 文件

#### 5. 配置环境变量
```bash
cp .env.example .env
nano .env
```

编辑 `.env` 文件，填写正确的配置：
```env
# 数据库
DB_HOST=localhost
DB_USER=数据库用户名
DB_PASSWORD=数据库密码
DB_NAME=photo_live

# 七牛云（如不使用可留空）
QINIU_ACCESS_KEY=你的七牛云AK
QINIU_SECRET_KEY=你的七牛云SK
QINIU_BUCKET=你的七牛云空间名
QINIU_DOMAIN=https://你的七牛云域名
```

#### 6. 创建 Node.js 项目
1. 在宝塔面板点击「Node.js 项目」>「添加项目」
2. 项目路径：`/path/to/photo-live`
3. 启动文件：`server.js`
4. 端口：`3000`
5. 点击「启动」

#### 7. 配置反向代理
1. 进入网站设置 >「反向代理」
2. 添加反向代理
   - 代理名称：`photo-live`
   - 目标 URL：`http://localhost:3000`
   - 发送域名：`$host`
3. 启用反向代理

#### 8. 初始化默认账号
默认管理员账号：
- 用户名：`admin`
- 密码：`$DEFAULT_ADMIN_PASSWORD`

**⚠️ 首次登录后请立即修改密码！**

## 📁 项目结构

```
photo-live-server/
├── config/              # 配置文件
│   ├── database.js     # 数据库配置
│   └── qiniu.js        # 七牛云配置
├── database/           # 数据库脚本
│   └── init.sql       # 数据库初始化
├── middleware/         # 中间件
│   ├── auth.js        # 认证中间件
│   └── imageProcessor.js # 图片处理
├── routes/            # 路由
│   ├── auth.js       # 用户认证
│   ├── photos.js     # 图片管理
│   ├── lives.js      # 直播管理
│   └── albums.js     # 相册管理
├── photo-live/        # 前端文件
│   ├── index.html    # 主页面
│   ├── style.css     # 样式
│   └── app.js        # 交互逻辑
├── uploads/           # 临时上传目录
├── server.js          # 服务器入口
├── package.json       # 依赖配置
└── .env.example       # 环境变量示例
```

## 🔌 API 文档

### 自动化入口
```bash
node scripts/photo-live-cli.js auth create-key --username admin --password $DEFAULT_ADMIN_PASSWORD --name "CLI Access"
PHOTO_LIVE_API_KEY=plk_xxx node scripts/photo-live-cli.js lives list
PHOTO_LIVE_API_KEY=plk_xxx node scripts/photo-live-cli.js cleanup run
```

详细说明见 [API_AUTOMATION.md](./API_AUTOMATION.md)。

### 用户认证
```
POST /api/auth/register    # 注册
POST /api/auth/login       # 登录
GET  /api/auth/me          # 获取当前用户
GET  /api/auth/api-keys    # 获取当前账号 API Key 列表
POST /api/auth/api-keys    # 创建 API Key
DELETE /api/auth/api-keys/:id # 停用 API Key
PUT  /api/auth/me          # 更新用户信息
PUT  /api/auth/password    # 修改密码
```

### 图片管理
```
GET    /api/photos              # 获取图片列表
GET    /api/photos/:id          # 获取图片详情
POST   /api/photos/upload       # 上传单张图片
POST   /api/photos/upload-batch # 批量上传
POST   /api/photos/:id/like     # 点赞
PUT    /api/photos/:id          # 更新图片信息
DELETE /api/photos/:id          # 删除图片
```

### 直播管理
```
GET    /api/lives           # 获取直播列表
GET    /api/lives/:id       # 获取直播详情
POST   /api/lives           # 创建直播
PUT    /api/lives/:id       # 更新直播
DELETE /api/lives/:id       # 删除直播
```

### 相册管理
```
GET    /api/albums/live/:liveId  # 获取相册列表
POST   /api/albums               # 创建相册
PUT    /api/albums/:id           # 更新相册
DELETE /api/albums/:id           # 删除相册
```

## 🎨 使用说明

### 游客浏览
1. 直接访问直播页面
2. 浏览图片、查看详情
3. 点击放大、左右切换

### 摄影师上传
1. 登录账号（需摄影师或管理员权限）
2. 点击顶部「上传」按钮
3. 选择图片（支持多选）
4. 选择相册分类、填写标签
5. 点击「开始上传」

### 管理员操作
1. 创建新的直播活动
2. 管理相册分类
3. 管理用户账号
4. 删除不当内容

## ⚙️ 高级配置

### 七牛云图片样式
在七牛云后台创建图片样式，用于移动端自适应：
```
名称：mobile
处理接口：imageMogr2
参数：thumbnail/!500x500r/quality/75/format/webp
```

### Nginx 优化配置
```nginx
# 在宝塔面板网站配置中添加
client_max_body_size 50M;

# 开启 Gzip 压缩
gzip on;
gzip_types text/css application/javascript application/json;

# 静态资源缓存
location ~* \.(jpg|jpeg|png|gif|webp|css|js)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### PM2 进程管理（推荐）
```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start server.js --name photo-live

# 设置开机自启
pm2 startup
pm2 save
```

## 🐛 常见问题

### 1. 数据库连接失败
- 检查 `.env` 文件中的数据库配置
- 确认 MySQL 服务已启动
- 检查数据库用户权限

### 2. 图片上传失败
- 检查七牛云配置是否正确
- 确认服务器临时目录有写入权限
- 检查文件大小限制配置

### 3. WebSocket 连接失败
- 确认 Nginx 反向代理已配置 WebSocket 支持
- 检查防火墙是否阻止了端口

### 4. 图片加载慢
- 启用七牛云 CDN 加速
- 优化图片压缩参数
- 开启浏览器缓存

## 📝 更新日志

### v1.0.0 (2024-04-03)
- ✨ 初始版本发布
- ✨ 完整的图片直播功能
- ✨ 用户认证和权限管理
- ✨ 七牛云存储集成
- ✨ 实时 WebSocket 推送
- ✨ 移动端适配

## 📄 许可证

MIT License

## 👨‍💻 作者

光感影视 - Jack
