# 照片直播网站设计方案

更新时间: 2026-04-03

## 目标

做一个可独立部署的照片直播网站，分为两套系统:

- 观众端: 客户/嘉宾浏览活动照片、筛选相册、查看详情、分享、下载展示图
- 管理端: 摄影师/管理员创建直播、上传照片、管理相册、配置活动信息、权限控制

设计参考来源:

- 本地报告: `/Users/jacksun/Documents/个人档案/一拍即传·完整技术分析报告.md`
- 实际验证记录: `/Users/jacksun/photo-live-server/research/YIPAI_RESEARCH.md`

## 先做什么

优先做一套“强可用版本”，而不是一开始追求完全复制 SaaS 全量功能。

第一阶段必须上线的能力:

- 活动列表与活动详情
- 照片直播前台
- 后台登录
- 直播创建与编辑
- 相册管理
- 批量上传照片
- 水印图生成
- 照片搜索/筛选/排序
- 活动信息配置
- 分享链接
- 基础权限控制
- 操作日志

第二阶段增强能力:

- 分享海报
- 批量下载原图/水印图
- 直播访问密码
- 审核照片
- 观众上传
- 多摄影师协作
- 多相册合集
- 封面/主题皮肤

第三阶段高级能力:

- AI 修图
- 付费下载
- 标签智能筛选
- 人脸识别分组
- 微信裂变/二维码海报

## 信息架构

### 管理端

一级导航建议保持 6 个主区块:

1. 照片管理
2. 基本信息
3. 相册美化
4. 特色功能
5. 分享下载
6. 权限管理

附加页:

- 操作记录

### 观众端

观众端拆成 4 个核心区域:

1. 活动头图区
2. 数据概览区
3. 功能操作区
4. 照片流与灯箱区

## 页面设计

### 1. 管理端列表页

路径:

- `/admin`

布局:

- 左侧直播列表
- 顶部账号/帮助/退出
- 中间卡片网格显示活动
- 顶部筛选: 全部、直播中、待拍摄、已结束
- 搜索框
- 新建活动卡片

卡片字段:

- 封面图
- 活动标题
- 活动状态
- 照片数量
- 创建者/摄影师
- 分享入口
- 下载入口

### 2. 管理端活动详情

路径:

- `/admin/live/:id`

左侧菜单:

- 照片管理
- 基本信息
- 相册美化
- 特色功能
- 分享下载
- 权限管理
- 操作记录

### 3. 基本信息页

字段:

- 页面标题
- 活动主题
- 副标题
- 活动时间
- 活动地点
- 活动简介
- 背景音乐
- 封面图
- 主题色
- 手机端预览

### 4. 照片管理页

顶部操作:

- 显示中数量
- 隐藏数量
- 未发布数量
- 回收站数量
- 批量管理开关
- 搜索文件名
- 按相册筛选
- 按摄影师筛选
- 按时间/热度排序

照片卡片:

- 缩略图
- 文件名
- 摄影师
- 拍摄时间
- 状态标签

右侧详情抽屉:

- 标题
- 描述
- 标签
- 所属相册
- 公开状态
- 原图链接
- 删除按钮

### 5. 相册美化页

第一版建议先做:

- 皮肤选择
- 封面图设置
- Banner 图设置
- 横版水印
- 竖版水印
- 分享标题
- 分享描述

### 6. 分享下载页

第一版建议先做:

- 直播链接复制
- 前台二维码
- 展示图下载
- 原图打包下载
- 水印图打包下载

### 7. 权限管理页

角色:

- admin
- manager
- photographer
- retoucher

第一版权限项:

- 添加摄影师
- 删除摄影师
- 上传照片
- 编辑照片信息
- 删除照片
- 下载原图
- 下载水印图
- 设置活动信息
- 设置分享信息
- 开启访问密码

### 8. 观众端首页

路径:

- `/live/:slug`

页面结构:

- 顶部活动头图
- 标题/时间/地点
- 浏览量/点赞量/照片数量
- 相册筛选条
- 功能按钮:
  - 照片
  - 浏览设置
  - 拼图分享
  - 批量下载
- 瀑布流照片网格
- 灯箱查看

### 9. 观众端浏览设置

第一版建议支持:

- 按时间排序
- 按热度排序
- 按相册筛选
- 显示摄影师名称
- 是否允许下载展示图

## 数据模型

### lives

- id
- title
- slug
- subtitle
- description
- event_date
- location_name
- cover_image
- banner_image
- theme_color
- share_title
- share_description
- share_logo
- watermark_enabled
- watermark_text
- access_code
- status
- created_by
- created_at
- updated_at

### albums

- id
- live_id
- name
- icon
- cover_image
- sort_order
- is_default
- photo_count
- created_at

### photos

- id
- live_id
- album_id
- photographer_id
- title
- description
- tags
- original_url
- compressed_url
- thumbnail_url
- watermarked_url
- width
- height
- file_size
- shot_at
- view_count
- like_count
- download_count
- is_public
- is_deleted
- ai_status
- created_at

### users

- id
- username
- password
- nickname
- role
- avatar
- mobile
- status
- created_at

### live_members

- id
- live_id
- user_id
- role
- permissions
- created_at

### activity_logs

- id
- live_id
- user_id
- action
- target_type
- target_id
- detail
- created_at

## 技术设计

后端:

- Node.js + Express
- MySQL
- Socket.IO
- Sharp 图片处理
- 本地存储优先，七牛可选

前端:

- 管理端先继续用原生 HTML/CSS/JS，减少部署复杂度
- 观众端继续保持轻量 SPA 结构

存储策略:

- 原图
- 压缩图
- 缩略图
- 水印图

## 与竞品对齐但不照抄的策略

我们不追求 1:1 复制，而是做“结构对齐 + 体验优化”。

保留竞品的:

- 后台六大分区
- 左侧菜单结构
- 照片工作台逻辑
- 观众端头图 + 相册 + 功能栏 + 瀑布流

我们自己的优化:

- 后台交互更简单
- 配置字段更聚焦
- 部署更轻
- 本地存储和七牛二选一
- 可直接在宝塔跑起来

## 当前项目与目标差距

已完成:

- 前后台基础框架
- 直播管理
- 相册管理
- 照片上传
- 水印生成
- 前台展示
- 后台基础工作台

下一步必须补:

- 活动信息单独页面
- 主题/美化设置页
- 分享下载页
- 权限管理页
- 操作日志页
- 观众端功能栏
- 访问密码页
- 批量下载

## 开发顺序

1. 重构管理端路由与左侧菜单
2. 拆出“活动信息 / 分享下载 / 权限管理 / 操作日志”页面
3. 补数据库字段与日志表
4. 补对应 API
5. 优化观众端头图和功能栏
6. 增加下载/密码访问能力
7. 最后再考虑 AI 修图
