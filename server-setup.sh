#!/bin/bash
# =============================================================
#  server-setup.sh — إعداد VPS كامل من الصفر
#  Ubuntu 22.04 / 24.04
#  يُثبّت: Docker · Traefik v3 · n8n · هيكل المشاريع
# =============================================================
set -e

R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${G}  ✓ $1${NC}"; }
info() { echo -e "${B}▶ $1${NC}"; }
warn() { echo -e "${Y}  ⚠ $1${NC}"; }
err()  { echo -e "${R}  ✗ $1${NC}"; exit 1; }

# ── root check ────────────────────────────────────────────────
[ "$EUID" -ne 0 ] && err "شغّل السكريبت كـ root: sudo bash server-setup.sh"

# ── Ubuntu check ──────────────────────────────────────────────
. /etc/os-release
[[ "$ID" != "ubuntu" ]] && warn "تم الاختبار على Ubuntu فقط — تابع على مسؤوليتك"

echo ""
echo -e "${B}══════════════════════════════════════════════${NC}"
echo -e "${B}   إعداد VPS — Docker + Traefik + n8n         ${NC}"
echo -e "${B}══════════════════════════════════════════════${NC}"
echo ""

# ── جمع المعلومات ─────────────────────────────────────────────
read -rp "🌐 الدومين الرئيسي (مثال: example.com): "      DOMAIN
read -rp "📧 البريد الإلكتروني (لشهادة SSL): "           EMAIL
read -rp "👤 اسم المستخدم لـ Traefik Dashboard: "        TRAEFIK_USER
read -rsp "🔑 كلمة المرور لـ Traefik Dashboard: "        TRAEFIK_PASS; echo ""
read -rp "🤖 نشر n8n؟ (y/n): "                           INSTALL_N8N
read -rp "📦 نشر مشروع TR-AR؟ (y/n): "                  INSTALL_TRAR
if [[ "$INSTALL_TRAR" == "y" ]]; then
  read -rp "🔗 رابط GitHub للمشروع: "                    TRAR_REPO
  read -rp "🌐 سابدومين TR-AR (فارغ للدومين الرئيسي): "  TRAR_SUBDOMAIN
  TRAR_DOMAIN="${TRAR_SUBDOMAIN:+${TRAR_SUBDOMAIN}.}${DOMAIN}"
fi
echo ""

# ─────────────────────────────────────────────────────────────
# 1. تحديث النظام
# ─────────────────────────────────────────────────────────────
info "1/9 تحديث النظام..."
apt-get update -y -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw fail2ban apache2-utils
ok "النظام محدّث"

# ─────────────────────────────────────────────────────────────
# 2. Swap (2 GB) — مفيد للـ VPS الصغيرة
# ─────────────────────────────────────────────────────────────
info "2/9 إعداد Swap..."
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile -q
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  ok "Swap 2GB تم إنشاؤه"
else
  ok "Swap موجود مسبقاً"
fi

# ─────────────────────────────────────────────────────────────
# 3. جدار الحماية UFW
# ─────────────────────────────────────────────────────────────
info "3/9 إعداد UFW..."
ufw --force reset -q
ufw default deny incoming   -q
ufw default allow outgoing  -q
ufw allow 22/tcp            -q   # SSH
ufw allow 80/tcp            -q   # HTTP
ufw allow 443/tcp           -q   # HTTPS
ufw --force enable          -q
ok "UFW: منفذ 22، 80، 443 مفتوحة"

# ─────────────────────────────────────────────────────────────
# 4. تثبيت Docker
# ─────────────────────────────────────────────────────────────
info "4/9 تثبيت Docker..."
if command -v docker &>/dev/null; then
  ok "Docker مثبّت مسبقاً ($(docker --version | cut -d' ' -f3 | tr -d ','))"
else
  curl -fsSL https://get.docker.com | sh -q
  systemctl enable docker --now -q
  ok "Docker مثبّت"
fi

