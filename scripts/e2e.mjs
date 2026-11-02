// End-to-end: the deployed page, in a real headless browser, with the IWER emulator and synthetic hands
// going through XRFrame.getJointPose. State is read back from document.body.dataset.
// Run: node scripts/e2e.mjs [case] [--url base]
import { execFileSync } from 'node:child_process';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg('--url', 'https://designmaster-solutions.github.io/wick/');
const only = process.argv[2]?.startsWith('--') ? undefined : process.argv[2];

const CASES = [
  { name: 'dark: nothing happens before the pinch', q: 'demo=dark', wait: 7000, check: (d) => d.phase === 'dark' && d.lit === '0' && d.hands === '0' && d.x === '-0.280' },
  { name: 'dark: the page teaches the pinch with a ghost hand', q: 'demo=dark', wait: 12000, check: (d) => d.phase === 'dark' && d.ghost === '1' },
  { name: 'pinch lights it; with no hand he stops at the gap and looks at you', q: 'demo=waiting', wait: 16000, check: (d) => d.phase === 'play' && d.mode === 'wait' && d.why === 'gap' && d.lit === '0' && Number(d.x) < -0.05 },
  { name: 'after waiting, the page shows the hand that would help', q: 'demo=waiting', wait: 30000, check: (d) => d.mode === 'wait' && d.ghost === '1' },
  { name: 'first page: hand bridge, he crosses, page done in time', q: 'demo=first30', wait: 34000, check: (d) => Number(d.lit) >= 1 },
  { name: 'puppets via real WebXR joints all enter the album', q: 'demo=puppets', wait: 34000, check: (d) => ['dog', 'bird', 'rabbit', 'snail', 'crab', 'swan'].every((p) => d.album.split(',').includes(p)) },
  { name: 'tabs: poking toggles ink and opens the album', q: 'demo=tabs', wait: 16000, check: (d) => d.ink === 'true' && d.phase === 'album' },
  ...[1, 2, 3, 4, 5, 6, 7].map((p) => ({ name: `page ${p}: bot finishes it through the real input path`, q: `demo=tour&page=${p}&speed=3`, wait: 45000, check: (d) => Number(d.lit) >= 1 })),
];

const run = (c) => {
  const url = `${BASE}?emu=1&${c.q}&v=${Date.now()}`;
  const html = execFileSync('browse', ['cf', 'html', url, '--wait', String(c.wait)], { encoding: 'utf8', timeout: 170000, maxBuffer: 2e7 });
  const tag = html.match(/<body([^>]*)>/)?.[1] ?? '';
  const d = {};
  for (const m of tag.matchAll(/data-([a-z-]+)="([^"]*)"/g)) d[m[1].replace(/-([a-z])/g, (_, x) => x.toUpperCase())] = m[2];
  return d;
};

let bad = 0;
for (const c of CASES.filter((x) => !only || x.name.includes(only))) {
  let d = {};
  let ok = false;
  try { d = run(c); ok = !!c.check(d); } catch (e) { d = { error: String(e.message).slice(0, 200) }; }
  console.log(`${ok ? 'pass' : 'FAIL'}  ${c.name}\n      ${JSON.stringify({ boot: d.boot, phase: d.phase, page: d.page, mode: d.mode, why: d.why, x: d.x, t: d.t, hands: d.hands, awake: d.awake, album: d.album, lit: d.lit, ghost: d.ghost, ink: d.ink, fps: d.fps, clock: d.emuClock, err: d.error })}`);
  if (!ok) bad++;
}
console.log(bad ? `${bad} failed` : 'all passed');
process.exit(bad ? 1 : 0);
