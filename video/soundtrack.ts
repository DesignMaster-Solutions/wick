// Renders the film's audio offline with the game's own synth (src/audio.ts) from the recorded event list.
// node --experimental-strip-types video/soundtrack.ts out/events.jsonl out/soundtrack.wav <seconds>
import { readFileSync, writeFileSync } from 'node:fs';
import { OfflineAudioContext } from 'node-web-audio-api';
import { Sound } from '../src/audio.ts';

const [, , eventsFile, outFile, secs] = process.argv;
const seconds = Number(secs);
const SR = 48000;
const events = readFileSync(eventsFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).sort((a, b) => a.at - b.at);
const ctx = new OfflineAudioContext(2, SR * seconds, SR) as unknown as BaseAudioContext;
const s = new Sound();
s.attach(ctx);
let seed = 99;
Math.random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const lit = events.find((e) => e.t === 'lit')?.at ?? 3;
for (let t = 0.2; t < seconds; t += 1 / 30) { s.offset = t; s.crackle(); s.ambient(t, t > lit); }
for (const e of events) {
  if (e.at >= seconds) continue;
  s.offset = e.at;
  s.wick.positionX.setValueAtTime(e.x * 1.6, e.at); // his position on the page, as stereo
  s.wick.positionZ.setValueAtTime(-0.7, e.at);
  s.event(e.t, e.who);
}
const buf = await (ctx as unknown as OfflineAudioContext).startRendering();
const L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
const wav = Buffer.alloc(44 + n * 4);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + n * 4, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(n * 4, 40);
for (let i = 0; i < n; i++) {
  wav.writeInt16LE(Math.max(-1, Math.min(1, L[i])) * 32767 | 0, 44 + i * 4);
  wav.writeInt16LE(Math.max(-1, Math.min(1, R[i])) * 32767 | 0, 46 + i * 4);
}
writeFileSync(outFile, wav);
console.log('wrote', outFile, seconds, 's,', events.length, 'events');
