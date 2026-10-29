# Where the Spheres Meet

A 30-second, one-take 3D explainer drawn in three.js and rendered frame by frame by Miraiclip.

It explains how GPS finds you without ever hearing from you. The camera rises from the blue dot on a night city map, up the signal threads, to three satellites broadcasting the time. One signal's delay becomes a distance, then a sphere. Two spheres meet in a circle; a third leaves two points, and only one is on Earth. The camera dives back down that point to the same dot.

The concept, time-coded script, storyboard and continuity plan are in [PRODUCTION.md](./PRODUCTION.md).

## Run it

From the repo root, once: `pnpm install`. Then from this folder:

```sh
node build.mjs                                     # film/*.js + timeline.mjs → sequence.html, video.miraiclip.json
pnpm mc check video.miraiclip.json                 # subjects in frame, the rest holds still (~4 s)
pnpm mc stills video.miraiclip.json --at 1,9,17,24 --sheet
node render.mjs                                    # picture on 4 workers + score + mux + validation (~50 s)
node render.mjs --blur                             # the final, with motion blur (~2.5 min)
```

## How it is built

| File | Role |
|---|---|
| `timeline.mjs` | Every beat time, shared by the picture and `audio.mjs` |
| `film/00-setup.js` | ThreeKit aliases and the geometry: your position and local frame, the satellites, each sphere's radius and signal delay, the circle where spheres 1 and 2 meet, and the second point where all three meet |
| `film/10-city.js` | The city map, built in local units and scaled into Earth at your position: streets, dark glass towers with lit windows, the blue dot, its halo and rings |
| `film/20-earth.js` | Night Earth: land, sea and city lights in a shader, depth-offset under the map, and an atmosphere rim that fades in with altitude |
| `film/30-sats.js` | Satellites from primitives (foil body, solar wings, dish), broadcast shells, the signal threads, and the stamped pulses |
| `film/40-spheres.js` | The distance spheres (fresnel rim and grid), the intersection circle drawn from you around, and the two points |
| `film/60-camera.js` | One parametric camera around your local up: log-scale distance, tilt, an integrated orbit drift that stops for the rest, and an aim whose height follows the distance |
| `film/70-overlay.js` | Captions, the satellite label (which flips away from the frame edge), the delay → distance maths, the footnote and lockup, all painted as a held frame |
| `film/90-main.js` | Renderer and lights, the 3D painter with its motion function, the held type painter, `tl.subject` checks, `tl.rest`, labels and sound hits |

The numbers on screen are computed from the scene, at 637.1 km per unit and the speed of light. Satellite 1's sphere is 21,140 km in radius, a 0.071 s delay.

## Checked

**Measured on `out/where-spheres-meet.mp4` by `render.mjs`:**

| Property | Result |
|---|---|
| Resolution | 1920 × 1080 |
| Frame rate | 30/1 |
| Frames | 900 (30.000 s) |
| Audio | AAC 48 kHz stereo, 30.000 s, −14.9 LUFS integrated, true peak −1.5 dBFS |
| Hard cuts | None. The largest frame-to-frame scene score is 0.031; a cut scores 0.3 or more. |

**Shot check:** `pnpm mc check` reports no findings.
- The blue dot stays in frame at both ends of the film, and on the way up.
- Satellite 1 stays in frame, at least 8 px, while it speaks.
- The meeting point stays in frame through the geometry and the dive.
- The 20.2–20.9 s rest is verified to hold still.

**Defects found and fixed during review:**

| Defect | Found by | Fix |
|---|---|---|
| The dot left the frame during the dive | The subject check | The aim height now follows the camera distance |
| The dot's rings and the streets were hidden | Stills | Render order |
| Beige glare up close | Stills | Toned down the glow around the dot |
| A black disc where the map met Earth | Stills | Replaced the hole with a depth offset |
| The satellite label ran off the frame edge | Stills | The leader now flips away from the edge |
| The atmosphere popped on as the camera crossed it | Frame-difference scan | It fades in with the camera's altitude |
| The dot's rings jumped in size and colour at 26 s | Frame-difference scan | They now crossfade through zero |

## Known limitations

- The type uses Avenir Next, a macOS system font, with Helvetica Neue / Arial fallbacks.
- Satellites are drawn about 10,000× larger than life so they read.
- The city is stylized, not a real place.
- A real receiver needs a fourth satellite to correct its own clock. The film says so in a footnote but doesn't animate it.
