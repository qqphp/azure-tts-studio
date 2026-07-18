#!/usr/bin/env bash
# Azure TTS 一键启动 (macOS / Linux)
cd "$(dirname "$0")/backend" || exit 1
[ -d .venv ] || python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install -q -r requirements.txt
python main.py