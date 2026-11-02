import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot, type BotOptions } from '../src/sim/bot.ts';
import { dailyPage, PAGES, RIGHT, type Page } from '../src/sim/pages.ts';
import { newWorld, stepWorld } from '../src/sim/world.ts';
import type { Vec3 } from '../src/sim/hand.ts';

const LIGHT: Vec3 = [0, -0.08, 0.46];
const DT = 1 / 30;

export const play = (page: Page, opt: BotOptions = {}, limit = 180) => {
  const w = newWorld(page, LIGHT);
  const bot = new Bot(opt);
  const seen: string[] = [];
  let h = null;
  while (!w.done && w.time < limit) {
    stepWorld(w, opt.handed === -1 ? [h, null] : [null, h], DT);
    h = bot.update(w, DT);
    for (const e of w.events) seen.push(e.who ? `${e.t}:${e.who}` : e.t);
    w.events.length = 0;
  }
  return { w, seen };
};

for (const page of PAGES) {
  test(`page ${page.id}: right hand finishes it without him ever falling`, () => {
    const { w, seen } = play(page);
    assert.ok(w.done, `stuck at x=${w.x.toFixed(3)} mode=${w.mode} why=${w.why} t=${w.time.toFixed(0)}\n${seen.join(' ')}`);
    assert.ok(!seen.includes('fell'), seen.join(' '));
  });
  test(`page ${page.id}: left hand alone finishes it too`, () => {
    const { w, seen } = play(page, { handed: -1 });
    assert.ok(w.done, `stuck x=${w.x.toFixed(3)} why=${w.why} ${seen.join(' ')}`);
  });
  if (page.obstacles.length) {
    test(`page ${page.id}: without hands he waits, safely, forever`, () => {
      const w = newWorld(page, LIGHT);
      for (let i = 0; i < 30 * 60; i++) stepWorld(w, [null, null], DT);
      assert.equal(w.done, false);
      assert.equal(w.mode, 'wait');
      assert.ok(w.x < RIGHT);
      assert.ok(!w.events.some((e) => e.t === 'fell'));
    });
  }
}

test('first page: payoff arrives before 30 s of play', () => {
  const { w } = play(PAGES[0]);
  assert.ok(w.time < 30, `took ${w.time}`);
});

test('every page takes 10 to 120 s for a patient player', () => {
  for (const p of PAGES) {
    const { w } = play(p);
    assert.ok(w.time > 8 && w.time < 120, `${p.id}: ${w.time}`);
  }
});

test('each story puppet is what opens its page', () => {
  assert.ok(play(PAGES[4]).seen.includes('awake:dog'));
  assert.ok(play(PAGES[5]).seen.includes('awake:bird'));
  assert.ok(play(PAGES[6]).seen.includes('awake:rabbit'));
  const pond = play(PAGES[7]).seen;
  assert.ok(pond.includes('awake:swan'));
  assert.ok(pond.includes('awake:crab'));
});

test('a year of daily pages is deterministic and solvable', () => {
  assert.deepEqual(dailyPage(20261102), dailyPage(20261102));
  const week = new Set([...Array(28).keys()].map((d) => JSON.stringify(dailyPage(20261201 + d).obstacles)));
  assert.ok(week.size >= 20, `only ${week.size} distinct pages in 28 days`);
  const start = Date.UTC(2026, 10, 18);
  const bad: string[] = [];
  for (let d = 0; d < 365; d++) {
    const dt = new Date(start + d * 864e5);
    const seed = dt.getUTCFullYear() * 10000 + (dt.getUTCMonth() + 1) * 100 + dt.getUTCDate();
    const { w } = play(dailyPage(seed));
    if (!w.done) bad.push(`${seed}@${w.x.toFixed(2)}/${w.why}`);
  }
  assert.equal(bad.length, 0, bad.slice(0, 12).join(' '));
});
