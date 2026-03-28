#!/bin/bash
# setup-vps.sh — إعداد VPS من الصفر (Ubuntu 22.04 / 24.04)
# الاستخدام: bash setup-vps.sh

set -e

APP_DIR="/var/www/tr-ar"
REPO_URL="https://github.com/moradbotai/TR_AR.git"   # ← غيّر إذا لزم

echo "=============================="
echo "  إعداد سيرفر TR_AR"
echo "=============================="

# 1. تحديث النظام
echo "⚙️  تحديث النظام..."
apt-get update -y && apt-get upgrade -y

# 2. تثبيت Node.js 20
echo "📦 تثبيت Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. تثبيت PM2 + Nginx
echo "📦 تثبيت PM2 و Nginx..."
npm install -g pm2
apt-get install -y nginx git

# 4. استنساخ المشروع
echo "📂 استنساخ المشروع..."
mkdir -p $APP_DIR
git clone $REPO_URL $APP_DIR
cd $APP_DIR

# 5. إعداد متغيرات البيئة
echo ""
echo "⚠️  أنشئ ملف .env.local قبل المتابعة:"
echo "    cp .env.example .env.local && nano .env.local"
echo ""
read -p "اضغط Enter بعد إعداد .env.local..."

# 6. تثبيت الحزم والبناء
echo "📥 تثبيت الحزم..."
npm ci

echo "🔨 البناء..."
npm run build

echo "📋 نسخ الملفات الثابتة..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

# 7. تشغيل PM2
echo "🚀 تشغيل التطبيق..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash

# 8. إعداد Nginx
echo "🌐 إعداد Nginx..."
cp nginx.conf /etc/nginx/sites-available/tr-ar
ln -sf /etc/nginx/sites-available/tr-ar /etc/nginx/sites-enabled/tr-ar
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "=============================="
echo "  ✅ الإعداد اكتمل!"
echo "=============================="
echo ""
echo "  التطبيق يعمل على: http://$(curl -s ifconfig.me)"
echo ""
echo "  لتفعيل HTTPS (Let's Encrypt):"
echo "    apt install certbot python3-certbot-nginx -y"
echo "    certbot --nginx -d your-domain.com"
echo ""
echo "  لمتابعة اللوقات:"
echo "    pm2 logs tr-ar"
echo ""
echo "  للتحديث لاحقاً:"
echo "    cd $APP_DIR && bash deploy.sh"
