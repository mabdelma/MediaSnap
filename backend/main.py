import asyncio
import json
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

import yt_dlp
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

DOWNLOADS_DIR = Path("downloads")
SETTINGS_FILE = Path("settings.json")
HISTORY_FILE  = Path("history.json")

DEFAULT_SETTINGS = {
    "default_quality":    "bestvideo+bestaudio/best",
    "default_audio_format": "mp3",
    "default_audio_quality": "0",
    "subtitle_lang":      "en",
    "max_concurrent":     2,
    "auto_cleanup_hours": 24,
    "default_subtitles":  False,
    "default_thumbnail":  False,
    "cookies_browser":    "",
    "cookies_file":       "",
    "speed_limit":        "",
    "notify_on_complete": False,
}

VIDEO_EXTS = {".mp4", ".mkv", ".webm", ".avi", ".mov", ".flv"}
AUDIO_EXTS = {".mp3", ".m4a", ".wav", ".ogg", ".flac", ".opus", ".aac"}

# ââ YouTube bot-detection bypass ââââââââââââââââââââââââââââââââââââââââââââââ
# Use the TV-embedded and web player clients; these do not require a signed-in
# session and are much less likely to be blocked on cloud/datacenter IPs.
_YT_BYPASS = {
    "extractor_args": {
        "youtube": {
            "player_client": ["android", "tv_embedded", "web"],
        }
    },
    "http_headers": {
        "User-Agent": (
            "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip"
        ),
        "Accept-Language": "en-US,en;q=0.9",
    },
}


@asynccontextmanager
async def lifespan(app):
    DOWNLOADS_DIR.mkdir(exist_ok=True)
    task = asyncio.create_task(_cleanup_loop())
    yield
    task.cancel()

