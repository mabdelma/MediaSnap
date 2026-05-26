@echo off
setlocal EnableDelayedExpansion
title MediaSnap - Auto Install & Run
color 0A
cd /d "%~dp0"

echo.
echo  =====================================================
echo    MediaSnap - Automatic Install ^& Launch
echo  =====================================================
echo  This will install Python, Node.js, ffmpeg, and
echo  all app dependencies, then start the app.
echo  It needs an internet connection.
echo  =====================================================
echo.
pause

:: ── Check winget ──────────────────────────────────────────────────────────────
winget --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo  [ERROR] winget is not available on this PC.
    echo.
    echo  Please install manually:
    echo    Python 3.12  ->  https://python.org/downloads
    echo    Node.js 20   ->  https://nodejs.org
    echo    ffmpeg       ->  https://ffmpeg.org/download.html
    echo.
    echo  Then double-click setup.bat, then start.bat.
    pause
    exit /b 1
)
echo  [OK] winget found
echo.

:: ── Install Python ────────────────────────────────────────────────────────────
python --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  Installing Python 3.12...
    winget install --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
    :: Refresh PATH
    set "PATH=%LOCALAPPDATA%\Programs\Python\Python312;%LOCALAPPDATA%\Programs\Python\Python312\Scripts;%PATH%"
    python --version >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo.
        echo  [ERROR] Python installed but not on PATH yet.
        echo  Please CLOSE this window, then open a NEW Command Prompt
        echo  and double-click install-and-run.bat again.
        pause & exit /b 1
    )
    echo  [OK] Python installed
) else (
    for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo  [OK] %%v already installed
)

:: ── Install Node.js ───────────────────────────────────────────────────────────
node --version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  Installing Node.js 20 LTS...
    winget install --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
    node --version >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo.
        echo  [ERROR] Node.js installed but not on PATH yet.
        echo  Please CLOSE this window, open a NEW Command Prompt,
        echo  and double-click install-and-run.bat again.
        pause & exit /b 1
    )
    echo  [OK] Node.js installed
) else (
    for /f "tokens=*" %%v in ('node --version 2^>^&1') do echo  [OK] Node.js %%v already installed
)

:: ── Install ffmpeg ────────────────────────────────────────────────────────────
ffmpeg -version >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo  Installing ffmpeg...
    winget install --id Gyan.FFmpeg --silent --accept-package-agreements --accept-source-agreements
    :: Common ffmpeg paths after winget install
    set "PATH=%ProgramFiles%\ffmpeg\bin;%PATH%"
    ffmpeg -version >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo  [WARN] ffmpeg installed but not yet on PATH.
        echo         Audio extraction will work after you restart your terminal.
        echo         Continuing anyway...
    ) else (
        echo  [OK] ffmpeg installed
    )
) else (
    echo  [OK] ffmpeg already installed
)

echo.
echo  =====================================================
echo   All prerequisites ready. Running setup...
echo  =====================================================
echo.

:: ── Run app setup ─────────────────────────────────────────────────────────────
call "%~dp0setup.bat"
if %ERRORLEVEL% neq 0 (
    echo.
    echo  [ERROR] Setup failed. See messages above.
    pause & exit /b 1
)

echo.
echo  =====================================================
echo   Setup done. Launching MediaSnap...
echo  =====================================================
echo.

:: ── Launch ────────────────────────────────────────────────────────────────────
call "%~dp0start.bat"
