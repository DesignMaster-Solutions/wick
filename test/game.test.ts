import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, TURN_TIME } from '../src/sim/game.ts';
import { JointFilter } from '../src/sim/filter.ts';
import { poseHand, type Quat } from '../src/sim/hand.ts';
import { PAGES } from '../src/sim/pages.ts';
import { Bot } from '../src/sim/bot.ts';

const I: Quat = [0, 0, 0, 1];
const memory = (seed?: string) => { const m = new Map<string, string>(seed ? [['wick.v1', seed]] : []); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }; };
const DT = 1 / 30;

test('a pinch lights the flame; nothing moves in the dark', () => {
  const g = new Game(null);
  const x = g.world.x;
  g.step([null, poseHand('open', [0, 0, 0.2], I)], DT);
  assert.equal(g.phase, 'dark');
  assert.equal(g.world.x, x);
  for (let i = 0; i < 4; i++) g.step([null, poseHand('bird', [0, 0, 0.2], I)], DT);
  assert.equal(g.phase, 'play');
  assert.deepEqual(g.events.map((e) => e.t), ['lit']);
});

test('finishing a page saves progress, turns, and resumes after a reload', () => {
  const store = memory();
  const g = new Game(store);
  g.phase = 'play';
  const bot = new Bot();
  let h = null;
  while (g.phase === 'play' && g.time < 120) { g.step([null, h], DT); h = bot.update(g.world, DT); }
  assert.equal(g.phase, 'turn');
  for (let i = 0; i < (TURN_TIME + 0.1) / DT; i++) g.step([null, null], DT);
  assert.equal(g.phase, 'play');
  assert.equal(g.world.page.id, PAGES[1].id);
  const again = new Game(store);
  assert.equal(again.pageIndex, 1);
});

test('puppets enter the album once and survive reload', () => {
  const store = memory();
  const g = new Game(store);
  g.phase = 'play';
  for (let i = 0; i < 30; i++) g.step([null, poseHand('rabbit', [0, 0, 0.2], I)], DT);
  assert.deepEqual(g.save.album, ['rabbit']);
  assert.equal(g.events.filter((e) => e.t === 'album-new').length, 1);
  assert.deepEqual(new Game(store).save.album, ['rabbit']);
});

test('a corrupt or hostile save cannot break the game', () => {
  for (const bad of ['{oops', '{"page":-3,"album":["__proto__",7],"ink":"yes"}', '{"page":99999}']) {
    const g = new Game(memory(bad));
    assert.ok(g.pageIndex >= 0 && g.pageIndex <= PAGES.length);
    assert.deepEqual(g.save.album, []);
    assert.equal(g.save.ink, false);
  }
});

test('after the last page the game is "today" and is seeded by the date', () => {
  const g = new Game(memory(JSON.stringify({ page: PAGES.length })), new Date(Date.UTC(2026, 10, 18)));
  assert.equal(g.isDaily, true);
  assert.equal(g.world.page.id, 'day-20261118');
});

test("finishing today's page ends on the album and survives a replay", () => {
  const g = new Game(memory(JSON.stringify({ page: PAGES.length })), new Date(Date.UTC(2026, 10, 18)));
  g.phase = 'play';
  const bot = new Bot();
  let h = null;
  while (g.phase === 'play' && g.time < 200) { g.step([null, h], DT); h = bot.update(g.world, DT); }
  assert.equal(g.phase, 'turn');
  assert.equal(g.save.lastDay, 20261118);
  for (let i = 0; i < (TURN_TIME + 0.1) / DT; i++) g.step([null, null], DT);
  assert.equal(g.phase, 'album');
  g.toggleAlbum();
  assert.equal(g.phase, 'play');
  assert.equal(g.world.done, false);
});

test('filter calms tremor and keeps up with a real move', () => {
  const f = new JointFilter();
  const raw = new Float32Array(75);
  let peak = 0;
  for (let i = 0; i < 120; i++) {
    raw[0] = Math.sin(i * 1.2) * 0.004; // about 11 Hz tremor, 4 mm
    if (i > 60) peak = Math.max(peak, Math.abs(f.apply(raw, 1 / 72)[0]));
    else f.apply(raw, 1 / 72);
  }
  assert.ok(peak < 0.0032, `tremor passed at ${peak}`);
  const g = new JointFilter();
  raw[0] = 0;
  g.apply(raw, 1 / 72);
  raw[0] = 0.2;
  let v = 0;
  for (let i = 0; i < 5; i++) v = g.apply(raw, 1 / 72)[0];
  assert.ok(v > 0.15, `lagged at ${v}`);
});