app = FastAPI(title="MediaSnap API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

def load_settings():
    if SETTINGS_FILE.exists():
        try: return {**DEFAULT_SETTINGS, **json.loads(SETTINGS_FILE.read_text())}
        except: pass
    return DEFAULT_SETTINGS.copy()

def save_settings(s): SETTINGS_FILE.write_text(json.dumps(s, indent=2))

def load_history():
    if HISTORY_FILE.exists():
        try: return json.loads(HISTORY_FILE.read_text())
        except: pass
    return []

def save_history(h): HISTORY_FILE.write_text(json.dumps(h, indent=2))

def append_history(e):
    h = load_history(); h.insert(0, e); save_history(h[:500])

async def _cleanup_loop():
    while True:
        await asyncio.sleep(3600)
        hours = load_settings().get("auto_cleanup_hours", 24)
        if hours <= 0: continue
        cutoff = time.time() - hours * 3600
        for f in DOWNLOADS_DIR.iterdir():
            try:
                if f.is_file() and f.stat().st_mtime < cutoff: f.unlink(missing_ok=True)
            except: pass

class InfoRequest(BaseModel): url: str

class DownloadRequest(BaseModel):
    url: str; format_id: Optional[str] = None; audio_only: bool = False
    audio_format: Optional[str] = None; audio_quality: Optional[str] = None
    subtitles: bool = False; subtitle_lang: Optional[str] = "en"; thumbnail: bool = False
    title: Optional[str] = None; thumbnail_url: Optional[str] = None
    platform: Optional[str] = None; quality_label: Optional[str] = None

class SettingsIn(BaseModel):
    default_quality: Optional[str] = None; default_audio_format: Optional[str] = None
    default_audio_quality: Optional[str] = None; subtitle_lang: Optional[str] = None
    max_concurrent: Optional[int] = None; auto_cleanup_hours: Optional[int] = None
    default_subtitles: Optional[bool] = None; default_thumbnail: Optional[bool] = None
    cookies_browser: Optional[str] = None; cookies_file: Optional[str] = None
    speed_limit: Optional[str] = None; notify_on_complete: Optional[bool] = None


def validate_url(url): return url.lower().strip().startswith(("http://", "https://"))

def _parse_ratelimit(limit):
    if not limit: return None
    s = limit.strip().upper()
    try:
        if s.endswith('M'): return int(float(s[:-1]) * 1024 * 1024)
        if s.endswith('K'): return int(float(s[:-1]) * 1024)
        return int(s)
    except: return None

def _apply_cookies(opts, settings):
    b = (settings.get("cookies_browser") or "").strip()
    c = (settings.get("cookies_file") or "").strip()
    if b: opts["cookiesfrombrowser"] = (b,)
    elif c and Path(c).is_file(): opts["cookiefile"] = c
    return opts

def _base_opts(settings, extra=None):
    """Return yt-dlp opts with YouTube bypass + cookies merged."""
    opts = {
        "quiet": True,
        "no_warnings": True,
        **_YT_BYPASS,
    }
    if extra:
        opts.update(extra)
    return _apply_cookies(opts, settings)

def _find_output(job_id, audio_only):
    p = AUDIO_EXTS if audio_only else VIDEO_EXTS
    c = list(DOWNLOADS_DIR.glob(f"{job_id}.*"))
    for f in c:
        if f.suffix.lower() in p: return f
    m = [f for f in c if f.suffix.lower() in VIDEO_EXTS | AUDIO_EXTS]
    if m: return max(m, key=lambda f: f.stat().st_size)
    if c: return max(c, key=lambda f: f.stat().st_size)
    return None

def _build_formats(info):
    fmts = []; seen = set()
    for f in info.get("formats", []):
        h = f.get("height"); v = f.get("vcodec", "none")
        if v != "none" and h:
            l = f"{h}p"
            if l not in seen:
                seen.add(l)
                fmts.append({
                    "format_id": f.get("format_id"), "label": l,
                    "ext": f.get("ext", ""), "type": "video", "height": h,
                    "filesize": f.get("filesize") or f.get("filesize_approx"),
                })
    fmts.sort(key=lambda x: (x.get("height") or 0), reverse=True)
    fmts.insert(0, {"format_id": "bestvideo+bestaudio/best", "label": "Best Quality",
                    "ext": "mp4", "type": "video", "height": None, "filesize": None})
    return fmts


@app.get("/health")
def health(): return {"status": "ok", "version": "2.0"}

@app.get("/api/settings")
def get_settings(): return load_settings()

@app.put("/api/settings")
def put_settings(body: SettingsIn):
    s = load_settings()
    s.update({k: v for k, v in body.model_dump().items() if v is not None})
    save_settings(s); return s

@app.post("/api/info")
def get_info(body: InfoRequest):
    if not validate_url(body.url): raise HTTPException(400, detail="Invalid URL")
    opts = _base_opts(load_settings(), {"skip_download": True})
    try:
        with yt_dlp.YoutubeDL(opts) as y:
            info = y.extract_info(body.url, download=False)
    except Exception as e:
        raise HTTPException(422, detail=str(e))
    if not info: raise HTTPException(422, detail="Could not fetch video info")
    return {
        "title":        info.get("title", "Unknown"),
        "thumbnail":    info.get("thumbnail"),
        "duration":     info.get("duration"),
        "uploader":     info.get("uploader"),
        "platform":     info.get("extractor_key", "").lower(),
        "formats":      _build_formats(info),
        "subtitles":    list(info.get("subtitles", {}).keys()),
        "auto_captions": list(info.get("automatic_captions", {}).keys()),
    }

@app.post("/api/playlist-info")
def get_playlist_info(body: InfoRequest):
    if not validate_url(body.url): raise HTTPException(400, detail="Invalid URL")
    opts = _base_opts(load_settings(), {"skip_download": True, "extract_flat": True})
    try:
        with yt_dlp.YoutubeDL(opts) as y:
            info = y.extract_info(body.url, download=False)
    except Exception as e:
        raise HTTPException(422, detail=str(e))
    if not info: raise HTTPException(422, detail="Could not fetch playlist info")
    entries = info.get("entries", [])
    return {
        "title": info.get("title", "Playlist"),
        "count": len(entries),
        "entries": [
            {
                "id": e.get("id"), "title": e.get("title", f"Video {i+1}"),
                "url": e.get("url") or e.get("webpage_url"),
                "duration": e.get("duration"), "thumbnail": e.get("thumbnail"),
            }
            for i, e in enumerate(entries)
        ],
    }

@app.post("/api/download")
async def download(body: DownloadRequest):
    if not validate_url(body.url): raise HTTPException(400, detail="Invalid URL")
    settings = load_settings(); job_id = str(uuid.uuid4())
    out_tmpl = str(DOWNLOADS_DIR / f"{job_id}.%(ext)s")

    if body.audio_only:
        fmt = "bestaudio/best"
        pp = [{"key": "FFmpegExtractAudio",
               "preferredcodec":    body.audio_format  or settings.get("default_audio_format", "mp3"),
               "preferredquality":  body.audio_quality or settings.get("default_audio_quality", "0")}]
    else:
        fmt = body.format_id or settings.get("default_quality", "bestvideo+bestaudio/best")
        pp = [{"key": "FFmpegVideoConvertor", "preferedformat": "mp4"}]
        if body.subtitles:
            pp.append({"key": "FFmpegSubtitlesConvertor", "format": "srt"})

    extra = {
        "format":          fmt,
        "outtmpl":         out_tmpl,
        "postprocessors":  pp,
        "writethumbnail":  body.thumbnail,
    }
    if body.subtitles:
        lang = body.subtitle_lang or settings.get("subtitle_lang", "en")
        extra.update({"writesubtitles": True, "writeautomaticsub": True, "subtitleslangs": [lang]})
    rate = _parse_ratelimit(settings.get("speed_limit", ""))
    if rate: extra["ratelimit"] = rate

    opts = _base_opts(settings, extra)

    async def stream():
        loop = asyncio.get_event_loop(); q = asyncio.Queue(); errs = []

        class PH:
            def __call__(s, d):
                st = d.get("status")
                if st == "downloading":
                    t  = d.get("total_bytes") or d.get("total_bytes_estimate", 0)
                    dl = d.get("downloaded_bytes", 0)
                    loop.call_soon_threadsafe(q.put_nowait, json.dumps({
                        "type": "progress",
                        "percent": round(dl / t * 100 if t else 0, 1),
                        "speed": int(d.get("speed") or 0),
                        "eta": int(d.get("eta") or 0),
                        "downloaded": dl, "total": t,
                    }))
                elif st == "finished":
                    loop.call_soon_threadsafe(q.put_nowait, json.dumps({"type": "finished"}))

        opts["progress_hooks"] = [PH()]

        def run():
            try:
                with yt_dlp.YoutubeDL(opts) as y: y.download([body.url])
            except Exception as e:
                errs.append(str(e))
                loop.call_soon_threadsafe(q.put_nowait, json.dumps({"type": "error", "message": str(e)}))
            finally:
                loop.call_soon_threadsafe(q.put_nowait, "__done__")

        asyncio.create_task(loop.run_in_executor(None, run))
        while True:
            m = await q.get()
            if m == "__done__": break
            yield f"data: {m}\n\n"

        if not errs:
            f = _find_output(job_id, body.audio_only)
            if f:
                st = f.stat()
                append_history({
                    "id": job_id, "url": body.url,
                    "title": body.title or f.stem,
                    "thumbnail_url": body.thumbnail_url,
                    "platform": body.platform or "unknown",
                    "quality_label": body.quality_label or ("audio" if body.audio_only else "video"),
                    "filename": f.name, "filesize": st.st_size,
                    "downloaded_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "audio_only": body.audio_only,
                })
                yield f"data: {json.dumps({'type':'complete','id':job_id,'filename':f.name,'filesize':st.st_size})}\n\n"
            else:
                yield f"data: {json.dumps({'type':'error','message':'Output file not found'})}\n\n"

    return StreamingResponse(
        stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Access-Control-Allow-Origin": "*"},
    )

@app.get("/api/file/{file_id}")
def serve_file(file_id: str):
    c = list(DOWNLOADS_DIR.glob(f"{file_id}.*"))
    m = [f for f in c if f.suffix.lower() in VIDEO_EXTS | AUDIO_EXTS]
    if m: t = max(m, key=lambda f: f.stat().st_size)
    elif c: t = max(c, key=lambda f: f.stat().st_size)
    else: raise HTTPException(404, detail="File not found")
    return FileResponse(path=str(t), filename=t.name)

@app.delete("/api/file/{file_id}")
def delete_file(file_id: str):
    d = []
    for f in DOWNLOADS_DIR.glob(f"{file_id}.*"):
        try: f.unlink(); d.append(f.name)
        except: pass
    if not d: raise HTTPException(404, detail="File not found")
    return {"deleted": d}

@app.get("/api/history")
def get_history(): return load_history()

@app.delete("/api/history")
def clear_history(): save_history([]); return {"status": "cleared"}

@app.delete("/api/history/{entry_id}")
def delete_history_entry(entry_id: str):
    h = load_history(); nh = [e for e in h if e.get("id") != entry_id]
    if len(nh) == len(h): raise HTTPException(404, detail="Entry not found")
    save_history(nh); return {"status": "deleted"}


_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if _DIST.is_dir():
    from fastapi.responses import HTMLResponse
    app.mount("/assets", StaticFiles(directory=str(_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path == "health": raise HTTPException(404)
        i = _DIST / "index.html"
        if not i.exists(): raise HTTPException(404)
        return HTMLResponse(i.read_text())
