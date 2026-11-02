// One Euro filter over all joints: calm when still, responsive when moving.
// `steady` lowers the cutoff further for players with tremor.
export class JointFilter {
  x: Float32Array | null = null;
  dx = new Float32Array(75);
  minCutoff = 2.2;
  beta = 18;
  apply(raw: Float32Array, dt: number) {
    if (!this.x) { this.x = raw.slice(); return this.x; }
    const a = (c: number) => { const r = 2 * Math.PI * c * dt; return r / (r + 1); };
    const ad = a(1);
    for (let i = 0; i < 75; i++) {
      this.dx[i] += ad * ((raw[i] - this.x[i]) / dt - this.dx[i]);
      this.x[i] += a(this.minCutoff + this.beta * Math.abs(this.dx[i])) * (raw[i] - this.x[i]);
    }
    return this.x;
  }
  reset() { this.x = null; this.dx.fill(0); }
  steady(on: boolean) { this.minCutoff = on ? 0.7 : 2.2; this.beta = on ? 6 : 18; }
}
