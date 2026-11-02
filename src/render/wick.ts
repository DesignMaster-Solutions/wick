// Wick: a jointed paper puppet held together by brass fasteners, like the shadow-theatre figures he comes from.
import { Group, Mesh, PlaneGeometry, ShaderMaterial, type Material, CustomBlending, OneFactor, OneMinusSrcAlphaFactor } from '@iwsdk/core';
import { WICK_H, type World } from '../sim/world.ts';
import { Batch } from './batch.ts';

const H = WICK_H;
const V = '#c8391f', VD = '#8e2413', CREAM = '#f6e6c8', BRASS = '#e2b04a', INK = '#21130d';

const part = (mat: Material, draw: (b: Batch) => void, x = 0, y = 0, z = 0) => {
  const b = new Batch();
  draw(b);
  const m = b.build(mat);
  m.position.set(x, y, z);
  return m;
};

export class WickFigure {
  root = new Group();
  body: Mesh; head: Mesh; eyes: Mesh; legL: Mesh; legR: Mesh; armBack: Mesh; armFlame: Group; flame: Mesh;
  phase = 0; dispY = 0; look = 0; flameUni = { uT: { value: 0 }, uK: { value: 1 } }; blink = 0; hop = 0;
  constructor(mat: Material) {
    const legW = H * 0.075, legLen = H * 0.33, bodyW = H * 0.2;
    const leg = (b: Batch) => b.poly([[-legW, 0], [legW, 0], [legW * 0.8, -legLen], [legW * 2.3, -legLen - legW * 0.7], [-legW, -legLen - legW * 0.7]], VD, 0).disc(0, 0, legW * 0.55, BRASS, 0.0004, 8);
    this.legL = part(mat, leg, -H * 0.05, legLen + legW * 0.7, 0.0006);
    this.legR = part(mat, leg, H * 0.05, legLen + legW * 0.7, 0.0002);
    this.body = part(mat, (b) => b.poly([[-bodyW * 0.72, 0], [bodyW * 0.72, 0], [bodyW * 0.9, H * 0.05], [bodyW * 0.56, H * 0.33], [-bodyW * 0.56, H * 0.33], [-bodyW * 0.9, H * 0.05]], V, 0).poly([[-bodyW * 0.1, H * 0.02], [bodyW * 0.1, H * 0.02], [bodyW * 0.1, H * 0.3], [-bodyW * 0.1, H * 0.3]], VD, 0.0002), 0, legLen, 0.001);
    this.head = part(mat, (b) => b.disc(0, 0, H * 0.17, CREAM, 0, 16).poly([[-H * 0.17, H * 0.03], [0, H * 0.34], [H * 0.17, H * 0.03]], VD, 0.0003), 0, H * 0.78, 0.0015);
    this.eyes = part(mat, (b) => b.disc(-H * 0.055, 0, H * 0.026, INK, 0, 8).disc(H * 0.065, 0, H * 0.026, INK, 0, 8), 0, 0, 0.0007);
    this.head.add(this.eyes);
    this.armBack = part(mat, (b) => b.poly([[-H * 0.04, 0], [H * 0.04, 0], [H * 0.03, -H * 0.27], [-H * 0.03, -H * 0.27]], VD, 0).disc(0, 0, H * 0.03, BRASS, 0.0003, 8), -bodyW * 0.72, H * 0.6, 0.0004);
    this.armFlame = new Group();
    this.armFlame.position.set(bodyW * 0.72, H * 0.6, 0.002);
    this.armFlame.add(part(mat, (b) => b.poly([[-H * 0.04, 0], [H * 0.04, 0], [H * 0.03, -H * 0.28], [-H * 0.03, -H * 0.28]], VD, 0).disc(0, 0, H * 0.03, BRASS, 0.0003, 8)));
    this.flame = new Mesh(new PlaneGeometry(H * 0.62, H * 0.62), new ShaderMaterial({
      transparent: true, depthWrite: false, blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, uniforms: this.flameUni,
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */ `
        varying vec2 vU; uniform float uT, uK;
        void main(){
          vec2 p = vec2((vU.x - .5) * 2., vU.y); p.x += sin(uT * 11. + p.y * 6.) * .1 * p.y;
          float f = (1. - smoothstep(.0, .55 * pow(1. - p.y, .7) * smoothstep(0., .25, p.y), abs(p.x))) * uK;
          float glow = pow(max(1. - length(vU - vec2(.5,.3)) * 1.7, 0.), 2.) * .55 * uK;
          vec3 c = mix(vec3(1.,.42,.06), vec3(1.,.9,.55), f);
          gl_FragColor = vec4(c * (f + glow), f * .95 + glow * .2);
        }`,
    }));
    this.flame.position.set(0, -H * 0.34, 0.002);
    this.flame.rotation.z = -2.3; // stays upright while the arm holds it out
    this.flame.renderOrder = 6;
    this.armFlame.add(this.flame);
    // Flame hand held out and up: he is carrying it for you.
    this.armFlame.rotation.z = 2.3;
    this.root.add(this.legR, this.legL, this.armBack, this.body, this.head, this.armFlame);
  }
  update(w: World, dt: number, viewerX: number, t: number) {
    const walking = w.mode === 'walk';
    if (walking) this.phase += dt * 11;
    const swing = walking ? Math.sin(this.phase) * 0.62 : this.legL.rotation.z * 0.85;
    this.legL.rotation.z = swing;
    this.legR.rotation.z = walking ? -swing : this.legR.rotation.z * 0.85;
    this.armBack.rotation.z = walking ? -swing * 0.5 : w.mode === 'wait' && w.waited > 2.5 ? 2.7 + Math.sin(t * 7) * 0.32 : this.armBack.rotation.z * 0.9; // waves after a while
    const bob = walking ? Math.abs(Math.cos(this.phase)) * H * 0.04 : 0;
    this.dispY += (w.y - this.dispY) * Math.min(1, dt * 26);
    this.hop = w.mode === 'wait' && w.waited < 0.5 ? Math.sin((w.waited / 0.5) * Math.PI) * H * 0.1 : 0;
    this.root.position.set(w.x, this.dispY + bob + this.hop, 0.012);
    const falling = w.mode === 'fall' || w.mode === 'drift';
    const carried = w.mode === 'carried';
    this.root.rotation.z += ((falling ? Math.sin(t * 3) * 0.5 : carried ? Math.sin(t * 5) * 0.12 : 0) - this.root.rotation.z) * Math.min(1, dt * 8);
    // He looks at you when he waits: head turns out of the page toward where you are.
    const lookTarget = w.mode === 'wait' || carried ? 1 : 0;
    this.look += (lookTarget - this.look) * Math.min(1, dt * 7);
    const toViewer = Math.max(-1, Math.min(1, (viewerX - w.x) * 4));
    this.eyes.position.x = H * 0.03 * (1 - this.look) + toViewer * H * 0.03 * this.look;
    this.eyes.position.y = H * 0.035 * this.look;
    this.head.rotation.x = -0.5 * this.look;
    this.head.rotation.z = -0.1 * this.look * toViewer;
    this.blink -= dt;
    if (this.blink < -0.12) this.blink = 1.6 + Math.random() * 2.6;
    this.eyes.scale.y = this.blink < 0 ? 0.12 : 1;
    this.flameUni.uT.value = t;
    this.flameUni.uK.value = w.flame;
    this.root.scale.x = w.dir;
  }
}