# ─────────────────────────────────────────────────────────────
# 5. Docker network مشترك
# ─────────────────────────────────────────────────────────────
info "5/9 إنشاء شبكة traefik-net..."
docker network create traefik-net 2>/dev/null || ok "الشبكة موجودة مسبقاً"
ok "traefik-net جاهزة"

# ─────────────────────────────────────────────────────────────
# 6. Traefik v3
# ─────────────────────────────────────────────────────────────
info "6/9 إعداد Traefik..."
mkdir -p /opt/traefik

# hashed password for dashboard basic auth
HASHED_PASS=$(htpasswd -nb "$TRAEFIK_USER" "$TRAEFIK_PASS" | sed 's/\$/\$\$/g')

# traefik.yml — إعداد ثابت
cat > /opt/traefik/traefik.yml <<TRAEFIK
api:
  dashboard: true

log:
  level: ERROR

entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
          permanent: true
  websecure:
    address: ":443"

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false
    network: traefik-net

certificatesResolvers:
  letsencrypt:
    acme:
      email: ${EMAIL}
      storage: /acme.json
      tlsChallenge: {}
TRAEFIK

# acme.json — يجب أن يكون chmod 600
touch /opt/traefik/acme.json
chmod 600 /opt/traefik/acme.json

# docker-compose.yml
cat > /opt/traefik/docker-compose.yml <<COMPOSE
services:
  traefik:
    image: traefik:v3
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yml:/traefik.yml:ro
      - ./acme.json:/acme.json
    networks:
      - traefik-net
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(\`traefik.${DOMAIN}\`)"
      - "traefik.http.routers.dashboard.entrypoints=websecure"
      - "traefik.http.routers.dashboard.tls.certresolver=letsencrypt"
      - "traefik.http.routers.dashboard.service=api@internal"
      - "traefik.http.routers.dashboard.middlewares=auth"
      - "traefik.http.middlewares.auth.basicauth.users=${HASHED_PASS}"

networks:
  traefik-net:
    external: true
COMPOSE

cd /opt/traefik && docker compose up -d
ok "Traefik يعمل على traefik.${DOMAIN}"

# ─────────────────────────────────────────────────────────────
# 7. n8n
# ─────────────────────────────────────────────────────────────
if [[ "$INSTALL_N8N" == "y" ]]; then
  info "7/9 إعداد n8n..."
  mkdir -p /opt/n8n/data

  cat > /opt/n8n/docker-compose.yml <<COMPOSE
services:
  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    volumes:
      - ./data:/home/node/.n8n
    environment:
      - N8N_HOST=n8n.${DOMAIN}
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://n8n.${DOMAIN}/
      - N8N_SECURE_COOKIE=true
      - GENERIC_TIMEZONE=Asia/Riyadh
    networks:
      - traefik-net
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.n8n.rule=Host(\`n8n.${DOMAIN}\`)"
      - "traefik.http.routers.n8n.entrypoints=websecure"
      - "traefik.http.routers.n8n.tls.certresolver=letsencrypt"
      - "traefik.http.services.n8n.loadbalancer.server.port=5678"

networks:
  traefik-net:
    external: true
COMPOSE

  cd /opt/n8n && docker compose up -d
  ok "n8n يعمل على n8n.${DOMAIN}"
else
  info "7/9 تخطّي n8n"
fi

# ─────────────────────────────────────────────────────────────
# 8. TR-AR
# ─────────────────────────────────────────────────────────────
if [[ "$INSTALL_TRAR" == "y" ]]; then
  info "8/9 نشر TR-AR..."
  mkdir -p /opt/tr-ar
  git clone "$TRAR_REPO" /opt/tr-ar || { cd /opt/tr-ar && git pull; }

  cat > /opt/tr-ar/.env <<ENV
# أضف قيمك الفعلية هنا
DOMAIN=${TRAR_DOMAIN}
OPENROUTER_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CHAT_MODEL=google/gemini-2.0-flash-001
ANALYSIS_MODEL=meta-llama/llama-3.1-8b-instruct
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
MISTRAL_API_KEY=
CRON_SECRET=tr_ar_cron_2024
NEXT_PUBLIC_APP_URL=https://${TRAR_DOMAIN}
ENV

  warn "يجب إضافة مفاتيح API قبل البناء:"
  warn "  nano /opt/tr-ar/.env"
  echo ""
  read -rp "أضفت المفاتيح؟ (y للبناء الآن / n للتخطّي): " BUILD_NOW
  if [[ "$BUILD_NOW" == "y" ]]; then
    cd /opt/tr-ar
    docker compose -f docker-compose.prod.yml build
    docker compose -f docker-compose.prod.yml up -d
    ok "TR-AR يعمل على ${TRAR_DOMAIN}"
  else
    warn "لنشر TR-AR لاحقاً: cd /opt/tr-ar && nano .env && bash deploy.sh"
  fi
else
  info "8/9 تخطّي TR-AR"
fi

# ─────────────────────────────────────────────────────────────
# 9. أوامر مساعدة
# ─────────────────────────────────────────────────────────────
info "9/9 إعداد أوامر المساعدة..."
cat > /usr/local/bin/vps <<'CMDS'
#!/bin/bash
# vps — أوامر مساعدة سريعة
case "$1" in
  status)   docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" ;;
  logs)     docker logs --tail 50 -f "${2:-traefik}" ;;
  restart)  docker restart "${2:?اذكر اسم الحاوية}" ;;
  stop)     docker stop "${2:?اذكر اسم الحاوية}" ;;
  update)
    case "$2" in
      traefik) cd /opt/traefik && docker compose pull && docker compose up -d ;;
      n8n)     cd /opt/n8n    && docker compose pull && docker compose up -d ;;
      tr-ar)   cd /opt/tr-ar  && bash deploy.sh ;;
      *) echo "استخدام: vps update [traefik|n8n|tr-ar]" ;;
    esac ;;
  *)
    echo "الاستخدام: vps [status|logs <name>|restart <name>|stop <name>|update <service>]"
    ;;
esac
CMDS
chmod +x /usr/local/bin/vps
ok "أمر vps جاهز"

# ─────────────────────────────────────────────────────────────
# ملخص
# ─────────────────────────────────────────────────────────────
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "IP_UNKNOWN")

echo ""
echo -e "${G}══════════════════════════════════════════════${NC}"
echo -e "${G}   ✅ الإعداد اكتمل!                          ${NC}"
echo -e "${G}══════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${B}IP السيرفر:${NC}  $SERVER_IP"
echo ""
echo -e "  ${B}الخدمات:${NC}"
echo -e "  • Traefik Dashboard  →  https://traefik.${DOMAIN}"
[[ "$INSTALL_N8N"  == "y" ]] && echo -e "  • n8n                →  https://n8n.${DOMAIN}"
[[ "$INSTALL_TRAR" == "y" ]] && echo -e "  • TR-AR              →  https://${TRAR_DOMAIN}"
echo ""
echo -e "  ${Y}⚠ تأكد من إضافة DNS A records:${NC}"
echo -e "  • traefik.${DOMAIN}  →  $SERVER_IP"
[[ "$INSTALL_N8N"  == "y" ]] && echo -e "  • n8n.${DOMAIN}      →  $SERVER_IP"
[[ "$INSTALL_TRAR" == "y" ]] && echo -e "  • ${TRAR_DOMAIN}     →  $SERVER_IP"
echo ""
echo -e "  ${B}أوامر مفيدة:${NC}"
echo -e "  vps status           ← حالة جميع الحاويات"
echo -e "  vps logs tr-ar       ← لوقات TR-AR"
echo -e "  vps update tr-ar     ← تحديث TR-AR"
echo -e "  vps update n8n       ← تحديث n8n"
echo ""
echo -e "  ${B}هيكل المجلدات:${NC}"
echo -e "  /opt/traefik/        ← Traefik"
[[ "$INSTALL_N8N"  == "y" ]] && echo -e "  /opt/n8n/            ← n8n + بياناته"
[[ "$INSTALL_TRAR" == "y" ]] && echo -e "  /opt/tr-ar/          ← TR-AR"
echo ""
