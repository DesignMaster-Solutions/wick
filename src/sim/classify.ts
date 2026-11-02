// Classic hand-shadow poses from 25 joints. Only ratios of distances, so it is
// chirality-free and independent of hand size. No two-hand interlacing: that breaks tracking.
import { FINGERS, J, type Hand } from './hand.ts';

export type PoseLabel = 'dog' | 'rabbit' | 'snail' | 'bird' | 'crab' | 'swan' | null;
export const PUPPETS = ['dog', 'bird', 'rabbit', 'snail', 'crab', 'swan', 'butterfly'] as const;
export type Puppet = (typeof PUPPETS)[number];

const dist = (p: Float32Array, a: number, b: number) =>
  Math.hypot(p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]);

export type HandFeatures = { ext: number[]; thumbIndex: number; tipsSpread: number; thumbOut: number; pinkyGap: number; size: number };

/** ext[i]: 1 = straight finger, about 0.4 = fully curled. */
export const features = (h: Hand): HandFeatures => {
  const ext = FINGERS.map((f) => {
    let path = 0;
    for (let i = 1; i < f.length; i++) path += dist(h.p, f[i - 1], f[i]);
    return dist(h.p, f[0], f[f.length - 1]) / path;
  });
  const size = dist(h.p, J.wrist, J.middleProx);
  return {
    ext,
    size,
    thumbIndex: dist(h.p, J.thumbTip, J.indexTip) / size,
    // How far every fingertip sits from the thumb tip; small = fingers gathered into a beak.
    tipsSpread: Math.max(dist(h.p, J.thumbTip, J.indexTip), dist(h.p, J.thumbTip, J.middleTip), dist(h.p, J.thumbTip, J.ringTip), dist(h.p, J.thumbTip, J.pinkyTip)) / size,
    thumbOut: dist(h.p, J.thumbTip, J.indexProx) / size,
    pinkyGap: dist(h.p, J.pinkyTip, J.ringTip) / size,
  };
};

const STRAIGHT = 0.86;
const CURLED = 0.68;

export const classify = (h: Hand): PoseLabel => {
  const f = features(h);
  const [t, i, m, r, p] = f.ext;
  const up = (x: number) => x > STRAIGHT;
  const down = (x: number) => x < CURLED;
  const gathered = (x: number) => x > 0.45 && !up(x);
  if (f.tipsSpread < 0.72 && gathered(i) && gathered(m) && gathered(r) && gathered(p)) return 'swan';
  if (f.thumbIndex < 0.32 && up(m) && up(r)) return 'bird';
  if (up(i) && up(m) && down(r) && down(p)) return 'rabbit';
  if (up(i) && down(m) && down(r) && up(p)) return 'snail';
  if (up(i) && up(m) && up(r) && down(p) && t > STRAIGHT && f.thumbOut > 0.8) return 'dog';
  const half = (x: number) => x >= CURLED && x <= STRAIGHT + 0.06;
  if (half(i) && half(m) && half(r) && f.thumbIndex > 0.4 && f.thumbIndex < 1.3 && !(up(i) && up(m) && up(r))) return 'crab';
  return null;
};

export const isPinching = (h: Hand) => dist(h.p, J.thumbTip, J.indexTip) < 0.022;

/** Two open hands, thumbs touching: the one two-hand puppet. Optional, never needed to finish a page. */
export const isButterfly = (a: Hand, b: Hand): boolean => {
  const fa = features(a), fb = features(b);
  const open = (f: HandFeatures) => f.ext.slice(1).every((x) => x > 0.86);
  const thumbs = Math.hypot(a.p[12] - b.p[12], a.p[13] - b.p[13], a.p[14] - b.p[14]);
  return open(fa) && open(fb) && thumbs < 0.05;
};
