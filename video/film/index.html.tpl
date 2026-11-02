<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#000;width:1920px;height:1080px;overflow:hidden}
#view{position:absolute;inset:0;width:1920px;height:1080px}
#xr{position:absolute;inset:0;opacity:0}
</style></head><body>
<div id="root" data-composition-id="wick" data-start="0" data-duration="__DUR__" data-width="1920" data-height="1080">
  <div id="xr"></div>
  <canvas id="view" width="1920" height="1080"></canvas>
</div>
<script>window.__WICK_FILM = true;</script>
<script type="module" src="./game/__ENTRY__"></script>
<script>
  const view = document.getElementById('view').getContext('2d');
  const ready = new Promise((res) => { const i = setInterval(() => { if (window.__wickFilm) { clearInterval(i); res(window.__wickFilm); } }, 50); });
  // The host probes a few spread-out times first, and may reopen the page. The game only moves forward,
  // so it starts on the first frame-to-frame step; replaying from 0 is deterministic, so a reopen is safe.
  let armed = false, last = -1, shownAt = -1;
  window.addEventListener('hf-seek', (e) => {
    const t = e.detail.time;
    e.detail.waitUntil(ready.then(async (f) => {
      const rt = document.querySelector('[data-webxr_runtime]');
      if (rt) rt.style.opacity = 0;
      if (!armed) { if (t > last && t - last < 0.04) armed = true; last = t; if (!armed) return; }
      if (t > shownAt) { f.clock.pumpTo(t); shownAt = t; view.drawImage(f.canvas, 0, 0, 1920, 1080); }
    }));
  });
</script>
</body></html>
