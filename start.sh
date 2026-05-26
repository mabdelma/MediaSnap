#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "======================================================"
echo "  MediaSnap  v2.0  - Starting (Linux/Mac)"
echo "======================================================"
echo ""

# ── Verify setup ──────────────────────────────────────────────────────────────
if [ ! -d "$SCRIPT_DIR/backend/venv" ]; then
    echo "[ERROR] Run setup.sh first."
    exit 1
fi
if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
    echo "[ERROR] Run setup.sh first."
    exit 1
fi

mkdir -p "$SCRIPT_DIR/backend/downloads"

# ── Start backend ─────────────────────────────────────────────────────────────
echo "Starting backend on http://localhost:8000 ..."
cd "$SCRIPT_DIR/backend"
source venv/bin/activate
uvicorn main:app --reload --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
deactivate

# ── Start frontend ────────────────────────────────────────────────────────────
echo "Starting frontend on http://localhost:5173 ..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

# ── Open browser ──────────────────────────────────────────────────────────────
sleep 3
if command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:5173 &>/dev/null &
elif command -v open &>/dev/null; then
    open http://localhost:5173 &>/dev/null &
fi

echo ""
echo "======================================================"
echo "  MediaSnap  v2.0  is running!"
echo "======================================================"
echo ""
echo "  App:       http://localhost:5173"
echo "  API:       http://localhost:8000"
echo "  API docs:  http://localhost:8000/docs"
echo ""
echo "  Features:"
echo "   - 1000+ platforms  (YouTube, Twitter/X, Vimeo, Twitch...)"
echo "   - 5 languages      (EN / AR / ES / FR / PT)"
echo "   - Dark + Light theme"
echo "   - Audio/Video quality selector"
echo "   - Scheduled downloads & desktop notifications"
echo "   - Speed limit control"
echo "   - Browser extension  ->  browser-extension/INSTALL.md"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo ""

# ── Wait and handle Ctrl+C ────────────────────────────────────────────────────
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
