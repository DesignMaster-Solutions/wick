// Film mode: time comes from outside. rAF and Math.random are replaced, so each
// frame of footage is the real game through the real emulator, reproducible frame for frame.
export const installVirtualClock = () => {
  let now = 0;
  let queue: FrameRequestCallback[] = [];
  let handle = 0;
  const handles = new Map<number, FrameRequestCallback>();
  // The renderer host needs real time for itself: only calls coming from the game bundle are virtual.
  const fromGame = () => new Error().stack?.includes('/game/') ?? false;
  const realRaf = globalThis.requestAnimationFrame.bind(globalThis), realCancel = globalThis.cancelAnimationFrame.bind(globalThis);
  globalThis.requestAnimationFrame = (cb) => { if (!fromGame()) return realRaf(cb); queue.push(cb); handles.set(++handle, cb); return -handle; };
  globalThis.cancelAnimationFrame = (h) => { if (h >= 0) { realCancel(h); return; } const cb = handles.get(-h); if (cb) queue = queue.filter((q) => q !== cb); handles.delete(-h); };
  // performance.now is already virtual under the render host: it follows the seek time.
  let seed = 424242;
  Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const frame = () => {
    now += 1000 / 30;
    const run = queue;
    queue = [];
    handles.clear();
    for (const cb of run) cb(now);
  };
  // World setup awaits frames, and film time cannot start before it finishes: tick on a real timer until then.
  const boot = setInterval(frame, 15);
  let base = 0;
  return {
    start() { clearInterval(boot); base = now; },
    /** Advances virtual time to t seconds, one 1/30 s frame at a time. */
    pumpTo(t: number) {
      while ((now - base) / 1000 < t - 1e-6) frame();
    },
    get seconds() { return (now - base) / 1000; },
  };
};
