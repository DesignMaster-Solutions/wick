// Wires the pure game to IWSDK, WebXR hands, the renderer and sound. Runs only in the browser.
import { Group, MeshBasicMaterial, Mesh, Quaternion, ReferenceSpaceType, SessionMode, Vector3, World, BoxGeometry, BackSide, PlaneGeometry, ShaderMaterial, CanvasTexture } from '@iwsdk/core';
import { Sound } from './audio.ts';
import { Flame, makeRoomDim } from './render/flame.ts';
import { Fx } from './render/fx.ts';
import { HandVis } from './render/handvis.ts';
import { makeShadowTarget, makeShared, makeWashi, paperMaterial } from './render/materials.ts';
import { ShadowPass } from './render/shadowpass.ts';
import { Stage } from './render/stage.ts';
import { WickFigure } from './render/wick.ts';
import { Batch } from './render/batch.ts';
import { Bot, handQuat } from './sim/bot.ts';
import { PUPPETS } from './sim/classify.ts';
import { JointFilter } from './sim/filter.ts';
import { Game, LIGHT, pageFor, TURN_TIME } from './sim/game.ts';
import { JOINT_NAMES, newHand, poseHand, type Hand } from './sim/hand.ts';
import { BOTTOM, LEFT, SHEET_H, SHEET_W } from './sim/pages.ts';
import { addHandShadow, newShadowSet } from './sim/shadow.ts';
import type { EmuDriver } from './emu/driver.ts';

const FIXED = 1 / 60;
const HINT_AFTER = 6;
const TAB_Y = BOTTOM - 0.045, TABS = [-0.09, 0, 0.09];
const LOOK_AWAY = Math.cos((58 * Math.PI) / 180);

export type WickApp = { world: World; enter(): void; sound: Sound };

