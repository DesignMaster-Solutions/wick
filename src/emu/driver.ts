// ?emu=1: the IWER emulator with scripted hands. The hands go through the real WebXR path
// (XRFrame.getJointPose), so what is exercised here is the game's actual input code.
import type { Group } from '@iwsdk/core';
import { Quaternion, Vector3 } from '@iwsdk/core';
import { metaQuest3, XRDevice } from 'iwer';
// Deep imports: iwer keeps its pose library and config out of the root export.
import { oculusHandConfig } from 'iwer/lib/device/XRHandInput.js';
import { libraryHandPoses } from 'iwer/lib/device/configs/hand/library.js';
import { buildHandPose } from 'iwer/lib/device/configs/hand/builder.js';
import { relaxedHandPose } from 'iwer/lib/device/configs/hand/relaxed.js';
import { pinchHandPose } from 'iwer/lib/device/configs/hand/pinch.js';
import { Bot, handQuat, type HandTarget } from '../sim/bot.ts';
import type { Game } from '../sim/game.ts';
import { POSE_ANGLES } from '../sim/pose-angles.ts';
import { filmStep, script, type Cue } from './scripts.ts';

export type EmuDriver = { device: XRDevice; tick(game: Game, paper: Group, dt: number): void; report?(): void; log?(t: string, who: string | undefined, x: number, y: number): void };

const POSE_ID = (name: string) => POSE_ANGLES[name]?.ref ?? name;

export const installEmu = (demo: string, film = false): EmuDriver => {
  const config = oculusHandConfig as unknown as { poses: Record<string, unknown> };
  void libraryHandPoses;
  for (const [name, def] of Object.entries(POSE_ANGLES)) {
    if (def.angles) config.poses[name] = buildHandPose(def.angles as never, relaxedHandPose, pinchHandPose);
  }
  const device = new XRDevice(metaQuest3, { stereoEnabled: false, fovy: film ? 0.75 : 1.15 });
  device.installRuntime({ forceInstall: true });
  device.primaryInputMode = 'hand';
  device.position.set(0, 1.28, 0);
  (window as unknown as { __iwer: XRDevice }).__iwer = device;

  const bot = new Bot(film ? { patience: 1.7 } : {});
  const v = new Vector3(), q = new Quaternion(), pq = new Quaternion();
  let clock = 0;
  const cues = script(demo);
  const hold: { right: HandTarget | null; left: HandTarget | null } = { right: null, left: null };
  const pos: Record<'left' | 'right', Vector3 | null> = { left: null, right: null };

  const pin = (side: 'left' | 'right', t: HandTarget | null, paper: Group, dt: number) => {
    const hand = device.hands[side]!;
    if (!t) { hand.setPin(null); hand.connected = false; pos[side] = null; return; }
    hand.connected = true;
    if (hand.poseId !== POSE_ID(t.pose)) hand.poseId = POSE_ID(t.pose);
    v.set(t.wrist[0], t.wrist[1], t.wrist[2]);
    paper.localToWorld(v);
    const cur = pos[side];
    if (!cur) pos[side] = v.clone();
    else cur.lerp(v, Math.min(1, dt * 7));
    if (film) pos[side]!.y += Math.sin(clock * 2.3) * 0.00012; // a living hand is never perfectly still
    paper.getWorldQuaternion(pq);
    q.set(t.q[0], t.q[1], t.q[2], t.q[3]).premultiply(pq);
    const at = pos[side]!;
    hand.setPin({ anchor: t.tip ? 'index-tip' : 'wrist', target: [at.x, at.y, at.z], wristRotation: [q.x, q.y, q.z, q.w] });
  };

  return {
    device,
    // While filming, events go to the local soundtrack recorder (video/record.mjs).
    log: film ? (t, who, x, y) => { void fetch('http://127.0.0.1:8971/ev', { method: 'POST', mode: 'no-cors', body: JSON.stringify({ at: clock, t, who, x, y }) }).catch(() => {}); } : undefined,
    tick(game, paper, dt) {
      clock += dt;
      const cue: Cue | undefined = cues.find((c) => clock >= c.from && clock < c.to);
      hold.left = null;
      hold.right = null;
      if (film) {
        const f = filmStep(game, clock);
        // The film skips two pages to stay under three minutes; they are in the game and in the tests.
        if (game.phase === 'turn' && game.turnT > 1.2 && (game.save.page === 1 || game.save.page === 6)) game.save.page++;
        // A seated person: small slow head movement, which is what shows the stereo layers of the page.
        const yaw = Math.sin(clock * 0.21) * 0.035, pitch = -0.17 + Math.sin(clock * 0.13) * 0.012;
        device.position.set(Math.sin(clock * 0.27) * 0.035, 1.3, 0.13);
        const cy = Math.cos(yaw / 2), sy = Math.sin(yaw / 2), cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
        device.quaternion.set(sp * cy, cp * sy, -sp * sy, cp * cy);
        if (f === 'bot') hold.right = game.phase === 'play' ? bot.intent(game.world) : null;
        else if (f) hold.right = { pose: f.pose, wrist: f.at, q: handQuat(f.a ?? 0), tip: f.tip };
      } else if (cue) {
        if (cue.head !== undefined) device.quaternion.set(0, Math.sin(cue.head / 2), 0, Math.cos(cue.head / 2));
        else device.quaternion.set(0, 0, 0, 1);
        if (cue.right === 'bot') hold.right = game.phase === 'play' ? bot.intent(game.world) : null;
        else if (cue.right) hold.right = { pose: cue.right.pose, wrist: cue.right.at, q: handQuat(cue.right.a ?? 0), tip: cue.right.tip };
        if (cue.left) hold.left = { pose: cue.left.pose, wrist: cue.left.at, q: handQuat(cue.left.a ?? 0) };
      }
      pin('right', hold.right, paper, dt);
      pin('left', hold.left, paper, dt);
      document.body.dataset.emuClock = clock.toFixed(1);
    },
  };
};
