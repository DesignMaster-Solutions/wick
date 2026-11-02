// "A green test only counts if you saw it red." Breaks the core logic one mutant at a time;
// every mutant must make the suite fail. Run: node scripts/mutation-check.mjs
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const MUTANTS = [
  ['src/sim/shadow.ts', 'lz / (lz - pz)', 'lz / (lz + pz)', 'projection ratio'],
  ['src/sim/shadow.ts', 'pz >= lz - 0.02 ? -1', 'pz >= lz + 9 ? -1', 'no shadow behind the flame'],
  ['src/sim/shadow.ts', 'span[1] <= y + stepUp &&', 'true &&', 'step-up limit on shadow'],
  ['src/sim/shadow.ts', 'if (s.d[o + 6] > MAX_SOLID_MAG) continue;\n    const span = capsuleSpan(s.d, o, x);\n    if (span && span[1] <= y', 'const span = capsuleSpan(s.d, o, x);\n    if (span && span[1] <= y', 'diffuse shadow is not solid'],
  ['src/sim/classify.ts', "if (up(i) && up(m) && down(r) && down(p)) return 'rabbit';", '', 'rabbit pose'],
  ['src/sim/classify.ts', 't > STRAIGHT && f.thumbOut > 0.8', 'true', 'dog vs three'],
  ['src/sim/classify.ts', '< 0.022', '< 0.2', 'pinch distance'],
  ['src/sim/world.ts', "g === null || g < w.y - STEP_DOWN ? 'gap' : null", 'null', 'he stops at the gap'],
  ['src/sim/world.ts', 'near < BARK_REACH', 'near < 0', 'the dog scares the crow'],
  ['src/sim/world.ts', "s.awake === 'crab' && o.kind === 'gate' && o.by === 'crab'", 'false', 'the crab cuts the rope'],
  ['src/sim/pages.ts', 'seed * 31 + 7', '7', 'daily page depends on the date'],
  ['src/sim/game.ts', 'else this.save.page++;', '', 'page progress is saved'],
  ['src/sim/game.ts', 's.album.filter((p: Puppet) => PUPPETS.includes(p))', 's.album', 'save file is validated'],
  ['src/sim/filter.ts', 'this.beta * Math.abs(this.dx[i])', '0', 'filter follows real motion'],
];
let survived = 0;
for (const [file, from, to, name] of MUTANTS) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes(from)) { console.log(`STALE    ${name}`); survived++; continue; }
  writeFileSync(file, src.replace(from, to));
  let killed = false;
  try { execSync('npm test --silent', { stdio: 'pipe', timeout: 240000 }); } catch { killed = true; }
  writeFileSync(file, src);
  console.log(`${killed ? 'red ok  ' : 'SURVIVED'} ${name}`);
  if (!killed) survived++;
}
console.log(survived ? `${survived} mutant(s) not caught` : `all ${MUTANTS.length} mutants caught`);
process.exit(survived ? 1 : 0);
