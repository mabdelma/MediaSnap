#!/usr/bin/env bash
set -e

echo ""
echo "============================================"
echo "  MediaSnap - First-Time Setup (Linux/Mac)"
echo "============================================"
echo ""

# ── Check Python ───────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "[ERROR] python3 not found. Install Python 3.9+ and try again."
    exit 1
fi
echo "[OK] $(python3 --version)"

# ── Check Node.js ──────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
    echo "[ERROR] node not found. Install Node.js 18+ from https://nodejs.org"
    exit 1
fi
echo "[OK] Node $(node --version)"

# ── Check ffmpeg ───────────────────────────────────────────────────────────────
if ! command -v ffmpeg &>/dev/null; then
    echo ""
    echo "[WARN] ffmpeg not found. Required for merging video/audio and audio extraction."
    echo "  macOS:  brew install ffmpeg"
    echo "  Ubuntu: sudo apt install ffmpeg"
    echo "  Fedora: sudo dnf install ffmpeg"
    echo ""
else
    echo "[OK] ffmpeg found"
fi

# ── Backend ────────────────────────────────────────────────────────────────────
echo ""
echo "[1/3] Creating Python virtual environment..."
cd backend
python3 -m venv venv
source venv/bin/activate
echo "[2/3] Installing Python dependencies..."
pip install -r requirements.txt -q
deactivate
cd ..

# ── Frontend ───────────────────────────────────────────────────────────────────
echo "[3/3] Installing frontend dependencies..."
cd frontend
npm install --silent
cd ..

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "  To start: bash start.sh"
echo ""
