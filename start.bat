@echo off
REM Azure TTS 一键启动 (Windows)
set "PROJECT_DIR=%~dp0"

if not exist "%PROJECT_DIR%frontend\dist\index.html" (
    where npm >nul 2>nul
    if errorlevel 1 (
        echo [ERROR] Node.js/npm is required to build the frontend.
        exit /b 1
    )
    pushd "%PROJECT_DIR%frontend"
    if not exist node_modules (
        call npm ci
        if errorlevel 1 exit /b 1
    )
    call npm run build
    if errorlevel 1 exit /b 1
    popd
)

cd /d "%PROJECT_DIR%backend"
if not exist .venv (
    python -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install -q -r requirements.txt
python main.py
pause
