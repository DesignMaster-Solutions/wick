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
  let shownAt = -1;
  window.addEventListener('hf-seek', (e) => {
    const t = e.detail.time;
    e.detail.waitUntil(ready.then(async (f) => {
      const rt = document.querySelector('[data-webxr_runtime]');
      if (rt) rt.style.opacity = 0;
      if (t > shownAt) { f.clock.pumpTo(t); shownAt = t; view.drawImage(f.canvas, 0, 0, 1920, 1080); }
    }));
  });
</script>
</body></html>
