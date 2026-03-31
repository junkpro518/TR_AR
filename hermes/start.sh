#!/bin/bash
set -e

cd /hermes

# تشغيل Hermes كخادم OpenAI-compatible API على port 8000
exec python mcp_serve.py \
  --host 0.0.0.0 \
  --port 8000 \
  --config /hermes/cli-config.yaml
