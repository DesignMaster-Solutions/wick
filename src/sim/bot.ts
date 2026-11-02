// A patient one-handed player. It proves every page solvable, plays the ?emu=1 demos,
// and its intended hand is what the ghost hint draws: tests, video and hints share one solution.
import { J, newHand, poseHand, quatFromBasis, rotate, type Hand, type Quat, type Vec3 } from './hand.ts';
import type { Obstacle } from './pages.ts';
import { addHandShadow, magnification, newShadowSet, STRIDE } from './shadow.ts';
import { canStandAhead, groundAt, STEP_UP, WICK_H, WICK_HALF, type World } from './world.ts';

export type HandTarget = { pose: string; wrist: Vec3; q: Quat };

/** Fingers along angle a in the paper plane, back of the hand toward the viewer (s=1) or the paper (s=-1). */
export const handQuat = (a: number, s: 1 | -1 = 1): Quat => {
  const c = Math.cos(a), n = Math.sin(a);
  return quatFromBasis([s * n, -s * c, 0], [0, 0, s], [-c, -n, 0]);
};

const hand = newHand();
const tmpShadow = newShadowSet();

const shadowOf = (w: World, t: HandTarget, handed: 1 | -1) => {
  poseHand(t.pose, t.wrist, t.q, handed, hand);
  tmpShadow.n = 0;
  addHandShadow(tmpShadow, hand, w.light);
  return tmpShadow;
};

const bounds = (s: typeof tmpShadow) => {
  let minX = 9, maxX = -9, maxY = -9, minY = 9;
  for (let i = 0; i < s.n; i++) {
    const o = i * STRIDE, r = s.d[o + 4];
    minX = Math.min(minX, s.d[o] - r, s.d[o + 2] - r);
    maxX = Math.max(maxX, s.d[o] + r, s.d[o + 2] + r);
    maxY = Math.max(maxY, s.d[o + 1] + r, s.d[o + 3] + r);
    minY = Math.min(minY, s.d[o + 1] - r, s.d[o + 3] - r);
  }
  return { minX, maxX, maxY, minY };
};

/** Would Wick, walking from xa to xb at height y0, stay on his feet with this shadow? */
const walkable = (w: World, s: typeof tmpShadow, xa: number, xb: number, y0: number, y1: number): boolean => {
  const probe = { ...w, shadow: s } as World;
  let y = y0;
  for (let x = xa; x < xb; x += 0.004) {
    probe.y = y - 0.007; // margin: a real hand is never exactly where the plan says
    if (canStandAhead(probe, x + WICK_HALF)) return false;
    y = groundAt(probe, x + WICK_HALF, y) ?? y;
  }
  return Math.abs(y - y1) < STEP_UP;
};

/** Grid search for a hand whose shadow is a walkable road over this obstacle. */
const planRoad = (w: World, o: Obstacle, handed: 1 | -1): HandTarget | null => {
  const span = o.x1 - o.x0;
  const midX = (o.x0 + o.x1) / 2;
  for (const z of [0.16, 0.12, 0.2, 0.24, 0.28]) {
    const t = magnification(w.light[2], z);
    const rise = o.y1 - o.y0;
    for (const lean of [0, 0.05, -0.05, 0.1, -0.1, 0.16, -0.16, 0.24, 0.32, 0.42, 0.55, 0.7]) {
      for (const s of [1, -1] as const) {
        for (const fit of [0, 0.02, -0.02, 0.04, 0.06, -0.04]) {
          const q = handQuat(lean, s);
          const c: HandTarget = { pose: 'flat', wrist: [w.light[0], w.light[1], z], q };
          const b0 = bounds(shadowOf(w, c, handed));
          // A bridge centres over the gap; a ramp ends with its fingertips against the wall.
          const dx = (span > 0 ? midX - (b0.minX + b0.maxX) / 2 : o.x0 + 0.012 - b0.maxX) / t;
          // Lift so the top edge of the shadow meets the far lip of the obstacle.
          const dy = ((rise > 0 ? o.y1 : o.y0) + fit - b0.maxY) / t;
          c.wrist = [c.wrist[0] + dx, c.wrist[1] + dy, z];
          const sh = shadowOf(w, c, handed);
          if (walkable(w, sh, o.x0 - (span > 0 ? 0.05 : 0.22), o.x1 + 0.05, o.y0, o.y1)) return c;
        }
      }
    }
  }
  return null;
};

const BAKED_ANCHOR: Record<string, number> = { dog: J.indexTip, bird: J.thumbTip, rabbit: J.middleTip, snail: J.indexTip, crab: J.indexTip, swan: J.thumbTip };

/** Puts a pose's anchor joint so that its shadow lands on paper point (x, y). */
export const placeAnchor = (w: World, pose: string, x: number, y: number, z: number, a: number, handed: 1 | -1): HandTarget => {
  const q = handQuat(a);
  poseHand(pose, [0, 0, 0], q, handed, hand);
  const j = BAKED_ANCHOR[pose];
  const ax = hand.p[j * 3], ay = hand.p[j * 3 + 1], az = hand.p[j * 3 + 2];
  const t = magnification(w.light[2], z + az);
  return { pose, q, wrist: [w.light[0] + (x - w.light[0]) / t - ax, w.light[1] + (y - w.light[1]) / t - ay, z] };
};

