// Analytic shadow: the flame projects hand joints onto the paper plane (z = 0).
// One capsule list drives both the drawing and the collision, so what you see is what he walks on.
import { BONES, PALM_LINKS, type Hand, type Vec3 } from './hand.ts';

export const STRIDE = 7; // ax ay bx by radius penumbra magnification
export const MAX_CAPSULES = 2 * (BONES.length + PALM_LINKS.length) + 40;
export const LIGHT_RADIUS = 0.011;
export const MAX_SOLID_MAG = 3.6; // beyond this the shadow is too diffuse to stand on
const PALM_RADIUS_BOOST = 1.5;

export type ShadowSet = { n: number; d: Float32Array };
export const newShadowSet = (): ShadowSet => ({ n: 0, d: new Float32Array(MAX_CAPSULES * STRIDE) });

/** Magnification of a point at height z over the paper, seen from a light at height lz. <=0 means no shadow. */
export const magnification = (lz: number, z: number): number => {
  const pz = Math.max(z, 0);
  return pz >= lz - 0.02 ? -1 : lz / (lz - pz);
};

export const projectPoint = (l: Vec3, x: number, y: number, z: number): [number, number, number] | null => {
  const t = magnification(l[2], z);
  return t < 0 ? null : [l[0] + (x - l[0]) * t, l[1] + (y - l[1]) * t, t];
};

const addLink = (s: ShadowSet, h: Hand, l: Vec3, a: number, b: number, boost: number) => {
  const ta = magnification(l[2], h.p[a * 3 + 2]);
  const tb = magnification(l[2], h.p[b * 3 + 2]);
  if (ta < 0 || tb < 0 || s.n >= MAX_CAPSULES) return;
  const t = (ta + tb) / 2;
  const o = s.n++ * STRIDE;
  s.d[o] = l[0] + (h.p[a * 3] - l[0]) * ta;
  s.d[o + 1] = l[1] + (h.p[a * 3 + 1] - l[1]) * ta;
  s.d[o + 2] = l[0] + (h.p[b * 3] - l[0]) * tb;
  s.d[o + 3] = l[1] + (h.p[b * 3 + 1] - l[1]) * tb;
  s.d[o + 4] = ((h.r[a] * ta + h.r[b] * tb) / 2) * boost;
  s.d[o + 5] = LIGHT_RADIUS * (t - 1) + 0.0015;
  s.d[o + 6] = t;
};

export const addHandShadow = (s: ShadowSet, h: Hand, l: Vec3) => {
  for (const [a, b] of BONES) addLink(s, h, l, a, b, 1);
  for (const [a, b] of PALM_LINKS) addLink(s, h, l, a, b, PALM_RADIUS_BOOST);
};

export const addRawCapsule = (s: ShadowSet, ax: number, ay: number, bx: number, by: number, r: number) => {
  if (s.n >= MAX_CAPSULES) return;
  const o = s.n++ * STRIDE;
  s.d.set([ax, ay, bx, by, r, 0.002, 1], o);
};

const out: [number, number] = [0, 0];
/** Vertical span of a capsule at column x (a stadium is convex, so it is one interval). */
export const capsuleSpan = (d: Float32Array, o: number, x: number): [number, number] | null => {
  const ax = d[o], ay = d[o + 1], bx = d[o + 2], by = d[o + 3], r = d[o + 4];
  if (x < Math.min(ax, bx) - r || x > Math.max(ax, bx) + r) return null;
  let lo = Infinity, hi = -Infinity;
  for (const [cx, cy] of [[ax, ay], [bx, by]]) {
    const dx = x - cx;
    if (Math.abs(dx) <= r) {
      const h = Math.sqrt(r * r - dx * dx);
      lo = Math.min(lo, cy - h);
      hi = Math.max(hi, cy + h);
    }
  }
  const ux = bx - ax, uy = by - ay, len = Math.hypot(ux, uy);
  if (len > 1e-6) {
    const nx = ux / len, ny = uy / len;
    // Rectangle part: clip the column against both slabs of the oriented box.
    let a = -Infinity, b = Infinity, ok = true;
    const clip = (cx: number, cy: number, min: number, max: number) => {
      const c = cx * (x - ax) - cy * ay; // cx*(x-ax) + cy*(y-ay) in [min,max], solving for y
      if (Math.abs(cy) < 1e-6) {
        const v = cx * (x - ax);
        if (v < min || v > max) ok = false;
        return;
      }
      const y0 = (min - c) / cy, y1 = (max - c) / cy;
      a = Math.max(a, Math.min(y0, y1));
      b = Math.min(b, Math.max(y0, y1));
    };
    clip(nx, ny, 0, len);
    clip(-ny, nx, -r, r);
    if (ok && a <= b) {
      lo = Math.min(lo, a);
      hi = Math.max(hi, b);
    }
  }
  if (lo > hi) return null;
  out[0] = lo;
  out[1] = hi;
  return out;
};

/** Highest solid shadow surface at x that a foot at y can reach (top no higher than y + stepUp). */
export const shadowGround = (s: ShadowSet, x: number, y: number, stepUp: number): number | null => {
  let best: number | null = null;
  for (let i = 0; i < s.n; i++) {
    const o = i * STRIDE;
    if (s.d[o + 6] > MAX_SOLID_MAG) continue;
    const span = capsuleSpan(s.d, o, x);
    if (span && span[1] <= y + stepUp && (best === null || span[1] > best)) best = span[1];
  }
  return best;
};

/** Does solid shadow fill any part of the column between y0 and y1? */
export const shadowOverlaps = (s: ShadowSet, x: number, y0: number, y1: number): boolean => {
  for (let i = 0; i < s.n; i++) {
    const o = i * STRIDE;
    if (s.d[o + 6] > MAX_SOLID_MAG) continue;
    const span = capsuleSpan(s.d, o, x);
    if (span && span[1] > y0 && span[0] < y1) return true;
  }
  return false;
};

/** Any shadow at all above y at x: rain cares about shade, not about solidity. */
export const shadowAbove = (s: ShadowSet, x: number, y: number): boolean => {
  for (let i = 0; i < s.n; i++) {
    const span = capsuleSpan(s.d, i * STRIDE, x);
    if (span && span[1] > y) return true;
  }
  return false;
};
