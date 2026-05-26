# MediaSnap Browser Extension — Installation

The extension sends the current tab's URL to your local MediaSnap app with one click.

## Chrome / Edge / Brave (Manifest V3)

1. Open your browser and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `browser-extension/` folder inside your MediaSnap directory
5. The ⬇ MediaSnap icon will appear in your toolbar

## Firefox

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `browser-extension/manifest.json`

> Firefox requires the extension to be reloaded each browser session unless it is signed.

## Usage

1. Navigate to any video page (YouTube, Twitter/X, Vimeo, TikTok, etc.)
2. Click the **⬇ MediaSnap** extension icon
3. Click **Send to MediaSnap** — MediaSnap opens with the URL pre-filled
4. Click **Download** — done!

## Configuration

By default the extension targets `http://localhost:5173` (the Vite dev server).

- For \*\*production\*\* (single-server mode), change the port to \*\*8000\*\* in the extension popup.
- The port setting is saved per-browser automatically.

## Updating

Reload the extension after any changes to files in `browser-extension/`:
1. Go to `chrome://extensions`
2. Click the \*\*↺refresh\*\* icon next to MediaSnap Downloader
