// Landing first; the 3D world loads only when there is a headset (or the emulator) to use it.
import { attract } from './attract.ts';

const params = new URLSearchParams(location.search);
const filmHost = (window as unknown as { __WICK_FILM?: boolean }).__WICK_FILM === true;
const emuDemo = filmHost ? 'film' : params.get('emu') ? params.get('demo') ?? 'tour' : null;
const $ = (id: string) => document.getElementById(id)!;

const boot = async () => {
  document.body.dataset.boot = 'starting';
  if (emuDemo) {
    document.body.classList.add('emu');
    const clock = filmHost ? (await import('./emu/film.ts')).installVirtualClock() : null;
    const { installEmu } = await import('./emu/driver.ts');
    const emu = installEmu(emuDemo, filmHost);
    const { startApp } = await import('./app.ts');
    const app = await startApp($('xr'), emu, params);
    app.world.launchXR();
    document.body.dataset.boot = 'emu';
    if (clock) {
      const wait = setInterval(() => {
        if (!app.world.session) return;
        clearInterval(wait);
        clock.start();
        (window as unknown as { __wickFilm: unknown }).__wickFilm = { clock, canvas: app.world.renderer.domElement };
      }, 30);
    }
    return;
  }
  attract($('attract') as HTMLCanvasElement);
  const enter = $('enter') as HTMLButtonElement;
  const xr = navigator.xr;
  const ok = xr && (await xr.isSessionSupported('immersive-ar').catch(() => false));
  if (!ok) {
    document.body.dataset.boot = 'no-xr';
    enter.textContent = 'Open this page in Quest Browser';
    enter.disabled = true;
    return;
  }
  enter.textContent = 'Loading…';
  enter.disabled = true;
  const { startApp } = await import('./app.ts');
  const app = await startApp($('xr'), null, params);
  enter.textContent = 'Light the candle';
  enter.disabled = false;
  document.body.dataset.boot = 'ready';
  enter.addEventListener('click', () => app.enter());
};

boot().catch((e) => {
  document.body.dataset.boot = 'error';
  document.body.dataset.error = String(e?.message ?? e).slice(0, 300);
  console.error(e);
});
