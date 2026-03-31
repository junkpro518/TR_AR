#!/bin/bash
set -e

cd /hermes

# mcp_serve.py هو MCP stdio bridge — لا يقبل --host أو --port أو --config.
# التكوين يُقرأ من HERMES_HOME (افتراضي: ~/.hermes = /root/.hermes).
# الملف المطلوب: $HERMES_HOME/config.yaml (وليس cli-config.yaml).
export HERMES_HOME="${HERMES_HOME:-/root/.hermes}"

# تأكد من وجود config.yaml في HERMES_HOME
if [ ! -f "$HERMES_HOME/config.yaml" ]; then
    cp /root/.hermes/cli-config.yaml "$HERMES_HOME/config.yaml" 2>/dev/null || true
fi

# تشغيل Hermes MCP stdio bridge
# ملاحظة: هذا يعمل عبر stdio وليس HTTP — يجب إدارته كـ MCP server
exec python mcp_serve.py --verbose
