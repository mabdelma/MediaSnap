@echo off
setlocal EnableDelayedExpansion
title MediaSnap - First-Time Setup
color 0A

echo.
echo  ============================================
echo    MediaSnap - First-Time Setup
echo  ============================================
echo.

:: ── Check Python ──────────────────────────────────────────────────────────────
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  [ERROR] Python is not installed or not in PATH.
    echo  Please install Python 3.9+ from https://python.org/downloads
    echo  Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do echo  [OK] %%i found

:: ── Check Node.js ─────────────────────────────────────────────────────────────
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  [ERROR] Node.js is not installed or not in PATH.
    echo  Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version 2^>^&1') do echo  [OK] Node.js %%i found

:: ── Check ffmpeg ──────────────────────────────────────────────────────────────
ffmpeg -version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo  [WARN] ffmpeg is NOT installed.
    echo         ffmpeg is required for:
    echo           - Merging video + audio (1080p, 720p downloads)
    echo           - Audio-only extraction (MP3, M4A, etc.)
    echo.
    echo  Install options:
    echo    1. Run:  winget install ffmpeg
    echo    2. Or download from https://ffmpeg.org/download.html
    echo       and add the bin\ folder to your PATH.
    echo.
    echo  Press any key to continue setup anyway (some features will not work)...
    pause >nul
) else (
    echo  [OK] ffmpeg found
)

:: ── Backend setup ─────────────────────────────────────────────────────────────
echo.
echo  [1/3] Setting up Python virtual environment...
cd backend

if exist venv (
    echo       Virtual environment already exists, updating...
) else (
    python -m venv venv
    if %ERRORLEVEL% neq 0 (
        echo  [ERROR] Failed to create virtual environment.
        pause & exit /b 1
    )
)

call venv\Scripts\activate.bat
echo  [2/3] Installing Python dependencies (this may take a minute)...
pip install -r requirements.txt --quiet
if %ERRORLEVEL% neq 0 (
    echo  [ERROR] pip install failed. Check your internet connection.
    pause & exit /b 1
)
echo  [OK] Backend dependencies installed
call venv\Scripts\deactivate.bat
cd ..

:: ── Frontend setup ────────────────────────────────────────────────────────────
echo  [3/3] Installing frontend dependencies (this may take a minute)...
cd frontend
call npm install --silent
if %ERRORLEVEL% neq 0 (
    echo  [ERROR] npm install failed. Check your internet connection.
    pause & exit /b 1
)
echo  [OK] Frontend dependencies installed
cd ..

:: ── Create data directory for Docker ─────────────────────────────────────────
if not exist data\downloads mkdir data\downloads
echo {} > data\settings.json
echo [] > data\history.json

:: ── Done ──────────────────────────────────────────────────────────────────────
echo.
echo  ============================================
echo    Setup complete!
echo  ============================================
echo.
echo  To start MediaSnap, double-click:  start.bat
echo.
pause
