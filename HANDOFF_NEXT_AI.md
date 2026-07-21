# Handoff For Next AI

这个文件给下一个从零读取项目的 AI 使用。

## 1. 项目位置

- 本地源码根目录：`/Users/jacksun/photo-live-server`
- 当前对话工作目录：`/Users/jacksun/Documents/codex`

## 2. 线上部署信息

- 服务器：`119.29.193.16`
- 站点：`http://zhibo.jack-sun.com`
- 站点目录：`/www/wwwroot/zhibo.jack-sun.com`
- PM2 进程名：`zhibo-photo-live`
- 健康检查：`http://zhibo.jack-sun.com/api/health`

## 3. 当前核心状态

- 前后台都已可用，图片存储模式为七牛云
- 现有系统已支持：
  - 后台管理
  - 客户观看页
  - 七牛直传
  - 原图/压缩图/批量下载
  - 后台一键清理无用数据
  - 同图跨相册秒传复用
  - API Key 认证
  - CLI 命令行操作

## 4. 本次新增的重要能力

### 一键清理无用数据

- 后台按钮：顶部 `清理无用数据`
- 后端路由：`/api/maintenance/cleanup-jobs`
- 功能：
  - 扫描七牛云无引用文件
  - 清理过期下载记录
  - 清理临时文件
  - 后台右下角显示阶段、进度和统计

关键文件：

- `/Users/jacksun/photo-live-server/routes/maintenance.js`
- `/Users/jacksun/photo-live-server/public/admin/app.js`
- `/Users/jacksun/photo-live-server/public/admin/style.css`

### API Key + CLI

- 认证中间件已支持：
  - `Authorization: Bearer <jwt>`
  - `X-API-Key: plk_xxx`
- API Key 接口：
  - `GET /api/auth/api-keys`
  - `POST /api/auth/api-keys`
  - `DELETE /api/auth/api-keys/:id`
- CLI 脚本：
  - `/Users/jacksun/photo-live-server/scripts/photo-live-cli.js`

当前 CLI 支持：

- 创建 API Key
- 查看当前身份
- 列相册
- 创建相册
- 发起清理
- 查询清理状态

## 5. 文档文件

优先阅读这些文件：

- `/Users/jacksun/photo-live-server/DEPLOY_PROGRESS.md`
- `/Users/jacksun/photo-live-server/API_AUTOMATION.md`
- `/Users/jacksun/photo-live-server/PRODUCT_DESIGN.md`
- `/Users/jacksun/photo-live-server/research/YIPAI_RESEARCH.md`

## 6. 已确认有效的事实

- 后台清理任务已经在线真实执行成功
- API Key 和 CLI 已在线真实验证成功
- 临时测试用 API Key 已停用，没有保留多余长期入口
- 后台总览已改成三栏紧凑结构：新建相册 / 相册列表 / 账号管理
- 相册详情已改成左侧竖排导航，上传入口改为照片列表第一张“上传卡片 + 弹窗”
- 多用户权限不再只是登录层：管理员看全部，摄影师只看自己创建或被分配的相册
- 2026-04-04 已在线真实验证过：临时摄影师账号登录后返回空相册列表，说明相册范围限制已生效；测试账号随后已删除
- 2026-04-04 已完成第二段性能优化：照片搜索已从扫 `exif_data` JSON 切到结构化字段和索引
- `photos` 表当前已有结构化搜索列：`camera_search / lens_search / focal_length_search / aperture_search / shutter_speed_search / iso_value / format_value / search_text`
- `config/database.js` 会在启动时自动补列、补索引并回填旧数据；`routes/photos.js` 上传和编辑链路会持续维护这些字段

## 7. 如果继续开发，最建议的下一步

1. 继续把“找照片”做成真正的高级筛选面板，直接按机身 / 镜头 / ISO / 格式筛
2. 继续把 CLI 扩展到上传、批量改图、相册设置
3. 输出正式 OpenAPI 文档
4. 给后台加 API Key 管理界面
5. 给上传和清理任务补 webhook / 回调能力
6. 如果继续做多用户，优先把 `live_members` 的前端分配界面补出来，让管理员能把某个相册分给指定摄影师

## 8. 注意事项

- 不要随意删除七牛文件；系统现在允许跨相册复用同一云端对象
- 删除照片时要继续保持“只有无任何引用时才删云端对象”的逻辑
- 用户很重视：
  - 页面审美
  - 客户端体验
  - 不浪费七牛空间
  - 不依赖 GUI，支持 API / CLI / AI 自动化
