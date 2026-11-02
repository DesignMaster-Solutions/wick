// The landing page plays the real game logic in 2D with the real solver: no WebGL, no download.
import { Bot } from './sim/bot.ts';
import { LIGHT } from './sim/game.ts';
import { BOTTOM, LEFT, PAGES, RIGHT, SHEET_H, SHEET_W } from './sim/pages.ts';
import { STRIDE } from './sim/shadow.ts';
import { newWorld, stepWorld, WICK_H } from './sim/world.ts';
import type { Hand } from './sim/hand.ts';

export const attract = (canvas: HTMLCanvasElement) => {
  const g = canvas.getContext('2d')!;
  let i = 0;
  let w = newWorld(PAGES[0], LIGHT);
  let bot = new Bot({ speed: 0.28 });
  let h: Hand | null = null;
  let hold = 0;
  let last = performance.now();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw = () => {
    const W = canvas.width = canvas.clientWidth * Math.min(devicePixelRatio, 2);
    const H = canvas.height = Math.round((W * SHEET_H) / SHEET_W);
    const X = (x: number) => ((x - LEFT) / SHEET_W) * W, Y = (y: number) => H - ((y - BOTTOM) / SHEET_H) * H, S = W / SHEET_W;
    const glow = g.createRadialGradient(X(0), Y(-0.02), 0, X(0), Y(-0.02), W * 0.62);
    glow.addColorStop(0, '#f6e6c6'); glow.addColorStop(1, '#a9845a');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    g.fillStyle = '#8d7d78';
    g.beginPath(); g.moveTo(0, H);
    for (let k = 0; k <= 30; k++) g.lineTo((k / 30) * W, Y(-0.05 + Math.sin(k * 0.55 + i * 2) * 0.02));
    g.lineTo(W, H); g.fill();
    for (const b of w.page.blocks) {
      g.fillStyle = '#d59552'; g.fillRect(X(b.x0), Y(b.top), (b.x1 - b.x0) * S, H);
      g.fillStyle = '#7d4530'; g.fillRect(X(b.x0), Y(b.top - 0.01), (b.x1 - b.x0) * S, H);
    }
    g.lineCap = 'round';
    g.strokeStyle = '#180e0a';
    for (let c = 0; c < w.shadow.n; c++) {
      const o = c * STRIDE, d = w.shadow.d;
      g.filter = `blur(${(d[o + 5] * S * 0.55).toFixed(1)}px)`;
      g.lineWidth = d[o + 4] * 2 * S;
      g.globalAlpha = Math.max(0.5, 1 - (d[o + 6] - 1) * 0.16);
      g.beginPath(); g.moveTo(X(d[o]), Y(d[o + 1])); g.lineTo(X(d[o + 2]), Y(d[o + 3])); g.stroke();
    }
    g.filter = 'none'; g.globalAlpha = 1;
    const fx = X(w.x), fy = Y(w.y), s = WICK_H * S;
    const swing = w.mode === 'walk' ? Math.sin(w.time * 11) * s * 0.14 : 0;
    g.strokeStyle = '#8e2413'; g.lineWidth = s * 0.13;
    g.beginPath(); g.moveTo(fx, fy - s * 0.36); g.lineTo(fx - s * 0.08 + swing, fy); g.moveTo(fx, fy - s * 0.36); g.lineTo(fx + s * 0.08 - swing, fy); g.stroke();
    g.fillStyle = '#c8391f'; g.fillRect(fx - s * 0.13, fy - s * 0.66, s * 0.26, s * 0.34);
    g.fillStyle = '#f6e6c8'; g.beginPath(); g.arc(fx, fy - s * 0.8, s * 0.17, 0, 7); g.fill();
    g.fillStyle = '#ffb347'; g.beginPath(); g.ellipse(fx + s * 0.3, fy - s * 0.82, s * 0.07, s * 0.14, 0, 0, 7); g.fill();
  };
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!document.hidden && canvas.getBoundingClientRect().bottom > 0) {
      stepWorld(w, [null, h], dt);
      h = bot.update(w, dt);
      w.events.length = 0;
      if (w.done && (hold += dt) > 1.4) {
        i = (i + 1) % PAGES.length;
        w = newWorld(PAGES[i], LIGHT);
        bot = new Bot({ speed: 0.28 });
        h = null; hold = 0;
      }
      draw();
    }
    if (!reduce) requestAnimationFrame(frame);
  };
  if (reduce) { for (let k = 0; k < 420; k++) { stepWorld(w, [null, h], 1 / 30); h = bot.update(w, 1 / 30); } draw(); }
  else requestAnimationFrame(frame);
  void RIGHT;
};
