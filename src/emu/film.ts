// Film mode: time comes from outside. rAF, performance.now and Math.random are replaced, so each
// frame of footage is the real game through the real emulator, reproducible frame for frame.
export const installVirtualClock = () => {
  let now = 0;
  let queue: FrameRequestCallback[] = [];
  let handle = 0;
  const handles = new Map<number, FrameRequestCallback>();
  globalThis.requestAnimationFrame = (cb) => { queue.push(cb); handles.set(++handle, cb); return handle; };
  globalThis.cancelAnimationFrame = (h) => { const cb = handles.get(h); if (cb) queue = queue.filter((q) => q !== cb); handles.delete(h); };
  performance.now = () => now;
  let seed = 424242;
  Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return {
    /** Advances virtual time to t seconds, one 1/30 s frame at a time. */
    pumpTo(t: number) {
      while (now / 1000 < t - 1e-6) {
        now += 1000 / 30;
        const run = queue;
        queue = [];
        handles.clear();
        for (const cb of run) cb(now);
      }
    },
    get seconds() { return now / 1000; },
  };
};
