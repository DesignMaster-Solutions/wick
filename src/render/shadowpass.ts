// Draws the projected capsules into a small texture: one instanced draw, soft edge from the penumbra.
// The same numbers collide with Wick on the CPU, so the picture cannot disagree with the game.
import { CustomBlending, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, BufferAttribute, Mesh, OrthographicCamera, Scene, ShaderMaterial, MaxEquation, OneFactor, type WebGLRenderer, type WebGLRenderTarget } from '@iwsdk/core';
import { SHEET_H, SHEET_W } from '../sim/pages.ts';
import { STRIDE, type ShadowSet } from '../sim/shadow.ts';

const CAP = 420; // real shadow + ghost hint, or the whole album page

export class ShadowPass {
  scene = new Scene();
  camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  ab = new InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(DynamicDrawUsage);
  rp = new InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(DynamicDrawUsage);
  geo = new InstancedBufferGeometry();
  count = 0;
  constructor() {
    const g = this.geo;
    g.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.setAttribute('aAB', this.ab);
    g.setAttribute('aRP', this.rp);
    const m = new Mesh(g, new ShaderMaterial({
      depthTest: false, depthWrite: false, transparent: true,
      blending: CustomBlending, blendEquation: MaxEquation, blendSrc: OneFactor, blendDst: OneFactor,
      uniforms: { uHalf: { value: [SHEET_W / 2, SHEET_H / 2] } },
      vertexShader: /* glsl */ `
        attribute vec4 aAB; attribute vec4 aRP; uniform vec2 uHalf;
        varying vec2 vP; varying vec4 vAB; varying vec4 vRP;
        void main() {
          vec2 a = aAB.xy, b = aAB.zw; vec2 d = b - a; float len = length(d);
          vec2 u = len > 1e-5 ? d / len : vec2(1.0, 0.0); vec2 n = vec2(-u.y, u.x);
          float e = aRP.x + aRP.y;
          vec2 p = (a + b) * 0.5 + u * position.x * (len * 0.5 + e) + n * position.y * e;
          vP = p; vAB = aAB; vRP = aRP;
          gl_Position = vec4(p / uHalf, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vP; varying vec4 vAB; varying vec4 vRP;
        void main() {
          vec2 pa = vP - vAB.xy, ba = vAB.zw - vAB.xy;
          float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
          float d = length(pa - ba * h) - vRP.x;
          float a = 1.0 - smoothstep(-vRP.y, vRP.y, d);
          a *= vRP.z; // far from the paper the shadow thins out
          gl_FragColor = vRP.w > 0.5 ? vec4(0.0, a, 0.0, 1.0) : vec4(a, 0.0, 0.0, 1.0);
        }`,
    }));
    m.frustumCulled = false;
    this.scene.add(m);
  }
  write(s: ShadowSet, ghost: number) {
    for (let i = 0; i < s.n && this.count < CAP; i++) {
      const o = i * STRIDE, c = this.count++;
      this.ab.setXYZW(c, s.d[o], s.d[o + 1], s.d[o + 2], s.d[o + 3]);
      const strength = Math.max(0.42, 1 - (s.d[o + 6] - 1) * 0.16);
      this.rp.setXYZW(c, s.d[o + 4], Math.max(s.d[o + 5], 0.0012), strength, ghost);
    }
  }
  render(r: WebGLRenderer, target: WebGLRenderTarget) {
    this.geo.instanceCount = this.count;
    this.ab.needsUpdate = this.rp.needsUpdate = true;
    const xr = r.xr.enabled, prev = r.getRenderTarget(), auto = r.autoClear;
    const clear = r.getClearAlpha();
    r.xr.enabled = false;
    r.setRenderTarget(target);
    r.setClearAlpha(0);
    r.autoClear = true;
    r.render(this.scene, this.camera);
    r.setRenderTarget(prev);
    r.xr.enabled = xr;
    r.autoClear = auto;
    r.setClearAlpha(clear);
    this.count = 0;
  }
}
