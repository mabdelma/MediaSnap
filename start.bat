@echo off
setlocal EnableDelayedExpansion
title MediaSnap - Launcher
color 0A

echo.
echo  =====================================================
echo    MediaSnap  v2.0  - Starting...
echo  =====================================================
echo.

:: ── Verify setup has been run ─────────────────────────────────────────────────
if not exist backend\venv (
    echo  [ERROR] Backend not set up yet.
    echo  Please run setup.bat first.
    pause
    exit /b 1
)
if not exist frontend\node_modules (
    echo  [ERROR] Frontend not set up yet.
    echo  Please run setup.bat first.
    pause
    exit /b 1
)

:: ── Create downloads dir if missing ──────────────────────────────────────────
if not exist backend\downloads mkdir backend\downloads

:: ── Start backend in a new window ────────────────────────────────────────────
echo  Starting backend (FastAPI)...
start "MediaSnap Backend" cmd /k ^
    "cd /d "%~dp0backend" && ^
     call venv\Scripts\activate.bat && ^
     echo. && ^
     echo  Backend running at http://localhost:8000 && ^
     echo  API docs:  http://localhost:8000/docs && ^
     echo  Press Ctrl+C to stop. && ^
     echo. && ^
     uvicorn main:app --reload --host 127.0.0.1 --port 8000"

:: ── Wait 2 seconds for backend to initialise ─────────────────────────────────
echo  Waiting for backend to start...
timeout /t 2 >nul

:: ── Start frontend in a new window ───────────────────────────────────────────
echo  Starting frontend (React/Vite)...
start "MediaSnap Frontend" cmd /k ^
    "cd /d "%~dp0frontend" && ^
     echo. && ^
     echo  Frontend running at http://localhost:5173 && ^
     echo  Press Ctrl+C to stop. && ^
     echo. && ^
     npm run dev"

:: ── Wait for frontend to be ready, then open browser ─────────────────────────
echo  Opening browser in 4 seconds...
timeout /t 4 >nul
start http://localhost:5173

echo.
echo  =====================================================
echo    MediaSnap  v2.0  is running!
echo  =====================================================
echo.
echo   App:         http://localhost:5173
echo   API:         http://localhost:8000
echo   API docs:    http://localhost:8000/docs
echo.
echo   Features:
echo    - 1000+ platforms  (YouTube, Twitter/X, Vimeo, Twitch...)
echo    - 5 languages      (EN / AR / ES / FR / PT)
echo    - Dark + Light theme
echo    - Audio / Video quality selector
echo    - Scheduled downloads
echo    - Desktop notifications
echo    - Speed limit control
echo    - Browser extension  ->  browser-extension\INSTALL.md
echo.
echo  Close the two terminal windows to stop MediaSnap.
echo.
pause
