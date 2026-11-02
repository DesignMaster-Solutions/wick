// Shared paper look. Colours are authored in display space and written straight out:
// no tone mapping, no post, one texture. That is what keeps a Quest at 72 fps.
import { CanvasTexture, Color, DoubleSide, Matrix4, NoColorSpace, RepeatWrapping, ShaderMaterial, Vector3, WebGLRenderTarget, LinearFilter, RGBAFormat, UnsignedByteType } from '@iwsdk/core';
import { SHEET_H, SHEET_W } from '../sim/pages.ts';

/** Procedural washi: long kozo fibres and flecks over warm noise, drawn once at load. */
export const makeWashi = (size = 1024) => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#808080';
  g.fillRect(0, 0, size, size);
  let seed = 12345;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 5200; i++) {
    const v = 128 + (r() - 0.5) * 34 | 0;
    g.fillStyle = `rgba(${v},${v},${v},.22)`;
    g.fillRect(r() * size, r() * size, 2 + r() * 9, 2 + r() * 9);
  }
  g.lineCap = 'round';
  for (let i = 0; i < 620; i++) {
    let x = r() * size, y = r() * size, a = r() * Math.PI * 2;
    const light = r() > 0.42;
    g.strokeStyle = light ? `rgba(255,250,235,${0.1 + r() * 0.26})` : `rgba(60,44,30,${0.05 + r() * 0.16})`;
    g.lineWidth = 0.5 + r() * 1.3;
    g.beginPath();
    g.moveTo(x, y);
    const steps = 6 + (r() * 16 | 0);
    for (let s = 0; s < steps; s++) {
      a += (r() - 0.5) * 0.7;
      x += Math.cos(a) * 12;
      y += Math.sin(a) * 12;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = NoColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = 4;
  return t;
};

export const makeShadowTarget = () => new WebGLRenderTarget(384, 246, { format: RGBAFormat, type: UnsignedByteType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false, stencilBuffer: false });

export type Shared = {
  uLight: { value: Vector3 };
  uFlicker: { value: number };
  uLit: { value: number };
  uInk: { value: number };
  uTime: { value: number };
  uGhost: { value: number };
  uPaperInv: { value: Matrix4 };
  uShadow: { value: unknown };
  uWashi: { value: unknown };
  uSheet: { value: [number, number] };
};

export const makeShared = (shadow: WebGLRenderTarget, washi: CanvasTexture): Shared => ({
  uLight: { value: new Vector3() },
  uFlicker: { value: 1 },
  uLit: { value: 0 },
  uInk: { value: 0 },
  uTime: { value: 0 },
  uGhost: { value: 0 },
  uPaperInv: { value: new Matrix4() },
  uShadow: { value: shadow.texture },
  uWashi: { value: washi },
  uSheet: { value: [SHEET_W, SHEET_H] },
});

const VERT = /* glsl */ `
attribute vec3 color;
uniform mat4 uPaperInv;
varying vec3 vColor; varying vec3 vP; varying vec3 vN;
void main() {
  vColor = color;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vP = (uPaperInv * world).xyz;
  vN = (uPaperInv * modelMatrix * vec4(normal, 0.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const FRAG = /* glsl */ `
uniform vec3 uLight; uniform float uFlicker, uLit, uInk, uTime, uGhost; uniform sampler2D uShadow, uWashi; uniform vec2 uSheet;
varying vec3 vColor; varying vec3 vP; varying vec3 vN;
void main() {
  vec3 toL = uLight - vP;
  float d2 = dot(toL, toL);
  float ndl = abs(dot(normalize(vN), toL)) / sqrt(d2);
  // A candle at the player's chest: bright at the middle of the page, falling away to the corners.
  float pool = 0.30 / (0.22 + d2);
  float lit = mix(0.13, 0.22 + 1.05 * pool * (0.45 + 0.55 * ndl) * uFlicker, uLit);
  float grain = texture2D(uWashi, vP.xy * 2.6).r;
  vec2 uv = vP.xy / uSheet + 0.5;
  vec4 s = texture2D(uShadow, uv);
  float hatch = step(0.5, fract((vP.x + vP.y) * 90.0));
  float ghost = s.g * hatch * uGhost * (0.5 + 0.2 * sin(uTime * 2.5));
  // Shadow lands on the page and ground only; Wick and the props stand in front of it and stay readable.
  float onPage = 1.0 - smoothstep(0.0095, 0.0115, vP.z);
  float dark = max(s.r * 0.9, ghost * 0.85) * onPage;
  vec3 warm = mix(vec3(1.0), vec3(1.06, 0.93, 0.74), uLit);
  vec3 col = vColor * (0.74 + 0.52 * grain) * lit * warm;
  col = mix(col, vec3(0.055, 0.035, 0.03) * lit, dark);
  // High-contrast ink mode: no gradients to read through, pure figure and ground.
  if (uInk > 0.5) {
    float lum = dot(vColor, vec3(0.3, 0.6, 0.1));
    vec3 ink = lum > 0.62 ? vec3(1.0, 0.98, 0.9) : (vColor.r > vColor.g * 1.7 ? vec3(1.0, 0.35, 0.05) : vec3(0.1, 0.13, 0.42));
    col = mix(ink, vec3(0.0), step(0.2, dark));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export const paperMaterial = (shared: Shared) => new ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: shared as never, side: DoubleSide });

export const hex = (h: string) => { const c = new Color(); c.setStyle(h, NoColorSpace); return [c.r, c.g, c.b] as [number, number, number]; };