// patience: seconds he must stand and look at you before the hand comes (for filming; a person takes a moment).
export type BotOptions = { handed?: 1 | -1; chasm?: 'bird' | 'snail'; speed?: number; reach?: number; patience?: number };

export class Bot {
  roads = new Map<number, HandTarget | null>();
  cur: Vec3 | null = null;
  pose: string | null = null;
  goal: Vec3 | null = null;
  away = 0;
  engaged = -1;
  out: Hand = newHand();
  handed: 1 | -1;
  opt: BotOptions;
  constructor(opt: BotOptions = {}) {
    this.opt = opt;
    this.handed = opt.handed ?? 1;
  }

  /** The hand a player should be making right now, or null if nothing is in Wick's way. */
  intent(w: World): HandTarget | null {
    const o = w.page.obstacles.find((p) => !w.cleared.has(p.i) && p.x1 + WICK_HALF >= w.x);
    if (o && o.kind === 'rain' && w.y > o.y0 + 0.02) return null; // he climbed the umbrella: let him down
    if (w.mode === 'carried') {
      const c = w.page.obstacles.find((p) => p.kind === 'chasm' && p.x1 > w.x - 0.08);
      const pose = w.hands[w.carrierHand]?.awake ?? 'bird';
      const dest = c ? c.x1 + 0.075 : w.x + 0.04;
      const destY = (c ? c.y0 : w.y) + WICK_H + 0.04;
      return placeAnchor(w, pose, Math.min(w.x + 0.05, dest), destY, 0.16, 0.5, this.handed);
    }
    if (!o || w.x < o.x0 - (this.opt.reach ?? 0.16)) return null;
    if (this.opt.patience) {
      if (this.engaged !== o.i && (w.mode !== 'wait' || w.waited < this.opt.patience)) return null;
      this.engaged = o.i;
    }
    if (o.kind === 'chasm' && this.opt.chasm !== 'snail' && w.x < o.x0 - 0.04) return null; // a raised bird would wall him off
    if (o.kind === 'gap' || o.kind === 'wall') {
      if (!this.roads.has(o.i)) this.roads.set(o.i, planRoad(w, o, this.handed));
      return this.roads.get(o.i) ?? null;
    }
    if (o.kind === 'rain') {
      // An umbrella: above his head, never low enough to block him, ahead of where he is going.
      const z = 0.155, t = magnification(w.light[2], z);
      const c: HandTarget = { pose: 'flat', q: handQuat(0), wrist: [w.light[0], w.light[1], z] };
      const b = bounds(shadowOf(w, c, this.handed));
      c.wrist = [c.wrist[0] + (w.x + 0.05 - (b.minX + b.maxX) / 2) / t, c.wrist[1] + (o.y0 + WICK_H + 0.025 - b.minY) / t, z];
      return c;
    }
    if (o.kind === 'crow') return placeAnchor(w, 'dog', o.x0 - 0.12, o.y0 + 0.11, 0.14, 0.15, this.handed);
    if (o.kind === 'gate') return placeAnchor(w, o.by === 'rabbit' ? 'rabbit' : 'crab', o.x0 - 0.04, o.y0 + 0.14, 0.14, 1.2, this.handed);
    if (o.kind === 'chasm') {
      if (this.opt.chasm === 'snail') {
        // Draw a silver road one slow stroke at a time; the road outlives the hand for a while.
        const k = Math.min(1, Math.max(0, (w.time % 40) / 8));
        return placeAnchor(w, 'snail', o.x0 - 0.02 + (o.x1 - o.x0 + 0.05) * k, o.y0 - 0.002, 0.14, 0.4, this.handed);
      }
      return placeAnchor(w, o.pond ? 'swan' : 'bird', w.x, o.y0 + WICK_H + 0.025, 0.16, 0.5, this.handed);
    }
    return null;
  }

  /** The hand as a human would move it: limited speed, no teleporting. */
  update(w: World, dt: number): Hand | null {
    const t = this.intent(w);
    // Changing plan means lifting the hand away, never sweeping its shadow through him.
    if (t && this.pose && w.mode !== 'carried' && (t.pose !== this.pose || Math.hypot(t.wrist[0] - this.goal![0], t.wrist[1] - this.goal![1]) > 0.08)) { this.pose = null; this.away = 0.5; this.cur = null; }
    this.away = Math.max(0, this.away - dt);
    if (!t || this.away > 0) { this.cur = null; this.pose = null; return null; }
    this.pose = t.pose;
    this.goal = t.wrist;
    if (!this.cur) this.cur = [...t.wrist] as Vec3;
    const d = Math.hypot(t.wrist[0] - this.cur[0], t.wrist[1] - this.cur[1], t.wrist[2] - this.cur[2]);
    const k = d > 1e-5 ? Math.min(1, ((w.mode === 'carried' ? 0.09 : this.opt.speed ?? 0.5) * dt) / d) : 1;
    for (const c of [0, 1, 2]) this.cur[c] += (t.wrist[c] - this.cur[c]) * k;
    return poseHand(t.pose, this.cur, t.q, this.handed, this.out);
  }
}

export { rotate };
