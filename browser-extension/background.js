// MediaSnap Extension v2.0 — background service worker

const DEFAULT_PORT = 5173

// ── Create context menus on install / update ───────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  // Remove any stale items first (safe to call even if nothing exists)
  chrome.contextMenus.removeAll(() => {

    // 1. Right-click on a LINK → send that link's href to MediaSnap
    chrome.contextMenus.create({
      id:       'send-link',
      title:    '⬇ Send link to MediaSnap',
      contexts: ['link'],
    })

    // 2. Right-click on a VIDEO element → send the page URL (or video src)
    chrome.contextMenus.create({
      id:       'send-video',
      title:    '⬇ Send video to MediaSnap',
      contexts: ['video'],
    })

    // 3. Right-click anywhere on a page → send the page URL
    chrome.contextMenus.create({
      id:       'send-page',
      title:    '⬇ Send page to MediaSnap',
      contexts: ['page', 'frame'],
    })
  })
})

// ── Handle context menu clicks ─────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener((info, tab) => {
  chrome.storage.local.get(['mediasnap_port'], (result) => {
    const port = result.mediasnap_port || DEFAULT_PORT

    let targetUrl = ''

    if (info.menuItemId === 'send-link' && info.linkUrl) {
      targetUrl = info.linkUrl
    } else if (info.menuItemId === 'send-video') {
      // Prefer the src attribute of the <video> element; fall back to page URL
      targetUrl = info.srcUrl || info.pageUrl || tab.url
    } else {
      // send-page / send-frame
      targetUrl = info.frameUrl || info.pageUrl || tab.url
    }

    if (!targetUrl) return

    const mediaSnapUrl = `http://localhost:${port}/?url=${encodeURIComponent(targetUrl)}`
    chrome.tabs.create({ url: mediaSnapUrl })
  })
})
