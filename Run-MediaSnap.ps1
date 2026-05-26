#Requires -Version 5.1
<#
.SYNOPSIS
  MediaSnap one-click installer + launcher for Windows.
  Run from the video-downloader folder:
      Right-click → "Run with PowerShell"
  Or from an admin PowerShell:
      Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
      .\Run-MediaSnap.ps1
#>

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

function Write-Step($msg) { Write-Host "`n  >> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "  [OK] $msg"      -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  [WARN] $msg"    -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  [ERROR] $msg`n" -ForegroundColor Red; Read-Host "Press Enter to exit"; exit 1 }

Write-Host ""
Write-Host "  =================================================" -ForegroundColor Magenta
Write-Host "    MediaSnap v2.0 - Auto Install & Launch"          -ForegroundColor Magenta
Write-Host "  ================================================="  -ForegroundColor Magenta
Write-Host ""

# ── Helper: reload PATH from registry ─────────────────────────────────────────
function Reload-Path {
    $machinePath = [System.Environment]::GetEnvironmentVariable('Path','Machine')
    $userPath    = [System.Environment]::GetEnvironmentVariable('Path','User')
    $env:Path    = "$machinePath;$userPath"
}

# ── Helper: install via winget ─────────────────────────────────────────────────
function Install-WingetApp($id, $name) {
    Write-Step "Installing $name..."
    try {
        winget install --id $id --silent --accept-package-agreements --accept-source-agreements | Out-Null
        Reload-Path
        Write-OK "$name installed"
    } catch {
        Write-Warn "winget install failed for $name — try installing manually"
    }
}

# ── Check winget ───────────────────────────────────────────────────────────────
Write-Step "Checking prerequisites..."
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Err "winget not found.`n  Install App Installer from the Microsoft Store, then retry."
}
Write-OK "winget found"

# ── Python ─────────────────────────────────────────────────────────────────────
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Install-WingetApp 'Python.Python.3.12' 'Python 3.12'
    Reload-Path
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
        # Try common install path directly
        $pyPath = "$env:LOCALAPPDATA\Programs\Python\Python312"
        if (Test-Path "$pyPath\python.exe") {
            $env:Path = "$pyPath;$pyPath\Scripts;$env:Path"
            Write-OK "Python found at $pyPath"
        } else {
            Write-Err "Python installed but not on PATH. Close this window, open a new PowerShell, and run this script again."
        }
    }
} else {
    $pyVer = python --version 2>&1
    Write-OK "$pyVer already installed"
}

# ── Node.js ────────────────────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Install-WingetApp 'OpenJS.NodeJS.LTS' 'Node.js LTS'
    Reload-Path
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        $nodePath = "$env:ProgramFiles\nodejs"
        if (Test-Path "$nodePath\node.exe") {
            $env:Path = "$nodePath;$env:Path"
            Write-OK "Node.js found at $nodePath"
        } else {
            Write-Err "Node.js installed but not on PATH. Close this window, open a new PowerShell, and run this script again."
        }
    }
} else {
    $nodeVer = node --version
    Write-OK "Node.js $nodeVer already installed"
}

# ── ffmpeg ─────────────────────────────────────────────────────────────────────
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    Install-WingetApp 'Gyan.FFmpeg' 'ffmpeg'
    Reload-Path
    if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
        Write-Warn "ffmpeg not yet on PATH. Audio extraction may not work until you restart your terminal."
    }
} else {
    Write-OK "ffmpeg already installed"
}

# ── Backend venv + pip install ─────────────────────────────────────────────────
Write-Step "Setting up Python backend..."
Push-Location "$Root\backend"

if (-not (Test-Path "venv")) {
    python -m venv venv
    if ($LASTEXITCODE -ne 0) { Write-Err "Failed to create Python virtual environment." }
}

& "venv\Scripts\activate.ps1"
pip install -r requirements.txt --quiet
if ($LASTEXITCODE -ne 0) { Write-Err "pip install failed. Check your internet connection." }
Write-OK "Backend dependencies installed"
deactivate
Pop-Location

# ── Frontend npm install ───────────────────────────────────────────────────────
Write-Step "Setting up frontend..."
Push-Location "$Root\frontend"
npm install --silent
if ($LASTEXITCODE -ne 0) { Write-Err "npm install failed. Check your internet connection." }
Write-OK "Frontend dependencies installed"
Pop-Location

# ── Create data dirs ───────────────────────────────────────────────────────────
New-Item -ItemType Directory -Force -Path "$Root\backend\downloads" | Out-Null
Write-OK "Directories ready"

# ── Launch backend ─────────────────────────────────────────────────────────────
Write-Step "Starting backend on http://localhost:8000 ..."
$backendCmd = "cd '$Root\backend'; .\venv\Scripts\activate.ps1; uvicorn main:app --reload --host 127.0.0.1 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

Start-Sleep -Seconds 3

# ── Launch frontend ────────────────────────────────────────────────────────────
Write-Step "Starting frontend on http://localhost:5173 ..."
$frontendCmd = "cd '$Root\frontend'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Start-Sleep -Seconds 4

# ── Open browser ───────────────────────────────────────────────────────────────
Write-Step "Opening browser..."
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "  =================================================" -ForegroundColor Green
Write-Host "    MediaSnap is running!"                            -ForegroundColor Green
Write-Host "  ================================================="  -ForegroundColor Green
Write-Host ""
Write-Host "    App:      http://localhost:5173" -ForegroundColor White
Write-Host "    API:      http://localhost:8000" -ForegroundColor White
Write-Host "    API docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "  Close the two PowerShell windows to stop MediaSnap." -ForegroundColor Gray
Write-Host ""
Read-Host "Press Enter to exit this launcher"
