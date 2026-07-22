#!/usr/bin/env bash
# Azure TTS 一键启动 (macOS / Linux)
set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$PROJECT_DIR/frontend/dist/index.html" ]; then
  command -v npm >/dev/null 2>&1 || { echo "[ERROR] Node.js/npm is required to build the frontend." >&2; exit 1; }
  cd "$PROJECT_DIR/frontend"
  [ -d node_modules ] || npm ci
  npm run build
fi

cd "$PROJECT_DIR/backend"
[ -d .venv ] || python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install -q -r requirements.txt
python main.py
