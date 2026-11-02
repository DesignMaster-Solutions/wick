// One page drawn as stacked cut paper: sky, hills, ground, pop-ups that unfold, and the living props.
import { Group, InstancedMesh, Matrix4, Mesh, PlaneGeometry, ShaderMaterial, DoubleSide, Vector3, Quaternion, type Material } from '@iwsdk/core';
import { BOTTOM, LEFT, RIGHT, SHEET_H, SHEET_W, type Page } from '../sim/pages.ts';
import { capsuleSpan, STRIDE } from '../sim/shadow.ts';
import type { World } from '../sim/world.ts';
import { Batch, ridge, rnd, seeded, torn } from './batch.ts';

const TOP = SHEET_H / 2;
type Palette = { sky: string; glow: string; far: string; mid: string; ground: string; lip: string; deep: string };
// Dusk to dawn across the book; the page of the day takes its colour from its seed.
const PALETTES: Palette[] = [
  { sky: '#f1dfbc', glow: '#f7c98a', far: '#b9a58e', mid: '#8d7d78', ground: '#a9632f', lip: '#d59552', deep: '#3a2a2c' },
  { sky: '#efd6b0', glow: '#ef9f6b', far: '#b08f85', mid: '#7a6a7d', ground: '#944f2e', lip: '#c67e4a', deep: '#33243a' },
  { sky: '#e6cfb2', glow: '#e78a6a', far: '#9c8592', mid: '#65608a', ground: '#7d4530', lip: '#b56d48', deep: '#2a2342' },
  { sky: '#d7c7b6', glow: '#aebfd2', far: '#8c8ca5', mid: '#57618f', ground: '#5d4a58', lip: '#8e7890', deep: '#20264a' },
  { sky: '#d0c2bd', glow: '#e5e2cf', far: '#7e83a6', mid: '#4b5589', ground: '#55435f', lip: '#83718f', deep: '#1c2148' },
  { sky: '#c9c1c9', glow: '#f3ecd2', far: '#70799f', mid: '#404b82', ground: '#4b3f62', lip: '#776b92', deep: '#181d44' },
  { sky: '#dcc9c4', glow: '#f2b98c', far: '#8f86a0', mid: '#5c5a88', ground: '#6a4655', lip: '#a06f76', deep: '#231f44' },
  { sky: '#f3e2c2', glow: '#fbcf88', far: '#c0a78e', mid: '#8d8583', ground: '#b56a31', lip: '#e0a257', deep: '#3b3040' },
];

