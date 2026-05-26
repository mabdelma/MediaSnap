const VIDEO_DOMAINS = ['youtube.com','youtu.be','twitter.com','x.com','facebook.com','instagram.com','tiktok.com','vimeo.com','twitch.tv','reddit.com','soundcloud.com','dailymotion.com','rumble.com'];
const DEFAULT_PORT = 5173;
let currentUrl = '', port = DEFAULT_PORT;
const urlEl = document.getElementById('currentUrl');
const sendBtn = document.getElementById('sendBtn');
const openAppBtn = document.getElementById('openAppBtn');
const statusEl = document.getElementById('status');
const portInput = document.getElementById('portInput');
chrome.storage.local.get(['mediasnap_port'], r => { port = r.mediasnap_port||DEFAULT_PORT; portInput.value=port; });
portInput.addEventListener('change',()=>{ port=parseInt(portInput.value)||DEFAULT_PORT; chrome.storage.local.set({mediasnap_port:port}); });
chrome.tabs.query({active:true,currentWindow:true}, tabs => {
  const tab = tabs[0];
  if(!tab||!tab.url){ urlEl.textContent='No URL'; return; }
  currentUrl = tab.url;
  urlEl.textContent = currentUrl.length>60 ? currentUrl.slice(0,57)+'…' : currentUrl;
  sendBtn.disabled = false;
});
sendBtn.addEventListener('click', () => {
  if(!currentUrl) return;
  chrome.tabs.create({url:`http://localhost:${port}/?url=${encodeURIComponent(currentUrl)}`});
  statusEl.textContent='✅ Opened!'; statusEl.style.display='block'; statusEl.className='status status-success';
  setTimeout(()=>window.close(),800);
});
openAppBtn.addEventListener('click',()=>{ chrome.tabs.create({url:`http://localhost:${port}/`}); });
