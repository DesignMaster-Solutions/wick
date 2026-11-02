import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, features, isButterfly, isPinching } from '../src/sim/classify.ts';
import { poseHand, POSE_NAMES, newHand, type Quat } from '../src/sim/hand.ts';

const I: Quat = [0, 0, 0, 1];
const EXPECT: Record<string, string | null> = {
  open: null, flat: null, fist: null, three: null,
  dog: 'dog', rabbit: 'rabbit', snail: 'snail', bird: 'bird', crab: 'crab', swan: 'swan',
};

test('table of features (debug)', { skip: !process.env.WICK_DEBUG }, () => {
  for (const n of POSE_NAMES) {
    const f = features(poseHand(n, [0, 0, 0], I));
    console.log(n.padEnd(7), f.ext.map((x) => x.toFixed(2)).join(' '), 'ti', f.thumbIndex.toFixed(2), 'spread', f.tipsSpread.toFixed(2), 'out', f.thumbOut.toFixed(2), '=>', classify(poseHand(n, [0, 0, 0], I)));
  }
});

for (const [name, want] of Object.entries(EXPECT)) {
  test(`pose ${name} classifies as ${want}`, () => {
    assert.equal(classify(poseHand(name, [0.1, -0.2, 0.3], [0.2, 0.4, 0.1, 0.885]), ), want);
    assert.equal(classify(poseHand(name, [0, 0, 0], I, -1)), want, 'left hand');
  });
}

// Tracking jitter: Quest joints wobble by a few millimetres. Seeded so failures reproduce.
test('classifier survives 2 mm joint jitter on 90% of samples', () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
  for (const [name, want] of Object.entries(EXPECT)) {
    if (!want) continue;
    let ok = 0;
    for (let k = 0; k < 200; k++) {
      const h = poseHand(name, [0, 0, 0], I);
      for (let i = 0; i < 75; i++) h.p[i] += rand() * 0.002;
      if (classify(h) === want) ok++;
    }
    assert.ok(ok >= 180, `${name}: ${ok}/200`);
  }
});

test('hand scale does not change the answer', () => {
  for (const [name, want] of Object.entries(EXPECT)) {
    const h = poseHand(name, [0, 0, 0], I);
    const small = newHand();
    small.p.set(h.p.map((v) => v * 0.82));
    assert.equal(classify(small), want, name);
  }
});

test('pinch and butterfly', () => {
  assert.equal(isPinching(poseHand('open', [0, 0, 0], I)), false);
  assert.equal(isPinching(poseHand('bird', [0, 0, 0], I)), true);
  const a = poseHand('open', [0, 0, 0], I);
  const b = poseHand('open', [0, 0, 0], I, -1);
  // Thumbs touching: shift the left hand so both thumb tips meet.
  for (let i = 0; i < 25; i++) for (let c = 0; c < 3; c++) b.p[i * 3 + c] += a.p[12 + c] - poseHand('open', [0, 0, 0], I, -1).p[12 + c];
  assert.equal(isButterfly(a, b), true);
  for (let i = 0; i < 75; i += 3) b.p[i] += 0.2;
  assert.equal(isButterfly(a, b), false);
});
