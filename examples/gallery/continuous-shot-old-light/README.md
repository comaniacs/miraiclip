# Old Light

A 30-second, one-take 3D explainer drawn in three.js and rendered frame by frame by Miraiclip. One photon is trapped in the Sun's core, random-walks out over about 100,000 years, breaks free, and reaches Earth 8 minutes and 20 seconds later. The punchline is a comparison bar: the trip you think of as "sunlight travelling" is a sliver too thin to draw.

The creative concept, time-coded script, storyboard, continuity plan and sound design are in [PRODUCTION.md](./PRODUCTION.md).

## Run it

From the repo root, once:

```sh
pnpm install
pnpm --filter @miraiclip/core --filter @miraiclip/renderer --filter @miraiclip/server-export build
```

Then from this folder:

```sh
node build.mjs                      # film/*.js + timeline.mjs → sequence.html and video.miraiclip.json
node stills.mjs out/stills 1 9 15.5 # single frames through the real exporter, plus a contact sheet
../../../packages/server-export/node_modules/.bin/tsx render.mjs          # full render, ~1 min
../../../packages/server-export/node_modules/.bin/tsx render.mjs --blur   # final with 180° shutter motion blur
```

`render.mjs` renders the picture, synthesizes the score (`audio.mjs`), muxes them with loudness normalization, then probes the written file and prints PASS/FAIL checks. Rendering needs Google Chrome (H.264) and ffmpeg/ffprobe on PATH. It runs under `tsx` because the workspace packages export TypeScript source.

## How it is built

| File | Role |
|---|---|
| `timeline.mjs` | The single source of timing for picture and sound: beat times and the deterministic collision schedule |
| `film/00-util.js` | Easing, a seeded RNG (`S.rand`), glow sprites, GLSL simplex noise, and a constant-pixel-width line shader (near-plane clipped) used for the trail, thread, beam and dust |
| `film/20-micro.js` | The plasma cloud (instanced, kept clear of the photon's path), the photon, its bounce-accurate path, collision glow and trail |
| `film/30-sun.js` | The half-cut Sun: a granulated surface shader, a layered cut-face shader (core, radiative, convective), and the random-walk thread |
| `film/40-space.js` | The stars, the straight beam with its accelerating head, and speed-scaled dust streaks |
| `film/50-earth.js` | Procedural Earth (oceans, land, ice, clouds, specular glint), fresnel atmosphere, and the landing ring |
| `film/60-camera.js` | Three shots as pure functions of `t` (log zoom and orbit, an orbit around the flying photon, approach and orbit at Earth), blended on position and look-at point |
| `film/70-overlay.js` | DOM motion graphics: masked captions, leader labels projected from 3D anchors, counters, the comparison bar and the lockup |
| `film/90-main.js` | Renderer (ACES tone mapping, sRGB output), the frame function, a motion estimate for blur, labels and hits |

Each frame is a pure function of `t`. There's no clock, no `Math.random`, no animation loop and no state carried between frames, so any frame renders the same alone, out of order, or as a motion-blur sub-sample.

The scale change (×2,700, from a 0.06-unit plasma cloud to a 10-unit Sun) is one camera move: the camera's distance interpolates in log space, so the zoom feels constant-speed.

## Validated output

These are measured from the written file by `render.mjs`, not taken from the settings:

| Property | Result |
|---|---|
| Resolution | 1920 × 1080 |
| Frame rate | 30/1 |
| Frames | 900 (30.000 s) |
| Audio | AAC 48 kHz stereo, 30.000 s, −16 LUFS integrated, true peak −1 dBFS |
| Hard cuts | None. The largest frame-to-frame scene score is 0.049 (ffmpeg `scene`); a cut scores 0.3 or more. The peaks are designed events: collision flashes, the Sun fading in. |

## Known limitations

- **The type depends on the machine.** It uses Avenir Next, a macOS system font, with Helvetica Neue / Arial fallbacks. On a machine without it the layout holds, but the face changes.
- **Some scale is cheated for clarity.** Earth is drawn about 30× too large relative to the Sun–Earth distance, which is itself compressed, so both fit one composition.
- **There's no narration.** The story is carried by on-screen type and the score.
- **`check_sequence` has not been run.** The miraiclip MCP tool wasn't available in this session. Continuity was checked with contact sheets, a frame-difference scan and per-transition stills instead.
- **The rest is not declared to the kit.** The 14.1–14.9 s rest exists in the picture, but `tl.rest` isn't called, because the caption exit animates inside that window and the kit would reject it.
