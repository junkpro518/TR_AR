FROM python:3.11-slim

WORKDIR /app

# تثبيت git و curl و uv
RUN apt-get update && apt-get install -y git curl && \
    pip install uv && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# استنساخ Hermes
RUN git clone https://github.com/NousResearch/hermes-agent.git /hermes

WORKDIR /hermes

# تثبيت المكتبات (uv أولاً، fallback لـ pip)
RUN uv pip install --system -e ".[all]" 2>/dev/null || \
    pip install -r requirements.txt

# نسخ ملفات التكوين الخاصة بـ TR_AR
COPY hermes/cli-config.yaml /hermes/cli-config.yaml
COPY hermes/MEMORY.md /hermes/MEMORY.md
COPY hermes/USER.md /hermes/USER.md
COPY hermes/.hermes.md /hermes/.hermes.md
COPY hermes/skills/ /hermes/skills/
COPY hermes/start.sh /hermes/start.sh

RUN chmod +x /hermes/start.sh

EXPOSE 8000

CMD ["/hermes/start.sh"]
