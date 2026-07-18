@echo off
REM Azure TTS 一键启动 (Windows)
cd /d "%~dp0backend"
if not exist .venv (
    python -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install -q -r requirements.txt
python main.py
pause