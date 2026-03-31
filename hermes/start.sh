#!/bin/bash
set -e

export HERMES_HOME="${HERMES_HOME:-/root/.hermes}"

# تأكد من وجود config.yaml (hermes يبحث عن config.yaml لا cli-config.yaml)
if [ ! -f "$HERMES_HOME/config.yaml" ]; then
    cp "$HERMES_HOME/cli-config.yaml" "$HERMES_HOME/config.yaml" 2>/dev/null || true
fi

# شغّل الـ HTTP gateway — يستقبل طلبات OpenAI-compatible على port 8000
# ويستدعي hermes-agent داخلياً (run_agent.py --query) لكل رسالة
exec python /hermes/gateway.py
