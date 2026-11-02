// The candle at the player's chest, plus the dim of the room as it catches.
import { BackSide, CustomBlending, Group, Mesh, OneFactor, OneMinusSrcAlphaFactor, PlaneGeometry, ShaderMaterial, SphereGeometry, type Object3D } from '@iwsdk/core';

const premul = { transparent: true, depthWrite: false, blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor } as const;

export class Flame {
  group = new Group();
  core: Mesh;
  halo: Mesh;
  uni = { uT: { value: 0 }, uK: { value: 0 } };
  constructor() {
    this.core = new Mesh(new PlaneGeometry(0.06, 0.1), new ShaderMaterial({
      ...premul, uniforms: this.uni,
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */ `
        varying vec2 vU; uniform float uT, uK;
        void main() {
          vec2 p = vec2((vU.x - 0.5) * 2.0, vU.y);
          float sway = sin(uT * 7.0 + p.y * 5.0) * 0.07 * p.y + sin(uT * 13.0 + p.y * 9.0) * 0.035 * p.y;
          p.x += sway;
          float w = 0.8 * pow(1.0 - p.y, 0.8) * smoothstep(0.0, 0.2, p.y + 0.02) * (1.0 + 0.5 * sin(p.y * 2.4));
          float f = 1.0 - smoothstep(w * 0.2, w, abs(p.x));
          f *= uK;
          vec3 c = mix(vec3(1.0, 0.33, 0.05), vec3(1.0, 0.86, 0.48), smoothstep(0.1, 0.9, f));
          c = mix(c, vec3(0.28, 0.42, 1.0), (1.0 - smoothstep(0.0, 0.16, p.y)) * 0.75);
          gl_FragColor = vec4(c * f, f * 0.85);
        }`,
    }));
    this.halo = new Mesh(new PlaneGeometry(0.5, 0.5), new ShaderMaterial({
      ...premul, uniforms: this.uni,
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */ `
        varying vec2 vU; uniform float uK;
        void main() {
          float r = length(vU - 0.5) * 2.0;
          float g = pow(max(1.0 - r, 0.0), 2.6) * 0.34 * uK;
          gl_FragColor = vec4(vec3(1.0, 0.56, 0.2) * g, g * 0.12);
        }`,
    }));
    this.halo.renderOrder = 8;
    this.core.renderOrder = 9;
    this.group.add(this.halo, this.core);
  }
  update(t: number, k: number, head: Object3D) {
    this.uni.uT.value = t;
    this.uni.uK.value = k;
    this.group.quaternion.copy(head.quaternion);
  }
}

/** A dark warm shell around the player: passthrough dims as if the lights went down. */
export const makeRoomDim = () => {
  const uni = { uDim: { value: 0 } };
  const m = new Mesh(new SphereGeometry(3.2, 16, 12), new ShaderMaterial({
    transparent: true, depthWrite: false, side: BackSide, uniforms: uni,
    vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uDim; void main(){ gl_FragColor = vec4(0.045, 0.024, 0.012, uDim); }',
  }));
  m.frustumCulled = false;
  m.renderOrder = 1;
  return { mesh: m, uni };
};
