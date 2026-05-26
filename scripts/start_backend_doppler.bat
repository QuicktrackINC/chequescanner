@echo off
setlocal
cd /d "%~dp0\.."
title Quick Track - Backend (DOPPLER VENV MODE)

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment (.venv) not found.
    echo Please run 'python -m venv .venv' and Pip install first.
    pause
    exit /b
)

echo Starting backend using Doppler injected secrets...
doppler run -- ".venv\Scripts\python.exe" -m uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload
pause
