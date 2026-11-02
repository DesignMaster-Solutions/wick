// Real hands must appear in FRONT of the virtual paper, but passthrough sits behind all virtual
// content. So each hand draws first as depth + zero alpha: it punches a window to the camera feed.
// In the emulator there is no camera feed, so the same capsules draw as visible skin.
import { CapsuleGeometry, DynamicDrawUsage, InstancedMesh, Matrix4, Quaternion, ShaderMaterial, Vector3 } from '@iwsdk/core';
import { BONES, PALM_LINKS, type Hand } from '../sim/hand.ts';

const LINKS = [...BONES, ...PALM_LINKS];
const m = new Matrix4(), q = new Quaternion(), UP = new Vector3(0, 1, 0), a = new Vector3(), b = new Vector3(), d = new Vector3(), s = new Vector3(), c = new Vector3();

export class HandVis {
  mesh: InstancedMesh;
  constructor(emulated: boolean) {
    const geo = new CapsuleGeometry(1, 1, 3, 8);
    const mat = emulated
      ? new ShaderMaterial({
          vertexShader: `varying vec3 vN; void main(){ vec3 n = mat3(modelMatrix) * mat3(instanceMatrix) * normal; vN = normalize(n); gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position,1.0); }`,
          fragmentShader: `varying vec3 vN; void main(){ float k = 0.5 + 0.5 * dot(vN, normalize(vec3(0.2,-0.5,-0.8))); gl_FragColor = vec4(mix(vec3(0.38,0.22,0.16), vec3(0.98,0.68,0.45), k), 1.0); }`,
        })
      : new ShaderMaterial({ // alpha 0 + a touch of amber: the hand looks lit by the flame
          vertexShader: `void main(){ gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position,1.0); }`,
          fragmentShader: `void main(){ gl_FragColor = vec4(0.07, 0.035, 0.0, 0.07); }`,
          blending: 0,
        });
    this.mesh = new InstancedMesh(geo, mat, LINKS.length * 2);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -50; // before the paper, so the paper fails the depth test behind the hand
    this.mesh.count = 0;
  }
  /** Hands in world coordinates. */
  update(hands: (Hand | null)[]) {
    let n = 0;
    for (const h of hands) {
      if (!h) continue;
      LINKS.forEach(([i, j], k) => {
        a.fromArray(h.p, i * 3);
        b.fromArray(h.p, j * 3);
        d.subVectors(b, a);
        const len = d.length();
        const boost = k >= BONES.length ? 1.45 : 1.05;
        const r = ((h.r[i] + h.r[j]) / 2) * boost;
        q.setFromUnitVectors(UP, len > 1e-5 ? d.normalize() : UP);
        c.addVectors(a, b).multiplyScalar(0.5);
        // Unit capsule is 3 tall (radius 1 + length 1): caps squash slightly, nobody sees a knuckle that closely.
        m.compose(c, q, s.set(r, (len + 2 * r) / 3, r));
        this.mesh.setMatrixAt(n++, m);
      });
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
