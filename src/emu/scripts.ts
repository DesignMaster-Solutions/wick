// Deterministic hand scripts for tests and for filming. Times are seconds of emulator clock.
import type { Game } from '../sim/game.ts';
import type { Vec3 } from '../sim/hand.ts';
import { PAGES } from '../sim/pages.ts';

// tip: `at` is where the index fingertip goes (poking), instead of the wrist.
export type HandCue = { pose: string; at: Vec3; a?: number; tip?: boolean };
export type Cue = { from: number; to: number; right?: HandCue | 'bot'; left?: HandCue; head?: number };

const pokeAlbum: HandCue = { pose: 'point', at: [0.09, -0.275, 0.012], a: 1.57, tip: true };
const pokeInk: HandCue = { pose: 'point', at: [-0.09, -0.275, 0.012], a: 1.57, tip: true };
const pinch: HandCue = { pose: 'bird', at: [0.0, -0.1, 0.16], a: 1.2 };
const raised: HandCue = { pose: 'open', at: [0.0, -0.13, 0.16], a: 1.4 };

export const script = (demo: string): Cue[] => {
  const start: Cue[] = [
    { from: 0.5, to: 1.5, right: raised },
    { from: 1.5, to: 2.4, right: pinch },
    { from: 2.4, to: 3.2, right: raised },
  ];
  switch (demo) {
    case 'first30':
    case 'tour':
      return [...start, { from: 3.2, to: 1e9, right: 'bot' }];
    case 'dark':
      return [{ from: 0, to: 1e9 }];
    case 'waiting':
      return [...start, { from: 3.2, to: 1e9 }];
    case 'puppets': // every puppet held in turn, for classifier-through-WebXR proof
      return [
        ...start,
        ...['dog', 'bird', 'rabbit', 'snail', 'crab', 'swan'].map((pose, i): Cue => ({ from: 4 + i * 2, to: 5.9 + i * 2, right: { pose, at: [-0.02, -0.09, 0.18], a: pose === 'rabbit' || pose === 'snail' ? 1.3 : 0.15 } })),
        { from: 16, to: 18, right: { pose: 'open', at: [0.09, -0.1, 0.16], a: 1.57 }, left: { pose: 'open', at: [-0.09, -0.1, 0.16], a: 1.57 } },
      ];
    case 'tabs':
      return [
        ...start,
        { from: 4, to: 8, right: pokeInk },
        { from: 12, to: 16, right: pokeAlbum },
        { from: 16, to: 1e9 },
      ];
    case 'look':
      return [...start, { from: 3.2, to: 5 }, { from: 5, to: 7, head: 1.4 }, { from: 7, to: 1e9 }];
    default:
      return [...start, { from: 3.2, to: 1e9, right: 'bot' }];
  }
};

// The film's one continuous take: every page played by the solver, then album, ink mode, and today's page.
let dailyAt = -1;
export const filmStep = (g: Game, clock: number): HandCue | 'bot' | null => {
  if (clock < 1.2) return null;
  if (clock < 3.2) return { pose: 'open', at: [0.02, -0.14, 0.17], a: 1.4 };
  if (g.phase === 'dark') return { pose: 'bird', at: [0.02, -0.11, 0.17], a: 1.25 };
  if (clock < 4.6) return { pose: 'open', at: [0.02, -0.16, 0.15], a: 1.4 };
  if (g.pageIndex < PAGES.length) return 'bot';
  if (dailyAt < 0) { if (g.phase !== 'play') return null; dailyAt = clock; }
  const t = clock - dailyAt;
  if (t < 2) return null;
  if (t < 3.2) return pokeAlbum;     // open the album
  if (t < 9) return null;            // read it
  if (t < 10.2) return pokeAlbum;    // close it
  if (t < 12) return null;
  if (t < 13.2) return pokeInk;      // high-contrast ink mode
  if (t < 14.5) return null;
  return 'bot';
};
