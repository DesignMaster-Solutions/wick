// One page of the paper world: Wick, hazards and awake puppets. Pure and deterministic.
import { classify, isButterfly, type PoseLabel, type Puppet } from './classify.ts';
import { J, type Hand, type Vec3 } from './hand.ts';
import { BOTTOM, SHEET_H, type Obstacle, type Page } from './pages.ts';
import { addHandShadow, addRawCapsule, newShadowSet, projectPoint, shadowAbove, shadowGround, shadowOverlaps, type ShadowSet } from './shadow.ts';

export const WICK_H = 0.055, WICK_HALF = 0.011, WALK = 0.052;
export const STEP_UP = 0.03, STEP_DOWN = 0.075;
export const AWAKE_AFTER = 0.3, ASLEEP_AFTER = 0.25;
const CARRY_REACH = 0.075, BARK_REACH = 0.3, THUMP_REACH = 0.24, SNIP_REACH = 0.16, TRAIL_LIFE = 14;

export type WickMode = 'walk' | 'wait' | 'fall' | 'drift' | 'carried' | 'home';
export type Why = 'gap' | 'chasm' | 'wall' | 'rain' | 'crow' | 'gate' | null;
export type GameEvent = { t: string; x: number; y: number; who?: string };
export type HandState = { label: PoseLabel; candidate: PoseLabel; held: number; lost: number; awake: Puppet | null; ax: number; ay: number };
type TrailBit = { ax: number; ay: number; bx: number; by: number; age: number };

export type World = {
  page: Page; light: Vec3; time: number;
  x: number; y: number; vy: number; dir: 1 | -1; mode: WickMode; why: Why; waited: number; flame: number;
  checkX: number; checkY: number; driftT: number; regrab: number;
  cleared: Set<number>; hands: [HandState, HandState]; butterfly: number; shadow: ShadowSet; trail: TrailBit[];
  carrierHand: number; thump: number; events: GameEvent[]; done: boolean; paused: boolean;
};

const newHandState = (): HandState => ({ label: null, candidate: null, held: 0, lost: 0, awake: null, ax: 0, ay: 0 });

export const newWorld = (page: Page, light: Vec3): World => ({
  page, light, time: 0,
  x: page.startX, y: page.startY, vy: 0, dir: 1, mode: 'walk', why: null, waited: 0, flame: 1,
  checkX: page.startX, checkY: page.startY, driftT: 0, regrab: 0,
  cleared: new Set(), hands: [newHandState(), newHandState()], butterfly: 0, shadow: newShadowSet(), trail: [],
  carrierHand: -1, thump: 0, events: [], done: false, paused: false,
});

const terrainGround = (w: World, x: number, y: number): number | null => {
  let best: number | null = null;
  for (const b of w.page.blocks) if (x >= b.x0 && x <= b.x1 && b.top <= y + STEP_UP && (best === null || b.top > best)) best = b.top;
  return best;
};
const terrainWall = (w: World, x: number, y: number) => w.page.blocks.some((b) => x >= b.x0 && x <= b.x1 && b.top > y + STEP_UP);

export const groundAt = (w: World, x: number, y: number): number | null => {
  const a = terrainGround(w, x, y), b = shadowGround(w.shadow, x, y, STEP_UP);
  return a === null ? b : b === null ? a : Math.max(a, b);
};

const nextObstacle = (w: World): Obstacle | undefined => w.page.obstacles.find((o) => !w.cleared.has(o.i) && o.x1 + WICK_HALF >= w.x);

/** Where a puppet "lives" on the paper: the mouth, beak or claw of its shadow. */
const ANCHORS: Record<string, number> = { dog: J.indexTip, bird: J.thumbTip, rabbit: J.middleTip, snail: J.indexTip, crab: J.indexTip, swan: J.thumbTip };

const updatePuppet = (w: World, s: HandState, h: Hand | null, dt: number) => {
  const label = h ? classify(h) : null;
  if (h && s.awake && s.awake !== 'butterfly') {
    const j = ANCHORS[s.awake];
    const p = projectPoint(w.light, h.p[j * 3], h.p[j * 3 + 1], h.p[j * 3 + 2]);
    if (p) { s.ax = p[0]; s.ay = p[1]; }
  }
  if (label !== s.candidate) { s.candidate = label; s.held = 0; }
  s.held += dt;
  s.label = label;
  if (label && s.held >= AWAKE_AFTER && s.awake !== label) {
    s.awake = label;
    s.lost = 0;
    const j = ANCHORS[label];
    const p = h && projectPoint(w.light, h.p[j * 3], h.p[j * 3 + 1], h.p[j * 3 + 2]);
    if (p) { s.ax = p[0]; s.ay = p[1]; }
    w.events.push({ t: 'awake', x: s.ax, y: s.ay, who: label });
  }
  if (s.awake && label !== s.awake) {
    s.lost += dt;
    if (s.lost >= ASLEEP_AFTER) { s.awake = null; s.lost = 0; }
  } else s.lost = 0;
};

