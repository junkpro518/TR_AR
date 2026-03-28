#!/bin/bash
# deploy.sh — تحديث التطبيق على الـ VPS
# الاستخدام: ssh user@vps "cd /var/www/tr-ar && bash deploy.sh"

set -e

echo "📦 جلب آخر تحديثات..."
git pull origin main

echo "📥 تثبيت الحزم..."
npm ci --production=false

echo "🔨 البناء..."
npm run build

echo "📋 نسخ الملفات الثابتة..."
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

echo "🔄 إعادة تشغيل PM2..."
pm2 reload ecosystem.config.js --update-env

echo "✅ تم النشر بنجاح!"
pm2 status tr-ar
