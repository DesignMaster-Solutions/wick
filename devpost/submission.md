# WICK: Devpost form text (draft, not submitted)

## Project name
WICK

## Tagline (max 140 characters)
Your hands cast the only road he has. Real hand shadows on paper become the ground a tiny candle-bearer walks on. No controllers, no words.

## Track / Division
Track: Gaming. Division: New Experience (conceived and built from scratch after September 24, 2026; new repository, all code new).

## Links
- Play: https://designmaster-solutions.github.io/wick/
- Source: https://github.com/DesignMaster-Solutions/wick
- Video: VIDEO_URL_HERE (not uploaded yet: MP4 at ~/Backups/impressora/meta-vr-start/video/wick.mp4, also at https://designmaster-solutions.github.io/wick/wick.mp4)

## Description (max 500 words)
You sit down and put on the headset. A sheet of rice paper stands in front of you. You pinch, the room dims, and a flame catches at your chest. Now your real hands are between a light and a page, and their shadow falls on it.

A tiny paper figure steps out of a door, carrying a flame of his own. Wick walks along until the ground ends, stops, and looks up at you. You put your hand under him and he walks across your shadow.

That is the whole game, and it only exists on a headset. Your hand has real depth: close to the paper it throws a small, sharp shadow, and near the flame a giant, soft one too diffuse to stand on. So a wall becomes a ramp you tilt, and rain becomes an umbrella you hold.

Then the old shadow-theatre shapes wake up. Make a dog and it opens an eye and barks the crow away. A bird carries him across the chasm. A rabbit thumps a gate open, a crab cuts the rope, a swan ferries him over the pond, a snail leaves a silver road. Each one you find goes into your album, and after the last page there is a new page every day, seeded by the date.

There are no words anywhere. If he waits too long, the page draws a hatched ghost of a hand that would help. He never dies: he floats down and walks back. Everything works with one hand, there is no timer, a high-contrast ink mode and a steady-hand mode are one poke away, and each page takes a minute or two from a chair.

Inspiration: hand-shadow puppetry is one of the oldest screens we have, and it needs what VR hand tracking finally gives us, a real hand with real depth in the same space as the image. We wanted a game you understand in the first ten seconds, because your hands already know how shadows work.

How we built it: Immersive Web SDK and three.js, hosted on GitHub Pages. The 25 joints of each WebXR hand are projected from the flame onto the paper plane as capsules. The same list is drawn with a penumbra that grows with distance and collided with on the CPU, so what you see is exactly what he stands on. All art and sound are procedural: fibres drawn to a canvas, folding paper pop-ups, and a synthesized crackle and music box. The simulation is pure TypeScript, and a one-handed solver proves every page and a year of daily pages can be finished.

An honest note: we built this without a headset. It is tested in node and in the IWER emulator with synthetic hands, and the video is emulator footage with a stand-in room. Real-device tuning is the next step.

Plans: tune on Quest, more puppets, a shared daily page where you see which shadows others cast, and a two-player mode with one hand each.

## How the hands were implemented
Hands are the only input, from the first gesture to the last, with no controller code path at all. `hand-tracking` is a required session feature.

- Reading: every frame we read all 25 joints through XRFrame.getJointPose and smooth them with a One Euro filter, which has a stronger setting for players with tremor.
- Shadow: each bone is projected from the flame onto the paper as a capsule, with the palm filled by extra capsules. Rendering and collision share this data.
- Occlusion: passthrough is behind all virtual content, so the hand capsules are drawn first as depth with near-zero alpha, so real hands appear in front of the paper.
- Gestures: a pinch lights the flame. Pinching both hands recentres the page. Poking the tabs on the frame toggles ink mode, steady mode and the album.
- Puppets: a classifier uses ratios of joint distances, so it is independent of hand size and of which hand you use. It requires a stable pose for 0.3 s. We kept to poses that do not interlace fingers, because occlusion breaks tracking.
- Everything can be done with one hand; the one two-hand puppet is optional.

## YouTube (draft)
Title: WICK: your hands cast the only road he has (hands-first mixed reality game, Meta Quest / WebXR)

Description:
WICK is a hands-first mixed reality game built with the Immersive Web SDK for the Meta VR Start Developer Competition 2026. Your real hands cast shadows on a sheet of paper, and a tiny paper figure walks on them. No controllers, no words.

Footage is from the IWER emulator with scripted hands and a stand-in room, played through the game's real WebXR input path. It has not yet run on a physical headset.

Play in Quest Browser: https://designmaster-solutions.github.io/wick/
Source: https://github.com/DesignMaster-Solutions/wick
