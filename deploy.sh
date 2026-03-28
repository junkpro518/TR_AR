#!/bin/bash
# deploy.sh — تحديث TR_AR على الـ VPS
# الاستخدام: ssh user@vps "cd /opt/tr-ar && bash deploy.sh"

set -e

GREEN='\033[0;32m'; NC='\033[0m'
ok() { echo -e "${GREEN}✓ $1${NC}"; }

echo "🔄 جلب آخر تحديثات..."
git pull origin main
ok "git pull"

echo "🔨 بناء الصورة..."
docker compose -f docker-compose.prod.yml build --no-cache
ok "build"

echo "🚀 إعادة التشغيل..."
docker compose -f docker-compose.prod.yml up -d --force-recreate
ok "deployed"

echo ""
echo "📋 حالة الحاوية:"
docker ps --filter name=tr-ar --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
