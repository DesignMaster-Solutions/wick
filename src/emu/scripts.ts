// Deterministic hand scripts for tests and for filming. Times are seconds of emulator clock.
import type { Vec3 } from '../sim/hand.ts';

export type HandCue = { pose: string; at: Vec3; a?: number };
export type Cue = { from: number; to: number; right?: HandCue | 'bot'; left?: HandCue; head?: number };

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
        { from: 3.5, to: 4.5, right: { pose: 'flat', at: [-0.09, -0.34, 0.01], a: 1.57 } },
        { from: 6, to: 7, right: { pose: 'flat', at: [0.09, -0.34, 0.01], a: 1.57 } },
      ];
    case 'look':
      return [...start, { from: 3.2, to: 5 }, { from: 5, to: 7, head: 1.4 }, { from: 7, to: 1e9 }];
    default:
      return [...start, { from: 3.2, to: 1e9, right: 'bot' }];
  }
};
