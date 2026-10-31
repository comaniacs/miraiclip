# Kiteline

An invented SaaS product, **Kiteline**, for planning, writing and scheduling social posts with AI. This folder holds two things:

1. **`app/`, a working website.** It has a content calendar (month and week), a prompt studio, an editor with a live preview, and scheduling. Everything is connected through one state model and saved in `localStorage`.
2. **The launch film.** It is 30 s at 1920×1080 and 30 fps, made from HTML, CSS 3D and the real app, with no three.js or WebGL. Every frame mounts the same app code and replays scripted clicks and typing on its real elements, so the UI on screen is the app actually responding.

The brand, script, storyboard, 3D and sound direction are in [PRODUCTION.md](./PRODUCTION.md).

## Run the website

There is no build step. Serve the folder and open it:

```sh
cd app && python3 -m http.server 5173   # then open http://localhost:5173
```

Opening `app/index.html` directly also works, but most browsers block the clipboard on `file://`, and the app then says so.

URL options:
- `?today=2026-11-09` pins the date the film uses.
- `?reset` clears saved posts.

The workflow:
1. Pick a date on the calendar and choose **Create post**.
2. Describe the idea, then choose platform, audience, tone, goal and optional keywords.
3. **Generate prompt** to get an editable, structured prompt you can copy or regenerate.
4. **Write post from prompt** to get a draft in the editor.
5. Edit the caption and watch the live preview and the character count update. Switch platform and pick media.
6. **Save draft** or **Schedule**. The post appears on its date with its status.

## Test the website

```sh
node --test app/test/*.test.mjs   # 13 unit tests: dates, reducer workflow, validation, generator, immutability
node app/test/e2e.mjs             # 12 end-to-end checks in Google Chrome via playwright-core (from the repo)
```

## Render the film

From the repo root, once: `pnpm install`. You need Google Chrome and ffmpeg (`pnpm preflight`). Then, from this folder:

```sh
node build.mjs                                                  # app/ + film/ + timeline.mjs → sequence.html, video.miraiclip.json
node ../../../scripts/mc.mjs check video.miraiclip.json         # every scripted action finds its element; the window stays in frame
node ../../../scripts/mc.mjs stills video.miraiclip.json --at 6,12.3,18,23.5,29.5 --sheet
node render.mjs --draft                                         # quick picture + score + mux + validation
node render.mjs --blur                                          # the final, with motion blur
```

## How the film is built

The film runs on the shared [app-film kit](../_lib/app-film/README.md): the replay engine, camera maths, cursor, accent line, base CSS, synthesizer, render-and-validate and the browser-test helper. This folder holds only what is particular to Kiteline.

| File | Role |
|---|---|
| `timeline.mjs` | The beats and the `ACTIONS` list (every click and keystroke). Both the picture and the sound read it. |
| `film/10-replay.js` | Hands the real Kiteline app to the kit's replay: a fresh mount each frame, every action up to `t`, snapshots of real panels. |
| `film/20-world.js` | The 3D layer: idea cards (five are the real seed posts and land on their real chips), day tiles on the real cell rects, carry cards between screens, the lifted plan, and the hero panels. |
| `film/60-camera.js` | The camera keys. `dist 1600` at yaw 0 / elev 0 shows the app frontally at 1:1 (the "2D" view); the rest orbits it. |
| `film/70-overlay.js` | This film's moments: where the cursor shows, the prompt reveal, the preview highlight, the landing glow, the three uses of the coral line, and the headlines. |
| `film/90-main.js` | The frame, the subject check, the declared rest, labels and hits. |
| `audio.mjs` | The original synthesized score. UI sounds are placed from `ACTIONS`. |

## Validated output

These are measured from the written `out/kiteline.mp4` by `render.mjs` and ffmpeg:

| Property | Result |
|---|---|
| Video | H.264, 1920 × 1080, 30/1 fps, 900 frames, 30.000 s, with motion blur |
| Audio | AAC 48 kHz stereo, 30.000 s, −15.3 LUFS integrated, true peak −1.7 dBFS |
| Hard cuts | None. The largest frame-to-frame scene score is 0.056; a cut scores 0.3 or more |
| Black frames | None (`blackdetect`) |
| Shot check | `mc check`: clean. All 16 scripted actions find their real element; the window stays in frame; the 28.8–30 s rest holds still |

## What is real and what isn't

- **AI: demo only.** The prompt and draft come from a local, deterministic generator built from your inputs. The app labels it "Demo AI · runs in your browser". No model or API is connected.
- **Publishing: none.** Scheduling changes the app's own state and calendar only. Nothing is sent to LinkedIn, Instagram or X. Previews are approximate layouts in Kiteline's own style, with no official logos or interfaces.
- **Names: invented.** Kiteline, Fieldnote and all post content are invented. A real launch would need a trademark search.
- **Typing in the film is mirrored into the markup.** The exporter captures the DOM, not live form state. So after each real `input` event, the film copies the field's value into its markup. The app's state and preview update from the event itself.
