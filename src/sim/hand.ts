// The 25 WebXR hand joints as flat arrays, plus the bones that cast shadow.
import baked from './poses-baked.json' with { type: 'json' };

export const JOINT_NAMES = [
  'wrist',
  'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip',
] as const;

export const J = { wrist: 0, thumbTip: 4, indexMeta: 5, indexProx: 6, indexTip: 9, middleProx: 11, middleTip: 14, ringTip: 19, pinkyMeta: 20, pinkyProx: 21, pinkyTip: 24 };
export const FINGERS = [[1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24]];

// Bones of the fingers and metacarpals.
export const BONES: [number, number][] = FINGERS.flatMap((f) => f.slice(1).map((j, i) => [f[i], j] as [number, number]));
// Palm is filled by capsules between wrist/metacarpals and across the knuckles.
export const PALM_LINKS: [number, number][] = [
  [0, 1], [0, 5], [0, 10], [0, 15], [0, 20],
  [6, 11], [11, 16], [16, 21],
  [5, 10], [10, 15], [15, 20],
  [1, 5],
];

export type Hand = { p: Float32Array; r: Float32Array };

export const newHand = (): Hand => ({ p: new Float32Array(75), r: new Float32Array(25) });

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export const rotate = (q: Quat, x: number, y: number, z: number): Vec3 => {
  const [qx, qy, qz, qw] = q;
  const tx = 2 * (qy * z - qz * y);
  const ty = 2 * (qz * x - qx * z);
  const tz = 2 * (qx * y - qy * x);
  return [x + qw * tx + qy * tz - qz * ty, y + qw * ty + qz * tx - qx * tz, z + qw * tz + qx * ty - qy * tx];
};

/** Quaternion from basis axes given as columns (right-handed). */
export const quatFromBasis = (x: Vec3, y: Vec3, z: Vec3): Quat => {
  const t = x[0] + y[1] + z[2];
  if (t > 0) {
    const s = 0.5 / Math.sqrt(t + 1);
    return [(y[2] - z[1]) * s, (z[0] - x[2]) * s, (x[1] - y[0]) * s, 0.25 / s];
  }
  if (x[0] > y[1] && x[0] > z[2]) {
    const s = 2 * Math.sqrt(1 + x[0] - y[1] - z[2]);
    return [0.25 * s, (y[0] + x[1]) / s, (z[0] + x[2]) / s, (y[2] - z[1]) / s];
  }
  if (y[1] > z[2]) {
    const s = 2 * Math.sqrt(1 + y[1] - x[0] - z[2]);
    return [(y[0] + x[1]) / s, 0.25 * s, (z[1] + y[2]) / s, (z[0] - x[2]) / s];
  }
  const s = 2 * Math.sqrt(1 + z[2] - x[0] - y[1]);
  return [(z[0] + x[2]) / s, (z[1] + y[2]) / s, 0.25 * s, (x[1] - y[0]) / s];
};

const BAKED = baked as Record<string, { p: number[]; r: number[] }>;
export const POSE_NAMES = Object.keys(BAKED);

/** Places a baked pose. `handed` -1 mirrors the baked right hand to a left hand. */
export const poseHand = (name: string, wrist: Vec3, q: Quat, handed: 1 | -1 = 1, out: Hand = newHand()): Hand => {
  const b = BAKED[name];
  for (let i = 0; i < 25; i++) {
    const v = rotate(q, b.p[i * 3] * handed, b.p[i * 3 + 1], b.p[i * 3 + 2]);
    out.p[i * 3] = v[0] + wrist[0];
    out.p[i * 3 + 1] = v[1] + wrist[1];
    out.p[i * 3 + 2] = v[2] + wrist[2];
    out.r[i] = b.r[i];
  }
  return out;
};