const clear = (w: World, o: Obstacle, t: string) => {
  w.cleared.add(o.i);
  w.events.push({ t, x: o.x0, y: o.y0 });
};

const puppetActs = (w: World, dt: number) => {
  w.thump = Math.max(0, w.thump - dt);
  w.regrab = Math.max(0, w.regrab - dt);
  w.trail = w.trail.filter((b) => (b.age += dt) < TRAIL_LIFE);
  w.hands.forEach((s, i) => {
    if (!s.awake) return;
    for (const o of w.page.obstacles) {
      if (w.cleared.has(o.i)) continue;
      const near = Math.hypot(s.ax - o.x0, s.ay - (o.y0 + 0.04));
      if (s.awake === 'dog' && o.kind === 'crow' && near < BARK_REACH) { w.events.push({ t: 'bark', x: s.ax, y: s.ay }); clear(w, o, 'crow-flees'); }
      if (s.awake === 'rabbit' && o.kind === 'gate' && o.by === 'rabbit' && near < THUMP_REACH && s.held > 0.8 && w.thump === 0) { w.thump = 1; w.events.push({ t: 'thump', x: s.ax, y: s.ay }); clear(w, o, 'gate-opens'); }
      if (s.awake === 'crab' && o.kind === 'gate' && o.by === 'crab' && near < SNIP_REACH) { w.events.push({ t: 'snip', x: s.ax, y: s.ay }); clear(w, o, 'gate-opens'); }
    }
    if (s.awake === 'snail') {
      const last = w.trail[w.trail.length - 1];
      if (!last || last.age > 1 || Math.hypot(s.ax - last.bx, s.ay - last.by) > 0.012)
        w.trail.push({ ax: last && last.age < 1 ? last.bx : s.ax, ay: last && last.age < 1 ? last.by : s.ay, bx: s.ax, by: s.ay, age: 0 });
      if (w.trail.length > 36) w.trail.shift();
    }
    const carries = s.awake === 'bird' || s.awake === 'swan';
    // Only chasms: a bird that flew him past everything would make the other puppets pointless.
    if (carries && w.why === 'chasm' && w.mode !== 'carried' && w.mode !== 'drift' && w.regrab === 0 && Math.hypot(s.ax - w.x, s.ay - (w.y + WICK_H)) < CARRY_REACH) {
      w.mode = 'carried';
      w.carrierHand = i;
      w.events.push({ t: 'grab', x: w.x, y: w.y, who: s.awake });
    }
  });
};

const canStandAhead = (w: World, front: number): Why => {
  if (terrainWall(w, front, w.y) || shadowOverlaps(w.shadow, front, w.y + STEP_UP, w.y + WICK_H)) return 'wall';
  const g = groundAt(w, front, w.y);
  return g === null || g < w.y - STEP_DOWN ? 'gap' : null;
};

