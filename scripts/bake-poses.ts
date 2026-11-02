// Bakes joint positions (wrist frame, right hand) so the game can draw ghost hints
// and tests can classify realistic skeletons without shipping iwer in production.
import { writeFileSync } from 'node:fs';
import { mat4, vec3 } from 'gl-matrix';
import { POSE_ANGLES } from '../src/sim/pose-angles.ts';
// @ts-expect-error deep import: iwer does not export its pose builder from the root
import { libraryHandPoses } from '../node_modules/iwer/lib/device/configs/hand/library.js';
// @ts-expect-error same as above
import { buildHandPose } from '../node_modules/iwer/lib/device/configs/hand/builder.js';
// @ts-expect-error same as above
import { relaxedHandPose } from '../node_modules/iwer/lib/device/configs/hand/relaxed.js';
// @ts-expect-error same as above
import { pinchHandPose } from '../node_modules/iwer/lib/device/configs/hand/pinch.js';

const out: Record<string, { p: number[]; r: number[] }> = {};
for (const [name, def] of Object.entries(POSE_ANGLES)) {
  const pose = def.ref ? libraryHandPoses[def.ref] : buildHandPose(def.angles, relaxedHandPose, pinchHandPose);
  const joints = pose.jointTransforms;
  const inv = mat4.invert(mat4.create(), joints.wrist.offsetMatrix)!;
  const p: number[] = [];
  const r: number[] = [];
  for (const key of Object.keys(joints)) {
    const v = vec3.fromValues(joints[key].offsetMatrix[12], joints[key].offsetMatrix[13], joints[key].offsetMatrix[14]);
    vec3.transformMat4(v, v, inv);
    // iwer poses are left-handed; mirror X to bake the right hand.
    p.push(+(-v[0]).toFixed(5), +v[1].toFixed(5), +v[2].toFixed(5));
    r.push(+joints[key].radius.toFixed(5));
  }
  out[name] = { p, r };
}
writeFileSync('src/sim/poses-baked.json', JSON.stringify(out));
console.log('baked', Object.keys(out).join(' '));
