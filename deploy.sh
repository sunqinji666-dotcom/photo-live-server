#!/bin/bash

# 📸 图片直播系统 - 宝塔面板一键部署脚本

echo "======================================"
echo "  📸 图片直播系统 - 部署脚本"
echo "======================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 未检测到 Node.js，请先安装 Node.js 16+${NC}"
    echo "安装命令: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "然后: sudo apt-get install -y nodejs"
    exit 1
fi

echo -e "${GREEN}✅ Node.js 版本: $(node -v)${NC}"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ 未检测到 npm${NC}"
    exit 1
fi

echo -e "${GREEN}✅ npm 版本: $(npm -v)${NC}"
echo ""

# 获取项目路径
PROJECT_DIR=$(pwd)
echo -e "${YELLOW}📁 项目路径: ${PROJECT_DIR}${NC}"
echo ""

# 安装依赖
echo -e "${YELLOW}📦 正在安装依赖...${NC}"
npm install --production

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 依赖安装完成${NC}"
else
    echo -e "${RED}❌ 依赖安装失败${NC}"
    exit 1
fi

echo ""

# 创建必要目录
echo -e "${YELLOW}📂 创建必要目录...${NC}"
mkdir -p uploads/temp
mkdir -p logs

# 检查 .env 文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 创建 .env 配置文件...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ 已创建 .env 文件${NC}"
    echo -e "${YELLOW}⚠️  请编辑 .env 文件，填写正确的配置${NC}"
    echo ""
fi

# 检查数据库
echo "======================================"
echo "  数据库配置"
echo "======================================"
echo ""
echo -e "${YELLOW}请确保已完成以下操作：${NC}"
echo "1. 在宝塔面板创建 MySQL 数据库"
echo "2. 导入 database/init.sql 文件"
echo "3. 在 .env 文件中填写数据库配置"
echo ""

# 创建 PM2 配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'photo-live',
    script: 'server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
EOF

echo -e "${GREEN}✅ 已创建 PM2 配置文件${NC}"
echo ""

# 询问是否启动
echo "======================================"
echo "  启动服务"
echo "======================================"
echo ""
read -p "是否立即启动服务？(y/n): " START_SERVICE

if [ "$START_SERVICE" = "y" ] || [ "$START_SERVICE" = "Y" ]; then
    # 检查 PM2
    if command -v pm2 &> /dev/null; then
        echo -e "${YELLOW}🚀 使用 PM2 启动服务...${NC}"
        pm2 start ecosystem.config.js
        pm2 save
    else
        echo -e "${YELLOW}🚀 使用 Node.js 直接启动...${NC}"
        echo "运行: node server.js &"
        node server.js &
    fi
    
    echo ""
    echo "======================================"
    echo -e "${GREEN}  🎉 部署完成！${NC}"
    echo "======================================"
    echo ""
    echo -e "服务地址: ${GREEN}http://localhost:3000${NC}"
    echo -e "默认管理员账号: ${YELLOW}admin / admin123${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  请记得：${NC}"
    echo "1. 修改默认管理员密码"
    echo "2. 配置 Nginx 反向代理"
    echo "3. 配置七牛云存储（可选）"
    echo "4. 设置 SSL 证书（推荐）"
    echo ""
else
    echo ""
    echo "======================================"
    echo -e "${GREEN}  📦 部署完成（未启动服务）${NC}"
    echo "======================================"
    echo ""
    echo -e "启动命令: ${YELLOW}pm2 start ecosystem.config.js${NC}"
    echo -e "或直接运行: ${YELLOW}node server.js${NC}"
    echo ""
fi
