// Puppet eyes, wordless cartoon marks and paper confetti: everything the events make visible.
import { DoubleSide, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, PlaneGeometry, Quaternion, RingGeometry, ShaderMaterial, Vector3, type Material } from '@iwsdk/core';
import type { GameEvent, HandState, World } from '../sim/world.ts';
import { Batch } from './batch.ts';

const CONFETTI = 90;
const COLORS = [[0.96, 0.82, 0.55], [0.85, 0.3, 0.16], [0.97, 0.94, 0.85], [0.92, 0.65, 0.25]];

export class Fx {
  root = new Group();
  eyes: { g: Group; pupil: Mesh; open: number }[] = [];
  rings: { m: Mesh; t: number; on: boolean }[] = [];
  bits: InstancedMesh;
  p = new Float32Array(CONFETTI * 7); // x y z vx vy spin life
  cursor = 0;
  butterfly: Group;
  constructor(mat: Material) {
    for (let i = 0; i < 2; i++) {
      const g = new Group();
      const white = new Batch().disc(0, 0, 0.012, '#f7e7c4', 0, 14).build(mat);
      const pupil = new Batch().disc(0, 0, 0.0058, '#1a0f0a', 0, 10).build(mat);
      pupil.position.z = 0.0005;
      g.add(white, pupil);
      g.visible = false;
      this.root.add(g);
      this.eyes.push({ g, pupil, open: 0 });
    }
    const ringMat = new ShaderMaterial({ transparent: true, depthWrite: false, side: DoubleSide, uniforms: {}, vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: 'void main(){ gl_FragColor = vec4(0.09,0.05,0.04,0.85); }' });
    for (let i = 0; i < 4; i++) {
      const m = new Mesh(new RingGeometry(0.86, 1, 22, 1, -0.75, 1.5), ringMat);
      m.visible = false;
      this.root.add(m);
      this.rings.push({ m, t: 0, on: false });
    }
    const geo = new PlaneGeometry(0.0085, 0.0058);
    geo.setAttribute('aColor', new InstancedBufferAttribute(new Float32Array(CONFETTI * 3).map((_, i) => COLORS[Math.floor(i / 3) % 4][i % 3]), 3));
    this.bits = new InstancedMesh(geo, new ShaderMaterial({
      side: DoubleSide,
      vertexShader: 'attribute vec3 aColor; varying vec3 vC; void main(){ vC = aColor; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vC; void main(){ gl_FragColor = vec4(vC, 1.0); }',
    }), CONFETTI);
    this.bits.instanceMatrix.setUsage(DynamicDrawUsage);
    this.bits.frustumCulled = false;
    this.bits.count = 0;
    this.root.add(this.bits);
    // Butterfly: two paper wings that visit the page when your two open hands meet at the thumbs.
    this.butterfly = new Group();
    const wing = new Batch().poly([[0, 0], [0.03, 0.03], [0.042, 0.006], [0.018, -0.022]], '#e9792b').disc(0.028, 0.012, 0.005, '#f7e7c4', 0.0003, 8).build(mat);
    const wing2 = wing.clone();
    wing2.scale.x = -1;
    this.butterfly.add(wing, wing2);
    this.butterfly.visible = false;
    this.root.add(this.butterfly);
  }

  burst(x: number, y: number, n: number, up = 0.2) {
    for (let i = 0; i < n; i++) {
      const c = this.cursor++ % CONFETTI, o = c * 7, a = Math.random() * 6.283;
      this.p.set([x, y, 0.02 + Math.random() * 0.04, Math.cos(a) * 0.1 * Math.random(), up * (0.3 + Math.random()), (Math.random() - 0.5) * 16, 1.1 + Math.random() * 0.7], o);
    }
  }
  ring(x: number, y: number, flip = false) {
    const r = this.rings.find((q) => !q.on) ?? this.rings[0];
    r.on = true; r.t = 0; r.m.position.set(x, y, 0.016); r.m.rotation.z = flip ? Math.PI : 0;
  }
  event(e: GameEvent) {
    if (e.t === 'awake') { this.burst(e.x, e.y, 10, 0.12); this.ring(e.x, e.y); }
    if (e.t === 'bark') { this.ring(e.x + 0.02, e.y); setTimeout(() => this.ring(e.x + 0.02, e.y), 130); }
    if (e.t === 'thump') { this.burst(e.x, e.y - 0.08, 22, 0.16); this.ring(e.x, e.y - 0.06); }
    if (e.t === 'snip') this.burst(e.x, e.y, 16, 0.1);
    if (e.t === 'crow-flees') this.burst(e.x, e.y + 0.04, 14, 0.2);
    if (e.t === 'page-done') this.burst(e.x, e.y + 0.05, 60, 0.32);
    if (e.t === 'album-new') this.burst(e.x, e.y, 20, 0.22);
    if (e.t === 'land' || e.t === 'back') this.burst(e.x, e.y, 5, 0.06);
    if (e.t === 'butterfly') this.butterfly.visible = true;
  }
  update(w: World, dt: number, t: number) {
    w.hands.forEach((s: HandState, i) => {
      const e = this.eyes[i];
      const target = s.awake && s.awake !== 'butterfly' ? 1 : 0;
      e.open += (target - e.open) * Math.min(1, dt * 12);
      e.g.visible = e.open > 0.02;
      if (!e.g.visible) return;
      // The eye sits just inside the shadow from its anchor, and always watches Wick.
      e.g.position.set(s.ax - 0.018, s.ay - 0.012, 0.0142);
      const blink = Math.sin(t * 1.3 + i) > 0.985 ? 0.15 : 1;
      e.g.scale.set(1, e.open * blink, 1);
      const dx = w.x - s.ax, dy = w.y - s.ay, d = Math.hypot(dx, dy) || 1;
      e.pupil.position.x = (dx / d) * 0.0045;
      e.pupil.position.y = (dy / d) * 0.0045;
    });
    for (const r of this.rings) {
      if (!r.on) { r.m.visible = false; continue; }
      r.t += dt;
      const k = r.t / 0.45;
      r.m.visible = k < 1;
      r.m.scale.setScalar(0.012 + k * 0.05);
      if (k >= 1) r.on = false;
    }
    const m = new Matrix4(), q = new Quaternion(), v = new Vector3(), s = new Vector3(1, 1, 1), axis = new Vector3(0.4, 0.8, 0.3).normalize();
    let n = 0;
    for (let i = 0; i < CONFETTI; i++) {
      const o = i * 7;
      if (this.p[o + 6] <= 0) continue;
      this.p[o + 6] -= dt;
      this.p[o + 4] -= 0.34 * dt;
      this.p[o] += this.p[o + 3] * dt;
      this.p[o + 1] += this.p[o + 4] * dt;
      q.setFromAxisAngle(axis, this.p[o + 5] * this.p[o + 6]);
      v.set(this.p[o], this.p[o + 1], this.p[o + 2]);
      this.bits.setMatrixAt(n++, m.compose(v, q, s));
    }
    this.bits.count = n;
    this.bits.instanceMatrix.needsUpdate = true;
    this.butterfly.visible = w.butterfly > 0.3;
    if (this.butterfly.visible) {
      this.butterfly.position.set(Math.sin(t * 0.7) * 0.2, 0.1 + Math.sin(t * 1.3) * 0.04, 0.03);
      const flap = 0.3 + Math.abs(Math.sin(t * 9)) * 0.9;
      this.butterfly.children[0].rotation.y = flap;
      this.butterfly.children[1].rotation.y = -flap;
    }
  }
}
