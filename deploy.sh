#!/bin/bash
# deploy.sh — تحديث TR-AR على الـ VPS
# الاستخدام: cd /opt/tr-ar && bash deploy.sh

set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

# تحقق من وجود .env
if [ ! -f .env ]; then
  warn "لم يُوجد ملف .env — انسخ من .env.example وأضف قيمك:"
  echo "  cp .env.example .env && nano .env"
  exit 1
fi

echo "🔄 جلب آخر تحديثات..."
git pull origin main
ok "git pull"

echo "🔨 بناء الصور (tr-ar + hermes)..."
docker compose -f docker-compose.prod.yml build
ok "build"

echo "🚀 إعادة التشغيل..."
docker compose -f docker-compose.prod.yml up -d --remove-orphans
ok "deployed"

echo "⏳ انتظار صحة الحاوية..."
sleep 10
docker inspect --format='{{.State.Health.Status}}' tr-ar 2>/dev/null || true

echo ""
echo "📋 حالة الحاوية:"
docker ps --filter name=tr-ar --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
ok "تم النشر على https://tr-ar.junkpro.duckdns.org"
