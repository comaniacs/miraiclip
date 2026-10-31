# Miraiclip launch film

A 30-second, 1920×1080 launch film for Miraiclip, in motion graphics. It is HTML and CSS 3D only, on one deterministic timeline, with an original synth score.

**Hook:** from the first frame, three words slam in as coloured blocks: *Ship a · video editor · in your app.* They grow trim handles, a playhead plays them, and they shrink into the first clips of an editor timeline. That timeline is the motif for the rest of the film.

| Time | Scene | On screen |
|---|---|---|
| 0.0–3.4 | Hook | The three word blocks, then the morph into timeline clips |
| 3.4–8.4 | Build | The timeline tilts into 3D and fills. "Build video editors. Not video editor plumbing." Proof chip: 4,464-clip, 125-minute timeline |
| 8.4–13.4 | Commands | A code card types `clip/add`, `transition/add` and `effect/add`. Each one lands on the timeline; `undo()` lifts the fx badge off and `redo()` puts it back |
| 13.4–18.9 | Effects | A counter runs to 79 while a monitor cycles real catalog effects (Teal & Orange, Noir, Cyberpunk … Duotone) |
| 18.9–23.9 | Agent | "Make the intro punchier." runs `clip/trim`, `clip/move` and `transition/add`, and the clips ripple tight |
| 23.9–26.4 | Export | The playhead is the progress bar. MP4 · WebM · Browser · Worker · Node |
| 26.4–30.0 | End card | A flash, then the hexagon mark, **Miraiclip**, the tagline, a **miraiclip.com** pill and "Open source · MIT". Held from 28.6 s |

Every claim comes from the repo README: 79 effects, commands with undo and redo, MP4/WebM export in the browser, a worker or Node, the MCP server, and MIT. The 4,464-clip, 125-minute stress test comes from `../miraiclip-launch`. The logo is `docs/public/images/logo.svg`.

## Run

```sh
node build.mjs && node ../../../scripts/mc.mjs check video.miraiclip.json
node ../../../scripts/mc.mjs stills video.miraiclip.json --at 0.6,2.9,6.5,10,16,21,25.4,29 --sheet
node render.mjs            # high quality, about 31 s on 4 workers → out/miraiclip.mp4
```

| File | What it is |
|---|---|
| `timeline.mjs` | `T`, the beats; the picture and the score both read it (120 BPM from 0.4 s) |
| `film/10-world.js` | The 3D timeline: panel, lanes, clips, transitions, the fx badge, the playhead |
| `film/20-overlay.js` | The hook words, code card, effects monitor, assistant, export card, end card, HUD and light |
| `film/60-main.js` | Camera keys, the painters, the subject, the rest, labels and hits |
| `audio.mjs` | The score |

## Validated output

`out/miraiclip.mp4`: 1920×1080, 30 fps, 900 frames, 30.0 s. AAC audio at −16 LUFS with a −1.9 dBTP true peak. No black frames. Hard cuts appear only at the five planned places: the three word slams and the export flash. `mc check` is clean.
