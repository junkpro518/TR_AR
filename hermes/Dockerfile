FROM python:3.11-slim

WORKDIR /app

# تثبيت git و curl
RUN apt-get update && apt-get install -y git curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# استنساخ Hermes — depth=1 لضمان سرعة البناء وتثبيت نسخة محددة
RUN git clone --depth 1 https://github.com/NousResearch/hermes-agent.git /hermes

WORKDIR /hermes

# تثبيت المكتبات عبر pip مباشرةً (hermes-agent لا يدعم uv بشكل رسمي)
RUN pip install --no-cache-dir -e ".[all]" || pip install --no-cache-dir -r requirements.txt

# نسخ ملفات التكوين الخاصة بـ TR_AR
# ملاحظة: يُفترض تشغيل docker build من جذر المشروع (TR_AR/)
COPY hermes/cli-config.yaml /root/.hermes/cli-config.yaml
COPY hermes/MEMORY.md /root/.hermes/MEMORY.md
COPY hermes/USER.md /root/.hermes/USER.md
COPY hermes/.hermes.md /root/.hermes/.hermes.md
COPY hermes/skills/ /root/.hermes/skills/
COPY hermes/start.sh /hermes/start.sh

RUN chmod +x /hermes/start.sh

# Healthcheck: تحقق أن hermes يستجيب
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD hermes --version > /dev/null 2>&1 || exit 1

EXPOSE 8000

CMD ["/hermes/start.sh"]
