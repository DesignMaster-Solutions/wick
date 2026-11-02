// A static batch of flat paper polygons with per-vertex colour: one draw call per layer.
import { BufferAttribute, BufferGeometry, Mesh, ShapeUtils, Vector2, type Material } from '@iwsdk/core';
import { hex } from './materials.ts';

type P = [number, number];

export class Batch {
  pos: number[] = [];
  col: number[] = [];
  nor: number[] = [];
  poly(points: P[], color: string, z = 0) {
    const c = hex(color);
    const tris = ShapeUtils.triangulateShape(points.map(([x, y]) => new Vector2(x, y)), []);
    for (const t of tris) for (const i of t) {
      this.pos.push(points[i][0], points[i][1], z);
      this.col.push(c[0], c[1], c[2]);
      this.nor.push(0, 0, 1);
    }
    return this;
  }
  /** A cut paper shape with a soft contact shadow behind it, so layers read as physically stacked. */
  cut(points: P[], color: string, z: number, lift = 0.003) {
    this.poly(points.map(([x, y]) => [x + lift * 0.45, y - lift] as P), '#1a100a', z - 0.0006);
    return this.poly(points, color, z);
  }
  disc(cx: number, cy: number, r: number, color: string, z = 0, n = 18) {
    return this.poly(Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * 6.2832) * r, cy + Math.sin((i / n) * 6.2832) * r] as P), color, z);
  }
  build(mat: Material) {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('color', new BufferAttribute(new Float32Array(this.col), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    const m = new Mesh(g, mat);
    m.frustumCulled = false;
    return m;
  }
}

let seed = 1;
export const seeded = (s: number) => { seed = s * 7919 + 13; };
export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** Top edge of a hand-torn strip of paper from x0 to x1, closed down to `bottom`. */
export const torn = (x0: number, x1: number, top: number, bottom: number, rough = 0.0028): P[] => {
  const pts: P[] = [[x0, bottom]];
  const n = Math.max(2, Math.round((x1 - x0) / 0.012));
  for (let i = 0; i <= n; i++) {
    const edge = i === 0 || i === n;
    pts.push([x0 + ((x1 - x0) * i) / n, top + (edge ? 0 : (rnd() - 0.5) * rough)]);
  }
  pts.push([x1, bottom]);
  return pts;
};

/** A rolling ridge line for background hills. */
export const ridge = (x0: number, x1: number, base: number, amp: number, bottom: number, phase: number): P[] => {
  const pts: P[] = [[x0, bottom]];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = x0 + (x1 - x0) * t;
    pts.push([x, base + Math.sin(t * 5.1 + phase) * amp + Math.sin(t * 13 + phase * 2) * amp * 0.34]);
  }
  pts.push([x1, bottom]);
  return pts;
};