export const startApp = async (container: HTMLElement, emu: EmuDriver | null, params: URLSearchParams): Promise<WickApp> => {
  const world = await World.create(container as HTMLDivElement, {
    xr: { sessionMode: SessionMode.ImmersiveAR, referenceSpace: { type: ReferenceSpaceType.LocalFloor, fallbackOrder: [ReferenceSpaceType.Local] }, features: { handTracking: { required: true }, anchors: true }, offer: 'none' },
    features: { spatialUI: false, grabbing: false, locomotion: false, physics: false },
    render: { fov: 70, near: 0.03, far: 20 },
  });
  const renderer = world.renderer;

  const speed = Math.max(1, Math.min(40, Number(params.get('speed')) || 1));
  const startPage = params.has('page') ? Number(params.get('page')) : undefined;
  const game = new Game(emu ? null : localStorage, new Date(), startPage);
  const sound = new Sound();

  const washi = makeWashi();
  const target = makeShadowTarget();
  const shared = makeShared(target, washi);
  shared.uLight.value.set(LIGHT[0], LIGHT[1], LIGHT[2]);
  const mat = paperMaterial(shared);
  const paper = new Group();
  world.scene.add(paper);
  const stage = new Stage(mat);
  paper.add(stage.root);
  const wick = new WickFigure(mat);
  paper.add(wick.root);
  const fx = new Fx(mat);
  paper.add(fx.root);
  const flame = new Flame();
  flame.group.position.set(LIGHT[0], LIGHT[1], LIGHT[2]);
  paper.add(flame.group);
  const dim = makeRoomDim();
  world.scene.add(dim.mesh);
  const handVis = new HandVis(!!emu);
  world.scene.add(handVis.mesh);
  const pass = new ShadowPass();

  if (emu) {
    // No camera feed in the emulator: a plain room stands in for passthrough so footage reads honestly as a room.
    const c = document.createElement('canvas');
    c.width = 32; c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#8d8f93'); grad.addColorStop(0.55, '#a39f98'); grad.addColorStop(0.56, '#4a3a2c'); grad.addColorStop(1, '#2b2118');
    g.fillStyle = grad; g.fillRect(0, 0, 32, 256);
    const room = new Mesh(new BoxGeometry(6, 3, 6), new MeshBasicMaterial({ map: new CanvasTexture(c), side: BackSide }));
    room.position.set(0, 1.5, 0);
    room.renderOrder = -100;
    world.scene.add(room);
    const table = new Mesh(new PlaneGeometry(1.6, 0.8), new ShaderMaterial({ vertexShader: 'varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'varying vec2 vU; void main(){ gl_FragColor=vec4(mix(vec3(.3,.19,.11),vec3(.2,.12,.07),sin(vU.y*90.)*.5+.5),1.);}' }));
    table.rotation.x = -Math.PI / 2;
    paper.add(table);
    table.position.set(0, BOTTOM - 0.1, 0.2);
  }

  // Tabs on the bottom of the frame, pressed by poking: ink mode, steady hand, album.
  const tabBatch = new Batch();
  TABS.forEach((x) => tabBatch.cut(Array.from({ length: 16 }, (_, i) => [x + Math.cos((i / 16) * 6.283) * 0.022, TAB_Y + Math.sin((i / 16) * 6.283) * 0.022] as [number, number]), '#d9b47a', 0.012));
  tabBatch.poly([[TABS[0], TAB_Y - 0.013], [TABS[0] + 0.013, TAB_Y], [TABS[0], TAB_Y + 0.013]], '#1a1009', 0.0126).poly([[TABS[0], TAB_Y - 0.013], [TABS[0] - 0.013, TAB_Y], [TABS[0], TAB_Y + 0.013]], '#f9f2dc', 0.0126);
  for (let k = -1; k <= 1; k++) tabBatch.poly(Array.from({ length: 10 }, (_, i) => [TABS[1] - 0.012 + i * 0.0027, TAB_Y + k * 0.007 + Math.sin(i * 1.2) * 0.002] as [number, number]).concat(Array.from({ length: 10 }, (_, i) => [TABS[1] + 0.012 - i * 0.0027, TAB_Y + k * 0.007 + Math.sin((9 - i) * 1.2) * 0.002 + 0.002] as [number, number])), '#3a2615', 0.0126);
  tabBatch.poly([[TABS[2] - 0.014, TAB_Y - 0.009], [TABS[2], TAB_Y - 0.005], [TABS[2], TAB_Y + 0.011], [TABS[2] - 0.014, TAB_Y + 0.008]], '#f4e7c8', 0.0126).poly([[TABS[2] + 0.014, TAB_Y - 0.009], [TABS[2], TAB_Y - 0.005], [TABS[2], TAB_Y + 0.011], [TABS[2] + 0.014, TAB_Y + 0.008]], '#3a2615', 0.0126);
  paper.add(tabBatch.build(mat));

  const albumCover = new Batch().poly([[LEFT, BOTTOM], [-LEFT, BOTTOM], [-LEFT, SHEET_H / 2], [LEFT, SHEET_H / 2]], '#f0e2c4', 0.02).build(mat);
  albumCover.visible = false;
  paper.add(albumCover);
  const albumEyes = new Group();
  paper.add(albumEyes);

  const filters = [new JointFilter(), new JointFilter()];
  const raw: Hand[] = [newHand(), newHand()];
  const worldHands: (Hand | null)[] = [null, null];
  const local: [Hand | null, Hand | null] = [null, null];
  const localStore = [newHand(), newHand()];
  const tmpHand = newHand();
  const tmpShadow = newShadowSet();
  const hinter = new Bot({ reach: 0.2 });
  const v = new Vector3(), head = new Vector3(), fwd = new Vector3(), up = new Vector3(), toSheet = new Vector3(), q = new Quaternion();

  let placed = false;
  let builtFor = -1;
  let accum = 0;
  let litK = 0;
  let stepClock = 0;
  let tabCooldown = 0;
  let tabLatch = false;
  let bothPinch = 0;
  let frames = 0, fpsClock = 0, fps = 0, statClock = 0;
  let duck = 1;
  let anchor: XRAnchor | null = null;
  let anchorPending = false;
  const applySettings = () => {
    shared.uInk.value = game.save.ink ? 1 : 0;
    filters.forEach((f) => f.steady(game.save.steady));
  };
  applySettings();

  const place = (frame: XRFrame) => {
    paper.position.copy(head).addScaledVector(toSheet.set(fwd.x, 0, fwd.z).normalize(), 0.7);
    paper.position.y = head.y - 0.14;
    paper.lookAt(head.x, paper.position.y, head.z); // +Z of the paper faces the player
    paper.updateMatrixWorld(true);
    shared.uPaperInv.value.copy(paper.matrixWorld).invert();
    placed = true;
    // Spatial anchor when the browser offers one: the page stays put through tracking corrections.
    anchor?.delete();
    anchor = null;
    if (frame.createAnchor && world.xrReferenceSpace && !anchorPending) {
      anchorPending = true;
      const p = paper.position, o = paper.quaternion;
      frame.createAnchor(new XRRigidTransform({ x: p.x, y: p.y, z: p.z }, { x: o.x, y: o.y, z: o.z, w: o.w }), world.xrReferenceSpace)
        ?.then((a) => { anchor = a; }).catch(() => {}).finally(() => { anchorPending = false; });
    }
  };

  const readHands = (frame: XRFrame, ref: XRReferenceSpace, dt: number) => {
    worldHands[0] = worldHands[1] = local[0] = local[1] = null;
    for (const src of frame.session.inputSources) {
      if (!src.hand) continue;
      const side = src.handedness === 'left' ? 0 : 1;
      let ok = true;
      for (let i = 0; i < 25; i++) {
        const space = src.hand.get(JOINT_NAMES[i] as XRHandJoint);
        const pose = space && frame.getJointPose?.(space, ref);
        if (!pose) { ok = false; break; }
        const t = pose.transform.position;
        raw[side].p[i * 3] = t.x; raw[side].p[i * 3 + 1] = t.y; raw[side].p[i * 3 + 2] = t.z;
        raw[side].r[i] = pose.radius ?? 0.008;
      }
      if (!ok) { filters[side].reset(); continue; }
      const smooth = filters[side].apply(raw[side].p, Math.max(dt, 1 / 240));
      const wh = { p: smooth, r: raw[side].r };
      worldHands[side] = wh;
      const out = localStore[side];
      out.r = raw[side].r;
      for (let i = 0; i < 25; i++) {
        v.fromArray(smooth, i * 3);
        paper.worldToLocal(v);
        out.p[i * 3] = v.x; out.p[i * 3 + 1] = v.y; out.p[i * 3 + 2] = v.z;
      }
      local[side] = out;
    }
    if (!worldHands[0]) filters[0].reset();
    if (!worldHands[1]) filters[1].reset();
  };

  const drawAlbum = () => {
    const cols = [-0.25, -0.083, 0.083, 0.25];
    albumEyes.clear();
    PUPPETS.forEach((name, i) => {
      const found = game.save.album.includes(name);
      const x = cols[i % 4], y = i < 4 ? 0.04 : -0.17;
      tmpShadow.n = 0;
      const small = (pose: string, wx: number, handed: 1 | -1) => {
        poseHand(pose, [0, 0, 0], handQuat(Math.PI / 2 + (pose === 'dog' || pose === 'bird' || pose === 'swan' ? -1.3 * handed : 0)), handed, tmpHand);
        for (let k = 0; k < 75; k += 3) { tmpHand.p[k] = tmpHand.p[k] * 0.58 + wx; tmpHand.p[k + 1] = tmpHand.p[k + 1] * 0.58 + y; tmpHand.p[k + 2] = 0.01; }
        for (let k = 0; k < 25; k++) tmpHand.r[k] *= 0.58;
        addHandShadow(tmpShadow, tmpHand, LIGHT);
      };
      if (name === 'butterfly') { small('open', x - 0.03, 1); small('open', x + 0.03, -1); } else small(name, x, 1);
      pass.write(tmpShadow, found ? 0 : 1);
      if (found) {
        const e = new Batch().disc(x + 0.012, y + 0.075, 0.009, '#f7e7c4', 0.0215, 12).disc(x + 0.012, y + 0.075, 0.0045, '#1a0f0a', 0.0218, 8).build(mat);
        albumEyes.add(e);
      }
    });
  };

  const tabPress = (i: number) => {
    sound.event('tab');
    fx.burst(TABS[i], TAB_Y + 0.02, 8, 0.1);
    if (i === 0) { game.save.ink = !game.save.ink; game.persist(); applySettings(); }
    if (i === 1) { game.save.steady = !game.save.steady; game.persist(); applySettings(); }
    if (i === 2) game.toggleAlbum();
  };

  world.onXRFrame((frame, delta, time) => {
    const ref = world.xrReferenceSpace!;
    const pose = frame.getViewerPose(ref);
    if (!pose) return;
    const dt = Math.min(delta, 0.1);
    const t = pose.transform;
    head.set(t.position.x, t.position.y, t.position.z);
    q.set(t.orientation.x, t.orientation.y, t.orientation.z, t.orientation.w);
    fwd.set(0, 0, -1).applyQuaternion(q);
    up.set(0, 1, 0).applyQuaternion(q);
    if (!placed) place(frame);
    if (anchor) {
      const ap = frame.getPose(anchor.anchorSpace, ref);
      if (ap) {
        paper.position.set(ap.transform.position.x, ap.transform.position.y, ap.transform.position.z);
        paper.quaternion.set(ap.transform.orientation.x, ap.transform.orientation.y, ap.transform.orientation.z, ap.transform.orientation.w);
        paper.updateMatrixWorld(true);
        shared.uPaperInv.value.copy(paper.matrixWorld).invert();
      }
    }
    // IWSDK would draw a stand-in hand model; the player's real hands are the show.
    for (const h of Object.values(world.input.xr.visualAdapters.hand)) { h.toggleVisual(false); if (h.visual) h.visual.model.visible = false; }

    emu?.tick(game, paper, dt * speed); // speed only compresses the emulator's clock for slow software-GL test runs
    readHands(frame, ref, dt * speed);

    // Recentre: both hands pinched for a moment.
    const pinched = local.filter((h) => h && Math.hypot(h.p[12] - h.p[27], h.p[13] - h.p[28], h.p[14] - h.p[29]) < 0.022).length;
    bothPinch = pinched === 2 ? bothPinch + dt : 0;
    if (bothPinch > 1.2 && game.phase !== 'dark') { place(frame); bothPinch = -2; sound.event('tab'); }

    // FoV: paused and quieter when the page leaves your view.
    toSheet.copy(paper.position).sub(head).normalize();
    const facing = fwd.dot(toSheet);
    game.looking = facing > LOOK_AWAY;
    duck += ((game.looking ? 1 : 0.35) - duck) * Math.min(1, dt * 2);

    accum += dt * speed;
    let steps = 0;
    while (accum >= FIXED && steps < 60) { game.step(local, FIXED); accum -= FIXED; steps++; }
    if (steps === 60) accum = 0;
    for (const e of game.events) {
      fx.event(e);
      sound.event(e.t, e.who);
      emu?.log?.(e.t, e.who, e.x, e.y);
    }
    game.events.length = 0;

    const w = game.world;
    tabCooldown = Math.max(0, tabCooldown - dt);
    // A press needs the fingertip to leave and come back: resting on a tab must not flicker it.
    let touching = -1;
    for (const h of local) {
      if (!h) continue;
      const tip = TABS.findIndex((x) => Math.hypot(h.p[27] - x, h.p[28] - TAB_Y) < 0.026 && h.p[29] > -0.03 && h.p[29] < 0.05);
      if (tip >= 0) touching = tip;
    }
    if (touching < 0) tabLatch = false;
    else if (!tabLatch && tabCooldown === 0 && game.phase !== 'dark' && game.phase !== 'turn') { tabLatch = true; tabPress(touching); tabCooldown = 0.5; }

    // Lighting of the moment.
    litK += ((game.phase === 'dark' ? 0 : 1) - litK) * Math.min(1, dt * 2.4);
    const flick = 0.93 + 0.05 * Math.sin(time * 9.1) + 0.03 * Math.sin(time * 23.7) + 0.02 * Math.sin(time * 41.3 + 1.2);
    shared.uFlicker.value = flick;
    shared.uLit.value = litK;
    shared.uTime.value = time;
    flame.update(time, Math.max(0.1, litK), { quaternion: q } as never);
    dim.uni.uDim.value = 0.42 + litK * 0.3;

    // Book: which page is on display, and how far through its turn.
    const wantIndex = game.phase === 'turn' && game.turnT < TURN_TIME / 2 ? game.pageIndex - (game.isDaily && game.save.lastDay === game.day ? 0 : 1) : game.pageIndex;
    if (wantIndex !== builtFor) {
      stage.build(pageFor(Math.max(wantIndex, 0), game.day), Math.max(wantIndex, 0), game.save.litPages);
      builtFor = wantIndex;
    }
    const k = game.phase === 'turn' ? game.turnT / TURN_TIME : 0;
    const a = k < 0.5 ? (-k * 2 * Math.PI) / 2.2 : ((1 - k) * 2 * Math.PI) / 2.2;
    stage.root.rotation.y = a;
    stage.root.position.set(LEFT * (1 - Math.cos(a)), 0, LEFT * Math.sin(a) * -1);
    stage.update(w, dt, time);

    const visible = game.phase === 'play' || game.phase === 'album';
    wick.root.visible = visible && game.time - game.litAt > 0;
    fx.root.visible = game.phase !== 'dark';
    wick.update(w, dt, paper.worldToLocal(v.copy(head)).x, time);
    if (w.mode === 'walk' && !w.paused) {
      stepClock += dt;
      if (stepClock > 0.29) { stepClock = 0; sound.event('step'); emu?.log?.('step', undefined, w.x, w.y); }
    }
    fx.update(w, dt, time);
    sound.crackle();
    sound.ambient(time, game.phase !== 'dark');
    v.set(w.x, w.y, 0.02).applyMatrix4(paper.matrixWorld);
    const raining = game.phase === 'play' && w.page.obstacles.some((o) => o.kind === 'rain' && !w.cleared.has(o.i));
    sound.place(v.x, v.y, v.z, { x: head.x, y: head.y, z: head.z, fx: fwd.x, fy: fwd.y, fz: fwd.z, ux: up.x, uy: up.y, uz: up.z }, raining, duck);

    handVis.update(worldHands);

    // Shadow texture: real hands, then the hint, or the album on its own page.
    albumCover.visible = game.phase === 'album';
    albumEyes.visible = game.phase === 'album';
    if (game.phase === 'album') {
      shared.uGhost.value = 1;
      drawAlbum();
    } else {
      pass.write(w.shadow, 0);
      let ghost = 0;
      if (game.phase === 'dark' && game.time > 3) {
        // No words: the page itself shows the gesture that wakes it.
        tmpShadow.n = 0;
        addHandShadow(tmpShadow, poseHand('bird', [-0.02, -0.05, 0.1], handQuat(1.2), 1, tmpHand), LIGHT);
        pass.write(tmpShadow, 1);
        ghost = 1;
      } else if (game.phase === 'play' && w.mode === 'wait' && w.waited > HINT_AFTER) {
        const it = hinter.intent(w);
        if (it) {
          tmpShadow.n = 0;
          addHandShadow(tmpShadow, poseHand(it.pose, it.wrist, it.q, 1, tmpHand), LIGHT);
          pass.write(tmpShadow, 1);
          ghost = 1;
        }
      }
      shared.uGhost.value = ghost;
    }
    pass.render(renderer, target);

    frames++;
    fpsClock += delta;
    if (fpsClock > 1) { fps = frames / fpsClock; frames = 0; fpsClock = 0; }
    statClock += delta;
    if (statClock > 0.1) {
      statClock = 0;
      const b = document.body.dataset;
      b.phase = game.phase; b.page = String(game.pageIndex); b.pageId = w.page.id; b.mode = w.mode; b.why = w.why ?? '';
      b.x = w.x.toFixed(3); b.y = w.y.toFixed(3); b.t = w.time.toFixed(1);
      b.hands = String(local.filter(Boolean).length);
      b.labels = w.hands.map((h) => h.label ?? '-').join(',');
      b.awake = w.hands.map((h) => h.awake ?? '-').join(',');
      b.album = game.save.album.join(',');
      b.shadow = String(w.shadow.n);
      b.lit = String(game.save.litPages);
      b.ghost = String(shared.uGhost.value);
      b.ink = String(game.save.ink);
      b.steady = String(game.save.steady);
      b.looking = String(game.looking);
      b.fps = fps.toFixed(0);
      b.anchored = String(!!anchor);
      b.handZ = local[1] ? local[1].p[2].toFixed(3) : '';
    }
    emu?.report?.();
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden) game.persist(); });
  window.addEventListener('pagehide', () => game.persist());

  return {
    world,
    sound,
    enter() {
      sound.start();
      placed = false;
      world.launchXR();
    },
  };
};
