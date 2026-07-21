#!/bin/bash

# 📸 图片直播系统 - 快速启动脚本（本地测试）

echo "======================================"
echo "  📸 图片直播系统 - 本地测试启动"
echo "======================================"
echo ""

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 检查 .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 创建 .env 文件...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ 已创建 .env，请编辑后重试${NC}"
    exit 1
fi

# 创建必要目录
mkdir -p uploads/temp logs

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 安装依赖...${NC}"
    npm install
fi

echo ""
echo -e "${GREEN}🚀 启动服务器...${NC}"
echo ""
echo -e "访问地址: ${YELLOW}http://localhost:3000${NC}"
echo -e "默认账号: ${YELLOW}admin / admin123${NC}"
echo ""
echo -e "${RED}按 Ctrl+C 停止服务${NC}"
echo ""

# 启动
node server.js