const moveWick = (w: World, dt: number) => {
  if (w.mode === 'carried') {
    const s = w.hands[w.carrierHand];
    w.x = s.ax;
    w.y = s.ay - WICK_H - 0.012;
    const ob = w.page.obstacles.find((o) => o.kind === 'chasm' && !w.cleared.has(o.i));
    if (ob && w.x > ob.x1 + 0.025) clear(w, ob, 'chasm-crossed');
    const g = groundAt(w, w.x, w.y);
    if (!s.awake || (w.x > w.checkX + 0.05 && g !== null && w.y - g < 0.05 && !w.page.obstacles.some((o) => o.kind === 'chasm' && o.x0 < w.x && w.x < o.x1))) {
      w.mode = 'fall'; w.vy = 0; w.carrierHand = -1; w.regrab = 2.5;
      w.events.push({ t: 'drop', x: w.x, y: w.y });
    }
    return;
  }
  if (w.mode === 'drift') {
    w.driftT += dt / 1.6;
    const k = Math.min(w.driftT, 1);
    w.x += (w.checkX - w.x) * k * 0.2;
    w.y += (w.checkY - w.y) * k * 0.2;
    if (k >= 1) { w.x = w.checkX; w.y = w.checkY; w.vy = 0; w.mode = 'walk'; w.waited = 0; w.events.push({ t: 'back', x: w.x, y: w.y }); }
    return;
  }
  if (w.mode === 'fall') {
    w.vy = Math.max(w.vy - 0.32 * dt, -0.2); // falling is gentle: he floats, he never dies
    const ny = w.y + w.vy * dt;
    const g = groundAt(w, w.x, w.y);
    if (g !== null && g >= ny) {
      w.y = g; w.vy = 0; w.mode = 'walk';
      w.events.push({ t: 'land', x: w.x, y: w.y });
    } else w.y = ny;
    if (w.y < BOTTOM - 0.05) { w.mode = 'drift'; w.driftT = 0; w.events.push({ t: 'fell', x: w.x, y: w.y }); }
    return;
  }
  // On foot: follow the ground, which may be a moving hand.
  const under = groundAt(w, w.x, w.y);
  if (under === null || under < w.y - 0.012) { w.mode = 'fall'; w.vy = 0; return; }
  w.y = Math.min(under, SHEET_H / 2 - WICK_H); // a hand can lift him, but not off the page
  if (terrainGround(w, w.x, w.y) === w.y && !nextGapAt(w)) { w.checkX = w.x; w.checkY = w.y; }
  if (w.x >= w.page.exitX) {
    w.mode = 'home';
    if (!w.done) { w.done = true; w.events.push({ t: 'page-done', x: w.x, y: w.y }); }
    return;
  }
  const nx = w.x + w.dir * WALK * dt;
  const front = nx + w.dir * WICK_HALF;
  let why: Why = canStandAhead(w, front);
  if (why === 'gap' && w.page.obstacles.some((o) => o.kind === 'chasm' && !w.cleared.has(o.i) && o.x0 < front + 0.02 && front < o.x1)) why = 'chasm';
  const ob = nextObstacle(w);
  if (ob) {
    if (ob.kind === 'crow' && front > ob.x0 - 0.05) why = 'crow';
    if (ob.kind === 'gate' && front > ob.x0 - 0.02) why = 'gate';
    if (ob.kind === 'rain' && front > ob.x0 && front < ob.x1 && !shadowAbove(w.shadow, w.x, w.y + WICK_H * 1.1)) why = 'rain';
    if (ob.kind === 'rain' && w.x > ob.x1 - WICK_HALF) clear(w, ob, 'rain-passed');
    if ((ob.kind === 'gap' || ob.kind === 'wall') && w.x > ob.x1 + WICK_HALF) clear(w, ob, 'crossed');
  }
  if (why) {
    if (w.why !== why) { w.waited = 0; w.events.push({ t: 'wait', x: w.x, y: w.y, who: why }); }
    w.mode = 'wait'; w.why = why; w.waited += dt;
    return;
  }
  if (w.mode === 'wait') w.events.push({ t: 'go', x: w.x, y: w.y });
  w.mode = 'walk'; w.why = null; w.x = nx;
};

const nextGapAt = (w: World) => w.page.obstacles.some((o) => (o.kind === 'gap' || o.kind === 'chasm') && w.x > o.x0 && w.x < o.x1);

const FLAME_DIM = 0.35;

/** Advances the page by dt. hands = [left, right], null when not tracked. */
export const stepWorld = (w: World, hands: [Hand | null, Hand | null], dt: number) => {
  w.shadow.n = 0;
  for (const h of hands) if (h) addHandShadow(w.shadow, h, w.light);
  if (w.paused) return;
  w.time += dt;
  for (const t of w.trail) addRawCapsule(w.shadow, t.ax, t.ay, t.bx, t.by, 0.007);
  updatePuppet(w, w.hands[0], hands[0], dt);
  updatePuppet(w, w.hands[1], hands[1], dt);
  w.butterfly = hands[0] && hands[1] && isButterfly(hands[0], hands[1]) ? w.butterfly + dt : 0;
  if (w.butterfly > AWAKE_AFTER && w.butterfly - dt <= AWAKE_AFTER) w.events.push({ t: 'awake', x: 0, y: SHEET_H / 4, who: 'butterfly' });
  puppetActs(w, dt);
  moveWick(w, dt);
  const inRain = w.page.obstacles.some((o) => o.kind === 'rain' && !w.cleared.has(o.i) && w.x > o.x0 - 0.03 && w.x < o.x1) && !shadowAbove(w.shadow, w.x, w.y + WICK_H);
  w.flame += ((inRain ? FLAME_DIM : 1) - w.flame) * Math.min(dt * 3, 1);
};
