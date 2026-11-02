// Pages are lists of segments laid left to right. Terrain and obstacles both come from
// the same list, so a generated page is solvable by construction (and the bot proves it).
export const SHEET_W = 0.72, SHEET_H = 0.46;
export const LEFT = -SHEET_W / 2, RIGHT = SHEET_W / 2, BOTTOM = -SHEET_H / 2;
export const GROUND = -0.1;

export type Seg =
  | { k: 'flat'; w: number }
  | { k: 'gap'; w: number; dy?: number }
  | { k: 'chasm'; w: number; pond?: boolean }
  | { k: 'wall'; w: number; h: number }
  | { k: 'rain'; w: number }
  | { k: 'crow'; w: number }
  | { k: 'gate'; w: number; by: 'rabbit' | 'crab' };

export type Block = { x0: number; x1: number; top: number };
export type Obstacle = { i: number; kind: 'gap' | 'chasm' | 'wall' | 'rain' | 'crow' | 'gate'; x0: number; x1: number; y0: number; y1: number; by?: 'rabbit' | 'crab'; pond?: boolean };
export type Page = { id: string; startX: number; exitX: number; exitY: number; blocks: Block[]; obstacles: Obstacle[]; startY: number };

export const buildPage = (id: string, segs: Seg[]): Page => {
  const total = segs.reduce((a, s) => a + s.w, 0);
  if (total > SHEET_W + 1e-6) throw new Error(`page ${id} is ${total} wide`);
  let x = LEFT, y = GROUND;
  const blocks: Block[] = [];
  const obstacles: Obstacle[] = [];
  const pad = (SHEET_W - total) / 2;
  segs.forEach((s, i) => {
    const x0 = x, x1 = i === segs.length - 1 ? RIGHT : x + s.w + (i === 0 ? pad * 2 : 0);
    if (s.k === 'gap' || s.k === 'chasm') {
      const y1 = y + (s.k === 'gap' ? s.dy ?? 0 : 0);
      obstacles.push({ i, kind: s.k, x0, x1, y0: y, y1, pond: s.k === 'chasm' && s.pond });
      y = y1;
    } else if (s.k === 'wall') {
      obstacles.push({ i, kind: 'wall', x0: x0 + 0.02, x1: x0 + 0.02, y0: y, y1: y + s.h });
      blocks.push({ x0, x1: x0 + 0.02, top: y });
      y += s.h;
      blocks.push({ x0: x0 + 0.02, x1, top: y });
    } else {
      if (s.k === 'rain') obstacles.push({ i, kind: 'rain', x0, x1, y0: y, y1: y });
      if (s.k === 'crow') obstacles.push({ i, kind: 'crow', x0: x0 + s.w * 0.6, x1: x0 + s.w * 0.6, y0: y, y1: y });
      if (s.k === 'gate') obstacles.push({ i, kind: 'gate', x0: x0 + s.w * 0.6, x1: x0 + s.w * 0.6, y0: y, y1: y, by: s.by });
      blocks.push({ x0, x1, top: y });
    }
    x = x1;
  });
  return { id, startX: LEFT + 0.08, startY: GROUND, exitX: RIGHT - 0.05, exitY: y, blocks, obstacles };
};

export const PAGES: Page[] = [
  buildPage('first-gap', [{ k: 'flat', w: 0.3 }, { k: 'gap', w: 0.12 }, { k: 'flat', w: 0.3 }]),
  buildPage('two-steps', [{ k: 'flat', w: 0.16 }, { k: 'gap', w: 0.1 }, { k: 'flat', w: 0.14 }, { k: 'gap', w: 0.12, dy: 0.025 }, { k: 'flat', w: 0.2 }]),
  buildPage('wall', [{ k: 'flat', w: 0.3 }, { k: 'wall', w: 0.42, h: 0.085 }]),
  buildPage('rain', [{ k: 'flat', w: 0.22 }, { k: 'rain', w: 0.3 }, { k: 'flat', w: 0.2 }]),
  buildPage('crow', [{ k: 'flat', w: 0.12 }, { k: 'crow', w: 0.26 }, { k: 'gap', w: 0.1 }, { k: 'flat', w: 0.24 }]),
  buildPage('chasm', [{ k: 'flat', w: 0.16 }, { k: 'chasm', w: 0.42 }, { k: 'flat', w: 0.14 }]),
  buildPage('thump', [{ k: 'flat', w: 0.1 }, { k: 'gate', w: 0.26, by: 'rabbit' }, { k: 'wall', w: 0.36, h: 0.05 }]),
  buildPage('pond', [{ k: 'flat', w: 0.14 }, { k: 'chasm', w: 0.3, pond: true }, { k: 'gate', w: 0.28, by: 'crab' }]),
];

// Park-Miller, so "today's page" is the same for everyone with the same date.
const rng = (seed: number) => () => (seed = (Math.abs(seed) * 16807 + 11) % 2147483647) / 2147483647;

export const dateSeed = (d: Date) => d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();

export const dailyPage = (seed: number): Page => {
  const r = rng(seed * 31 + 7);
  for (let i = 0; i < 5; i++) r();
  const pick = (a: number, b: number) => a + (b - a) * r();
  const menu: (() => Seg)[] = [
    () => ({ k: 'gap', w: pick(0.08, 0.13), dy: pick(-0.02, 0.025) }),
    () => ({ k: 'wall', w: 0.1, h: pick(0.04, 0.08) }),
    () => ({ k: 'rain', w: pick(0.14, 0.22) }),
    () => ({ k: 'crow', w: 0.14 }),
    () => ({ k: 'gate', w: 0.14, by: r() < 0.5 ? 'rabbit' : 'crab' }),
  ];
  const segs: Seg[] = [{ k: 'flat', w: 0.14 }];
  const used = new Set<number>();
  let width = 0.14;
  while (width < 0.5 && used.size < menu.length) {
    const m = Math.floor(r() * menu.length);
    if (used.has(m)) continue;
    used.add(m);
    const s = menu[m]();
    if (width + s.w + 0.16 > SHEET_W) break;
    segs.push(s, { k: 'flat', w: 0.08 });
    width += s.w + 0.08;
  }
  segs.push({ k: 'flat', w: Math.max(0.08, SHEET_W - width) });
  return buildPage(`day-${seed}`, segs);
};
