# WICK

**Your hands cast the only road he has.**

A hands-first mixed reality game for Meta Quest, built with the Immersive Web SDK. A sheet of rice paper stands in front of you and a flame floats at your chest. Your real hands sit between the two, and their shadow falls on the paper. Wick, a tiny paper figure with a tiny flame, walks on that shadow as if it were the ground. A gap in the world? Put your hand there and he crosses. A wall? Tilt it into a ramp. Rain? Hold it over him.

Play: https://designmaster-solutions.github.io/wick/ (Quest Browser, Quest 3 or 3S, no controllers).

Demo video (2:12, emulator footage): https://youtu.be/ZQAuG4g5L9g

Film (2:12, emulator footage): https://designmaster-solutions.github.io/wick/wick.mp4

## How it plays

- Pinch and the flame catches; the room dims.
- A hand close to the paper throws a small, sharp shadow. A hand near the flame throws a giant, soft one, too diffuse to stand on. Depth becomes scale.
- He stops at each obstacle and looks at you. Wait long enough and the page shows a hatched ghost of a hand that would help. There is no text anywhere in the game.
- Old shadow-theatre poses wake up and open an eye. The dog barks the crow away, the bird carries him over a chasm, the rabbit thumps a gate open, the crab cuts a rope, the swan ferries him over a pond, the snail leaves a silver road that holds for a while. Two open hands joined at the thumbs bring a butterfly.
- Every puppet you find goes in the album. After page 8 there is a new page every day, the same for everyone, seeded by the date.
- Three tabs on the frame, pressed by poking: ink mode (high contrast), steady hand (stronger tremor smoothing), album.
- Pinch both hands for a moment to bring the page back in front of you.

Everything can be played with one hand. Nobody dies: he floats down and walks back. There is no timer.

## How it works

- **Same numbers for picture and physics.** The 25 joints of each WebXR hand are projected from the flame through to the paper plane as 2D capsules (`src/sim/shadow.ts`). One instanced draw renders them, with a penumbra that grows with distance, into a small texture; the CPU collides Wick with the same list. What you see is what he stands on.
- **Hands in front of virtual content.** Passthrough sits behind everything virtual, so the hand capsules draw first as depth with near-zero alpha, opening a window onto the camera feed (`src/render/handvis.ts`).
- **Pose classifier from distance ratios** (`src/sim/classify.ts`), so it does not depend on hand size or which hand it is. One-hand poses only, because interlaced fingers break hand tracking.
- **The simulation is pure TypeScript with no DOM or three** (`src/sim`). A one-handed solver (`src/sim/bot.ts`) proves every page and a year of daily pages can be finished, plays the demo, and its intended hand is what the hint ghost draws.
- **All art and sound are procedural.** Washi from canvas strokes, cut-paper layers, pop-ups that fold up, Web Audio crackle, paper and a pentatonic music box. No asset files.
- **Comfort and attention.** Seated, the page sits inside central vision at 70 cm. If it leaves your field of view, he waits and the sound drops. It uses a spatial anchor when the browser grants one.

## Testing

```
npm test                       # projection, collision, classifier, pages, save data: node, no headset
node scripts/mutation-check.mjs  # breaks the core logic on purpose; every mutant must turn the suite red
node scripts/e2e.mjs           # deployed page + IWER emulator + synthetic hands via XRFrame.getJointPose
```

`?emu=1&demo=first30|tour|puppets|tabs|waiting|dark` runs the game in the emulator; state is on `document.body.dataset`. `&page=N` starts at a page.

## What has NOT been tested

**We do not have a Quest. No part of this has run on a real headset.** Everything above is proven in node and in the IWER emulator with scripted hands and a stand-in room. These are open risks only a headset can close:

- Frame rate on Quest 3. Draw calls and shaders are budgeted for it, but it has only been measured in software rendering.
- How the passthrough cut-through of the hands looks at the edges, and the additive flame over passthrough.
- The classifier with real tracked hands. It is checked with iwer's poses and 2 mm of synthetic jitter, not with people.
- Comfort of the 70 cm placement, sound levels through the headset speakers, and whether the anchor request behaves in Quest Browser.

## Build and deploy

Node 20.19 or newer. `npm ci --ignore-scripts && npm run dev`. Pushing to `main` tests, builds and publishes to GitHub Pages.

The film is rendered from the real game through the emulator, frame by frame: `video/build-film.sh <seconds>`, `node video/record.mjs video/out/events.jsonl`, `npx hyperframes render video/film`, then `python3 video/finish.py <seconds>` for captions and the synthesized soundtrack.

`package.json` replaces `playwright` with an empty package: it is only an unused transitive dependency of a UIKit renderer CLI inside the IWSDK. Nothing here drives a browser with it.

## Credits

Code, art and sound by Design Master Solutions. Built on the [Immersive Web SDK](https://developers.meta.com/horizon/documentation/web/iwsdk-guide-project-setup) and tested with [IWER](https://github.com/meta-quest/immersive-web-emulation-runtime), both MIT. Hand-pose data for tests and hints derives from IWER's pose library. MIT licensed.
