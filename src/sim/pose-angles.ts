// Joint angles (iwer builder convention, degrees) for the poses Wick cares about.
// `ref` borrows a pose from iwer's captured/tuned library; the rest are ours.
const thumbOut = { cmc: [-72, 3, -48], mcp: 5, ip: 2 };
const straight = (yaw: number) => ({ mcp: 2, pip: 6, dip: 5, yaw });

export const POSE_ANGLES: Record<string, { ref?: string; angles?: object }> = {
  open: { ref: 'open' },
  flat: { ref: 'flat' },
  fist: { ref: 'fist' },
  three: { ref: 'three' },
  dog: {
    angles: {
      thumb: thumbOut,
      index: straight(-2),
      middle: straight(2),
      ring: straight(6),
      pinky: { mcp: 70, pip: 60, dip: 30, yaw: 10 },
    },
  },
  rabbit: { ref: 'peace' },
  snail: { ref: 'rock' },
  bird: { ref: 'ok' },
  crab: { ref: 'claw' },
  swan: {
    angles: {
      thumb: { cmc: [-10, -52, -112], shift: 1, mcp: 14, ip: 22 },
      index: { mcp: 52, pip: 44, dip: 26, yaw: 2 },
      middle: { mcp: 52, pip: 52, dip: 30, yaw: 0 },
      ring: { mcp: 50, pip: 62, dip: 34, yaw: -4 },
      pinky: { mcp: 46, pip: 72, dip: 38, yaw: -10 },
    },
  },
};