const P = (...a: number[]) => { const o: [number, number][] = []; for (let i = 0; i < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };

const pine = (b: Batch, h: number, c: string) => {
  const w = h * 0.36;
  b.poly(P(-h * 0.03, 0, h * 0.03, 0, h * 0.03, h * 0.2, -h * 0.03, h * 0.2), '#3a2a22', 0.0002);
  for (let i = 0; i < 3; i++) {
    const y = h * (0.14 + i * 0.26), k = 1 - i * 0.26;
    b.poly(P(-w * k, y, w * k, y, 0, y + h * 0.44 * (k + 0.1)), c, 0.0004 + i * 0.0002);
  }
};
const house = (b: Batch, s: number, c: string, lit: string) => {
  b.poly(P(-s, 0, s, 0, s, s * 1.1, -s, s * 1.1), c);
  b.poly(P(-s * 1.25, s * 1.05, s * 1.25, s * 1.05, 0, s * 1.85), '#3f2a2a', 0.0003);
  b.poly(P(-s * 0.3, s * 0.3, s * 0.3, s * 0.3, s * 0.3, s * 0.8, -s * 0.3, s * 0.8), lit, 0.0003);
};
const lantern = (b: Batch, s: number) => {
  b.poly(P(-s * 0.04, 0, s * 0.04, 0, s * 0.04, s * 1.5, -s * 0.04, s * 1.5), '#3a2a22');
  b.disc(0, s * 1.5, s * 0.34, '#f7b955', 0.0004, 12);
  b.poly(P(-s * 0.36, s * 1.74, s * 0.36, s * 1.74, 0, s * 2.1), '#7a2c1a', 0.0005);
};

export class Stage {
  root = new Group();
  popups: { m: Mesh; t: number; delay: number }[] = [];
  crow: Group | null = null; crowT = 0; crowObstacle = -1;
  gate: Group | null = null; gateL: Mesh | null = null; gateR: Mesh | null = null; gateT = 0; gateObstacle = -1;
  rain: InstancedMesh | null = null; drops: Float32Array = new Float32Array(0); rainX0 = 0; rainX1 = 0; rainGround = 0;
  mat: Material;
  constructor(mat: Material) { this.mat = mat; }

  private popup(draw: (b: Batch) => void, x: number, y: number, z: number, delay: number) {
    const b = new Batch();
    draw(b);
    const m = b.build(this.mat);
    m.position.set(x, y, z);
    m.rotation.x = -Math.PI / 2;
    this.root.add(m);
    this.popups.push({ m, t: 0, delay });
  }

  build(page: Page, index: number, litPages: number) {
    this.root.clear();
    this.popups = [];
    this.crow = this.gate = this.gateL = this.gateR = null;
    this.rain = null;
    seeded(index * 17 + 3);
    const pal = PALETTES[index % PALETTES.length];
    const b = new Batch();
    // The sheet, then sky glow and two ranges of hills, each its own thin layer of paper.
    // Runs under the frame: the frame sits nearer the eye, so an exact fit would show a sliver of room.
    b.poly(P(LEFT - 0.018, BOTTOM - 0.018, RIGHT + 0.018, BOTTOM - 0.018, RIGHT + 0.018, TOP + 0.018, LEFT - 0.018, TOP + 0.018), pal.sky, 0);
    b.disc(0.13 + (index % 3) * 0.06, 0.095 - (index % 2) * 0.03, 0.064, pal.glow, 0.0006, 28);
    b.poly(ridge(LEFT, RIGHT, -0.015 + rnd() * 0.02, 0.028, BOTTOM, index * 1.7), pal.far, 0.0012);
    b.poly(ridge(LEFT, RIGHT, -0.05, 0.022, BOTTOM, index * 2.9 + 1), pal.mid, 0.0018);
    // The void under gaps and the pond.
    for (const o of page.obstacles) {
      if (o.kind !== 'gap' && o.kind !== 'chasm') continue;
      const y = Math.max(o.y0, o.y1) - 0.012;
      b.poly(P(o.x0 - 0.01, BOTTOM, o.x1 + 0.01, BOTTOM, o.x1 + 0.01, y, o.x0 - 0.01, y), pal.deep, 0.0022);
      if (o.pond) {
        b.poly(torn(o.x0 - 0.01, o.x1 + 0.01, o.y0 - 0.05, BOTTOM, 0.004), '#2f5a8a', 0.0026);
        b.poly(torn(o.x0 - 0.01, o.x1 + 0.01, o.y0 - 0.07, BOTTOM, 0.006), '#23446f', 0.0029);
      }
    }
    // Ground: two torn layers, a lighter lip catching the candle.
    for (const k of page.blocks) {
      b.cut(torn(k.x0, k.x1, k.top, BOTTOM), pal.lip, 0.0034, 0.0025);
      b.poly(torn(k.x0, k.x1, k.top - 0.009, BOTTOM, 0.005), pal.ground, 0.0042);
      b.poly(torn(k.x0, k.x1, k.top - 0.052, BOTTOM, 0.011), pal.deep, 0.0048);
    }
    // Door he comes out of and door he goes home through.
    const door = (x: number, y: number, inner: string) => {
      const w = 0.026, h = 0.072;
      const arch = (s: number) => [...P(x - w * s, y, x + w * s, y), ...Array.from({ length: 9 }, (_, i) => [x + Math.cos((i / 8) * Math.PI) * w * s, y + h * s - w + Math.sin((i / 8) * Math.PI) * w * s] as [number, number])];
      b.cut(arch(1.25), '#3a2622', 0.0056, 0.002);
      b.poly(arch(1), inner, 0.006);
    };
    door(page.startX, page.startY, '#2a1a18');
    door(page.exitX, page.exitY, '#ffc861');
    // Frame: a thick kraft mat with a torn inner edge. It gives the page real depth in stereo.
    const fw = 0.022, fr = '#3b2a22', z = 0.0085;
    b.cut(P(LEFT - fw, BOTTOM - fw * 2, RIGHT + fw, BOTTOM - fw * 2, RIGHT + fw, BOTTOM + 0.003, LEFT - fw, BOTTOM + 0.003), fr, z);
    b.cut(P(LEFT - fw, TOP - 0.003, RIGHT + fw, TOP - 0.003, RIGHT + fw, TOP + fw, LEFT - fw, TOP + fw), fr, z);
    b.cut(P(LEFT - fw, BOTTOM - fw, LEFT + 0.003, BOTTOM - fw, LEFT + 0.003, TOP + fw, LEFT - fw, TOP + fw), fr, z);
    b.cut(P(RIGHT - 0.003, BOTTOM - fw, RIGHT + fw, BOTTOM - fw, RIGHT + fw, TOP + fw, RIGHT - 0.003, TOP + fw), fr, z);
    this.root.add(b.build(this.mat));

    // Pop-ups stand up from the ground when the page opens. Every page you have lit adds lanterns:
    // the book remembers.
    const spots = page.blocks.filter((k) => k.x1 - k.x0 > 0.07);
    let delay = 0.1;
    for (const k of spots) {
      const n = Math.max(1, Math.round((k.x1 - k.x0) / 0.1));
      for (let i = 0; i < n; i++) {
        const x = k.x0 + (k.x1 - k.x0) * ((i + 0.3 + rnd() * 0.4) / n);
        if (Math.abs(x - page.startX) < 0.05 || Math.abs(x - page.exitX) < 0.05) continue;
        const kind = rnd();
        const zz = 0.022 + rnd() * 0.03;
        const y = k.top - 0.0015;
        if (kind < 0.62) { const h = 0.06 + rnd() * 0.05, c = rnd() < 0.5 ? '#2f4a3f' : '#3b5a45'; this.popup((bb) => pine(bb, h, c), x, y, zz, delay); }
        else if (kind < 0.86) { const s = 0.018 + rnd() * 0.01; this.popup((bb) => house(bb, s, '#c9a26f', '#ffd27a'), x, y, zz, delay); }
        else this.popup((bb) => lantern(bb, 0.026), x, y, zz, delay);
        delay += 0.09;
      }
    }
    for (let i = 0; i < Math.min(litPages, 8) && spots.length; i++) {
      const k = spots[i % spots.length];
      const x = k.x0 + (k.x1 - k.x0) * ((i * 0.37 + 0.15) % 1);
      this.popup((bb) => lantern(bb, 0.024), x, k.top - 0.0015, 0.016, delay + i * 0.05);
    }

    for (const o of page.obstacles) {
      if (o.kind === 'crow') this.buildCrow(o.x0, o.y0, o.i);
      if (o.kind === 'gate') this.buildGate(o.x0, o.y0, o.i, o.by === 'crab');
      if (o.kind === 'rain') this.buildRain(o.x0, o.x1, o.y0);
    }
  }

  private buildCrow(x: number, y: number, i: number) {
    const g = new Group();
    const b = new Batch();
    b.poly(P(-0.03, 0.012, -0.012, 0, 0.018, 0.004, 0.03, 0.022, 0.016, 0.046, -0.008, 0.042), '#1d1a24');
    b.disc(0.024, 0.052, 0.015, '#1d1a24', 0.0002, 12);
    b.poly(P(0.034, 0.057, 0.058, 0.05, 0.035, 0.044), '#d59b2d', 0.0003);
    b.disc(0.029, 0.056, 0.0035, '#f6e6c8', 0.0004, 8);
    b.poly(P(-0.006, 0, -0.002, 0, -0.002, -0.012, -0.006, -0.012), '#1d1a24');
    b.poly(P(0.008, 0.002, 0.012, 0.002, 0.012, -0.012, 0.008, -0.012), '#1d1a24');
    g.add(b.build(this.mat));
    g.position.set(x, y + 0.012, 0.014);
    g.rotation.y = Math.PI; // faces the way Wick comes from
    this.crow = g; this.crowT = 0; this.crowObstacle = i;
    this.root.add(g);
  }

  private buildGate(x: number, y: number, i: number, rope: boolean) {
    const g = new Group();
    const wing = (dir: number) => {
      const b = new Batch();
      const w = 0.03, h = 0.098;
      b.cut(P(0, 0, dir * w, 0, dir * w, h, 0, h + 0.012), rope ? '#6f4f3a' : '#5b4a68', 0);
      for (let k = 1; k < 4; k++) b.poly(P(0, (k * h) / 4, dir * w, (k * h) / 4, dir * w, (k * h) / 4 + 0.003, 0, (k * h) / 4 + 0.003), '#2a1f22', 0.0003);
      return b.build(this.mat);
    };
    this.gateL = wing(-1); this.gateR = wing(1);
    this.gateL.position.x = -0.03; this.gateR.position.x = 0.03;
    g.add(this.gateL, this.gateR);
    const m = new Batch();
    if (rope) {
      m.poly(P(-0.03, 0.05, 0.03, 0.047, 0.03, 0.058, -0.03, 0.061), '#e8c88c', 0.002).disc(0, 0.054, 0.012, '#c49a5a', 0.0024, 10);
    } else {
      // A stone drum that wants a good thump.
      m.disc(-0.075, 0.02, 0.02, '#8d8c93', 0, 16).disc(-0.075, 0.02, 0.012, '#b7b6bb', 0.0004, 14);
    }
    g.add(m.build(this.mat));
    g.position.set(x, y, 0.016);
    this.gate = g; this.gateT = 0; this.gateObstacle = i;
    this.root.add(g);
  }

  private buildRain(x0: number, x1: number, ground: number) {
    const n = 44;
    const geo = new PlaneGeometry(0.0016, 0.022);
    const mat = new ShaderMaterial({ side: DoubleSide, vertexShader: 'void main(){ gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position,1.0); }', fragmentShader: 'void main(){ gl_FragColor = vec4(0.13,0.2,0.42,1.0); }' });
    this.rain = new InstancedMesh(geo, mat, n);
    this.rain.frustumCulled = false;
    this.drops = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.drops[i * 3] = x0 + (x1 - x0) * rnd();
      this.drops[i * 3 + 1] = BOTTOM + rnd() * (TOP - ground);
      this.drops[i * 3 + 2] = 0.34 + rnd() * 0.14;
    }
    this.rainX0 = x0; this.rainX1 = x1; this.rainGround = ground;
    this.root.add(this.rain);
    const c = new Batch();
    // A low cloud of torn paper, so the rain has somewhere to come from.
    for (let i = 0; i <= 5; i++) c.disc(x0 + ((x1 - x0) * i) / 5, TOP - 0.038 + (i % 2) * 0.012, 0.038 + (i % 3) * 0.008, '#55617f', 0.0046 + i * 0.0002, 14);
    this.root.add(c.build(this.mat));
  }

  setProps(on: boolean) {
    for (const p of this.popups) p.m.visible = on;
    if (this.crow) this.crow.visible = on && this.crow.position.y < TOP + 0.02;
    if (this.gate) this.gate.visible = on;
    if (this.rain) this.rain.visible = on;
  }

  update(w: World, dt: number, t: number) {
    for (const p of this.popups) {
      p.t += dt;
      const k = Math.min(1, Math.max(0, (p.t - p.delay) / 0.55));
      const back = 1 + 2.3 * Math.pow(k - 1, 3) + 1.3 * Math.pow(k - 1, 2); // back-ease: paper overshoots its fold
      p.m.rotation.x = -Math.PI / 2 * (1 - back);
    }
    if (this.crow) {
      if (w.cleared.has(this.crowObstacle)) {
        this.crowT += dt;
        this.crow.position.x += dt * (0.05 + this.crowT * 0.34);
        this.crow.position.y += dt * (0.14 + this.crowT * 0.14);
        this.crow.rotation.z = Math.sin(t * 30) * 0.26;
        if (this.crow.position.y > TOP + 0.02) this.crow.visible = false;
      } else this.crow.rotation.z = Math.sin(t * 2.1) * 0.04;
    }
    if (this.gate && this.gateL && this.gateR && w.cleared.has(this.gateObstacle) && this.gateT < 1) {
      this.gateT = Math.min(1, this.gateT + dt * 1.2);
      const k = this.gateT * this.gateT * (3 - 2 * this.gateT);
      this.gateL.rotation.y = -k * 1.5;
      this.gateR.rotation.y = k * 1.5;
    }
    if (this.rain) this.stepRain(w, dt);
  }

  private stepRain(w: World, dt: number) {
    const m = new Matrix4(), q = new Quaternion(), s = new Vector3(1, 1, 1), v = new Vector3();
    const n = this.drops.length / 3, sh = w.shadow;
    const passed = w.page.obstacles.every((o) => o.kind !== 'rain' || w.cleared.has(o.i));
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      this.drops[o + 1] -= this.drops[o + 2] * dt;
      // A drop stops on the highest shade over its column: your umbrella really is one.
      let floor = this.rainGround;
      for (let c = 0; c < sh.n; c++) {
        const span = capsuleSpan(sh.d, c * STRIDE, this.drops[o]);
        if (span && span[1] > floor) floor = span[1];
      }
      if (this.drops[o + 1] < floor) { this.drops[o + 1] = TOP - 0.02; this.drops[o] = this.rainX0 + (this.rainX1 - this.rainX0) * rnd(); }
      v.set(this.drops[o], this.drops[o + 1], 0.015);
      s.setScalar(passed ? 0.0001 : 1);
      this.rain!.setMatrixAt(i, m.compose(v, q, s));
    }
    this.rain!.instanceMatrix.needsUpdate = true;
  }
}

export { SHEET_W };
