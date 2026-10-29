# STILL

A 30-second launch film for an invented product, STILL the focus dial. It is built from HTML and CSS 3D only: the product is stacked cylinders of shaded DOM strips, the camera is one CSS transform, and the type is DOM. There are no cuts. The ring of light draws itself in the dark, reveals the object, becomes the feature, sweeps away the notifications, and closes on the name.

The creative treatment, time-coded script, transitions, asset specification and sound design are in [PRODUCTION.md](./PRODUCTION.md).

## Run it

From the repo root, once: `pnpm install`. Then from this folder:

```sh
node build.mjs                                                  # film/*.js + timeline.mjs → sequence.html, video.miraiclip.json
pnpm mc check video.miraiclip.json                              # the dial stays in frame, the final rest holds still
pnpm mc stills video.miraiclip.json --at 1.5,7,12.5,16,22,28 --sheet   # frames + a contact sheet (writes ./stills)
node render.mjs --draft                                         # quick picture + score + mux + validation
node render.mjs --blur                                          # the final, with motion blur
```

`render.mjs` needs Google Chrome (H.264) and ffmpeg/ffprobe on PATH (`pnpm preflight` checks both). It writes `out/still.mp4` and prints PASS/FAIL for resolution, frame rate, frame count, audio length and clipping.

## How it is built

| File | Role |
|---|---|
| `timeline.mjs` | The single source of timing for picture and sound, including the turn and draw easing that the detent clicks and ticks are computed from |
| `film/00-util.js` | Easing, vectors, monotone keyframe curves, and the CSS-3D projection, which matches the CSS transform exactly |
| `film/10-dial.js` | The product: cylinders, per-strip shading, lights, the light sweep, the explode, the turn, and the 60 segments |
| `film/20-world.js` | The desk (its own 3D context), light pools, contact shadow, the wave, and the notification cards |
| `film/60-camera.js` | One camera move: keys joined by monotone cubics (distance in log space), plus a motion function for blur and the rest |
| `film/70-overlay.js` | Captions, the name, callouts pinned to the layers' edges, the timer, and the lockup |
| `film/90-main.js` | The painters, the subject check, the declared rest, labels and hits |
| `audio.mjs` | The synthesized score and sound design |

Every frame is a pure function of `t`: there's no clock, no `Math.random` and no state carried between frames.

## Validated output

These are measured from the written `out/still.mp4` by `render.mjs` and ffmpeg, not taken from the settings:

| Property | Result |
|---|---|
| Video | H.264, 1920 × 1080, 30/1 fps, 900 frames, 30.000 s |
| Audio | AAC 48 kHz stereo, 30.000 s, −17 LUFS integrated, true peak −1.5 dBFS |
| Hard cuts | None. The largest frame-to-frame scene score is 0.042 (ffmpeg `scene`); a cut scores 0.3 or more |
| Black frames | None (`blackdetect`) |
| Shot check | `pnpm mc check`: clean. The dial is in frame 0–30 s, and the 28.7–30 s rest holds still |

## Known limitations

- **The type depends on the machine.** It uses Avenir Next (macOS), with Helvetica Neue / Arial fallbacks.
- **The product is fictional.** Its name, features and the call to action are invented for this brief. A real launch would replace the CTA with a real URL.
- **CSS 3D has no real shadows or reflections.** The contact shadow, halo and highlights are painted from the light model, not ray-traced.
