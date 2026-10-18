# Gallery: funky launch (43.6 s, 1920×1080, 108 BPM)

Modelled on the structure of a modern launch trailer: late-night ping → prompt typed into Claude Code → the drop (mascot on beat-synced colour flashes) → timeline building itself → "Introducing" + the real miraiclip.com hero → theme montage (real editor screenshots, one per beat) → prompt montage → landing-page proof → Export → end card with the landing page's timeline bar.

| File | What it is |
| --- | --- |
| `video.miraiclip.json` | The project: 10 animated HTML scenes, 8 image clips, music and sound effects |
| `build.mjs` | Generates the `apply_commands` batch (`cmds.json`); every delay is in beats |
| `synth.py` | Synthesizes `funk.webm` (numpy + scipy): 19 bars, drop on bar 5, breakdown before Export. Original, free to use |
| `ed0–4.jpg` | Editor UI kit screenshots, five themes (from react.miraiclip.com's launch media) |
| `land-*.jpg` | Sections of miraiclip.com rendered from `miraiclip-docs/landing` |
| `sfx-*.webm` | CC0 sound effects from the React template |
| `Geist*.woff2` | Geist and Geist Mono (SIL Open Font License) |

The editor screenshots show a frame of *Big Buck Bunny* (© Blender Foundation, CC BY 3.0); the scenes that show it carry the credit.

Render: `npx -p @miraiclip/server-export miraiclip-export video.miraiclip.json --out funky.mp4 --quality high` (needs server-export with the image-URL fix, 0.4.4+).
