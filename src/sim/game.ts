// The session around a page: light the flame, turn pages, keep the album. No DOM, no three.
import { isPinching, PUPPETS, type Puppet } from './classify.ts';
import type { Hand, Vec3 } from './hand.ts';
import { dailyPage, dateSeed, PAGES } from './pages.ts';
import { newWorld, stepWorld, type GameEvent, type World } from './world.ts';

export const LIGHT: Vec3 = [0, -0.08, 0.46];
export const TURN_TIME = 2.4;
const SAVE_KEY = 'wick.v1';

export type Phase = 'dark' | 'play' | 'turn' | 'album';
export type Save = { page: number; album: Puppet[]; ink: boolean; steady: boolean; lastDay: number; litPages: number };
export type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void };

export const pageFor = (i: number, day: number) => (i < PAGES.length ? PAGES[i] : dailyPage(day));

export class Game {
  phase: Phase = 'dark';
  save: Save;
  world: World;
  turnT = 0;
  time = 0;
  litAt = -1;
  store: Store | null;
  day: number;
  pinchHeld = 0;
  events: GameEvent[] = [];
  looking = true; // FoV-aware: if you look away, he sits and waits for you

  constructor(store: Store | null, today = new Date(), startPage?: number) {
    this.store = store;
    this.day = dateSeed(today);
    this.save = { page: 0, album: [], ink: false, steady: false, lastDay: 0, litPages: 0 };
    try {
      const raw = store?.getItem(SAVE_KEY);
      // Saved data is untrusted: keep only known fields of the right shape.
      if (raw) {
        const s = JSON.parse(raw);
        if (Number.isInteger(s.page) && s.page >= 0) this.save.page = Math.min(s.page, PAGES.length);
        if (Array.isArray(s.album)) this.save.album = s.album.filter((p: Puppet) => PUPPETS.includes(p));
        this.save.ink = s.ink === true;
        this.save.steady = s.steady === true;
        if (Number.isInteger(s.lastDay)) this.save.lastDay = s.lastDay;
        if (Number.isInteger(s.litPages) && s.litPages >= 0) this.save.litPages = s.litPages;
      }
    } catch { /* a corrupt save never blocks play */ }
    if (startPage !== undefined) this.save.page = startPage;
    this.world = newWorld(pageFor(this.save.page, this.day), LIGHT);
  }

  persist() {
    try { this.store?.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch { /* private mode: play without saving */ }
  }

  get pageIndex() { return this.save.page; }
  get isDaily() { return this.save.page >= PAGES.length; }

  toggleAlbum() { this.phase = this.phase === 'album' ? 'play' : this.phase === 'play' ? 'album' : this.phase; }

  step(hands: [Hand | null, Hand | null], dt: number) {
    this.time += dt;
    if (this.phase === 'dark') {
      this.pinchHeld = hands.some((h) => h && isPinching(h)) ? this.pinchHeld + dt : 0;
      stepWorld({ ...this.world, paused: true } as World, [null, null], dt);
      if (this.pinchHeld > 0.08) {
        this.phase = 'play';
        this.litAt = this.time;
        this.events.push({ t: 'lit', x: 0, y: 0 });
      }
      return;
    }
    if (this.phase === 'turn') {
      this.turnT += dt;
      if (this.turnT >= TURN_TIME) {
        this.world = newWorld(pageFor(this.save.page, this.day), LIGHT);
        // Today's page is done: end on the album, not on a loop. Poking the album tab plays it again.
        this.phase = this.isDaily && this.save.lastDay === this.day ? 'album' : 'play';
        this.events.push({ t: 'page-open', x: 0, y: 0 });
      }
      return;
    }
    const w = this.world;
    w.paused = this.phase === 'album' || !this.looking;
    stepWorld(w, hands, dt);
    for (const e of w.events) {
      this.events.push(e);
      if (e.t === 'awake' && e.who && !this.save.album.includes(e.who as Puppet)) {
        this.save.album.push(e.who as Puppet);
        this.events.push({ t: 'album-new', x: e.x, y: e.y, who: e.who });
        this.persist();
      }
    }
    w.events.length = 0;
    if (w.done && this.phase === 'play') {
      this.phase = 'turn';
      this.turnT = 0;
      if (this.isDaily) this.save.lastDay = this.day;
      else this.save.page++;
      this.save.litPages++;
      this.events.push({ t: 'page-turn', x: 0, y: 0 });
      this.persist();
    }
  }
}
