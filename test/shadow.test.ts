import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addRawCapsule, capsuleSpan, magnification, newShadowSet, projectPoint, shadowGround, shadowOverlaps, MAX_SOLID_MAG, STRIDE, addHandShadow } from '../src/sim/shadow.ts';
import { poseHand, type Vec3 } from '../src/sim/hand.ts';

const L: Vec3 = [0, 0, 0.5];
const near = (a: number, b: number, e = 1e-4) => assert.ok(Math.abs(a - b) < e, `${a} !≈ ${b}`);

test('a point on the paper casts onto itself', () => {
  const p = projectPoint(L, 0.1, 0.2, 0)!;
  near(p[0], 0.1); near(p[1], 0.2); near(p[2], 1);
});

test('halfway to the flame doubles the shadow', () => {
  const p = projectPoint(L, 0.1, -0.05, 0.25)!;
  near(p[0], 0.2); near(p[1], -0.1); near(p[2], 2);
});

test('the projected point is on the ray from light through the joint', () => {
  const l: Vec3 = [0.03, -0.08, 0.46];
  const j = [0.12, 0.02, 0.17];
  const [x, y] = projectPoint(l, j[0], j[1], j[2])!;
  const k = (0 - l[2]) / (j[2] - l[2]);
  near(x, l[0] + (j[0] - l[0]) * k); near(y, l[1] + (j[1] - l[1]) * k);
});

test('closer to the flame = bigger, at the flame = no shadow, past the paper = contact shadow', () => {
  assert.ok(magnification(0.5, 0.4) > magnification(0.5, 0.1));
  assert.equal(magnification(0.5, 0.49), -1);
  assert.equal(projectPoint(L, 0, 0, 0.6), null);
  assert.equal(magnification(0.5, -0.1), 1);
});

test('capsule span: horizontal, vertical, diagonal and miss', () => {
  const s = newShadowSet();
  addRawCapsule(s, -0.1, 0, 0.1, 0, 0.02);
  const h = capsuleSpan(s.d, 0, 0)!;
  near(h[0], -0.02); near(h[1], 0.02);
  const end = capsuleSpan(s.d, 0, 0.115)!;
  near(end[1], Math.sqrt(0.02 ** 2 - 0.015 ** 2));
  assert.equal(capsuleSpan(s.d, 0, 0.13), null);
  addRawCapsule(s, 0, -0.1, 0, 0.1, 0.02);
  const v = capsuleSpan(s.d, STRIDE, 0)!;
  near(v[0], -0.12); near(v[1], 0.12);
  addRawCapsule(s, -0.1, -0.1, 0.1, 0.1, 0.01);
  const d = capsuleSpan(s.d, STRIDE * 2, 0)!;
  near(d[1], 0.01 * Math.SQRT2); near(d[0], -0.01 * Math.SQRT2);
});

test('ground ignores tops he cannot step up to and diffuse shadow', () => {
  const s = newShadowSet();
  addRawCapsule(s, -0.1, 0, 0.1, 0, 0.01);
  near(shadowGround(s, 0, 0.005, 0.02)!, 0.01);
  assert.equal(shadowGround(s, 0, -0.1, 0.02), null, 'too high to step');
  assert.ok(shadowOverlaps(s, 0, -0.1, 0.1));
  s.d[6] = MAX_SOLID_MAG + 1;
  assert.equal(shadowGround(s, 0, 0.005, 0.02), null, 'too diffuse to stand on');
  assert.ok(!shadowOverlaps(s, 0, -0.1, 0.1));
});

test('moving a hand toward the flame scales its shadow by the projection ratio', () => {
  const l: Vec3 = [0, 0, 0.46];
  const width = (z: number) => {
    const s = newShadowSet();
    addHandShadow(s, poseHand('flat', [0, 0, z], [0, 0, 0, 1]), l);
    let a = 9, b = -9;
    for (let i = 0; i < s.n; i++) { a = Math.min(a, s.d[i * STRIDE + 1]); b = Math.max(b, s.d[i * STRIDE + 1]); }
    return b - a;
  };
  assert.ok(width(0.3) > width(0.1) * 1.6);
});
