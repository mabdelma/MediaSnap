#!/usr/bin/env bash
set -e

# ── Initialise data directory ─────────────────────────────────────────────────
# When running under Docker the ./data volume is mounted at /app/data.
# We create sub-paths and seed JSON files so the app never starts cold.

DATA_DIR="${MEDIASNAP_DATA_DIR:-/app/data}"
mkdir -p "${DATA_DIR}/downloads"

# Seed settings.json with MediaSnap v2.0 defaults if the file is missing or empty
if [ ! -s "${DATA_DIR}/settings.json" ]; then
    cat > "${DATA_DIR}/settings.json" <<'EOF'
{
  "default_quality": "bestvideo+bestaudio/best",
  "default_audio_format": "mp3",
  "default_audio_quality": "0",
  "speed_limit": "",
  "notify_on_complete": false,
  "cookie_source": "",
  "cookie_file": ""
}
EOF
    echo "[entrypoint] Created default settings.json"
fi

# Seed history.json with an empty list if missing or empty
if [ ! -s "${DATA_DIR}/history.json" ]; then
    echo "[]" > "${DATA_DIR}/history.json"
    echo "[entrypoint] Created empty history.json"
fi

# Symlink data paths into the working directory so main.py can use relative paths
# (main.py looks for downloads/, settings.json, history.json next to itself)
ln -sfn "${DATA_DIR}/downloads"     /app/downloads
ln -sfn "${DATA_DIR}/settings.json" /app/settings.json
ln -sfn "${DATA_DIR}/history.json"  /app/history.json

echo "[entrypoint] Data directory ready at ${DATA_DIR}"
echo "[entrypoint] Starting MediaSnap backend..."

exec "$@"
