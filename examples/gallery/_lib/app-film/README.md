# app-film kit

Launch films made from a **real web app**: HTML, CSS 3D and the app's own code, with no WebGL. Each frame mounts the app fresh and replays scripted clicks and typing on its real elements, so the UI on screen is the app actually responding. A camera rig adds the 3D views around it.

Used by `launch-kiteline`. Moving it onto the kit didn't change its frames (PSNR 87 dB to ∞ against the original code).

## Start a new film (about 5 seconds)

```sh
node examples/gallery/_lib/app-film/new.mjs my-product --title "Acme" --headline "…" --headline2 "…" --tagline "…" --cta "Try Acme"
cd examples/gallery/my-product
node --test app/test/*.test.mjs && node app/test/e2e.mjs      # the template app: 4 unit tests, 4 browser checks
node build.mjs && node ../../../scripts/mc.mjs check video.miraiclip.json
node ../../../scripts/mc.mjs stills video.miraiclip.json --at 1,4,6,8.5,14 --sheet
node render.mjs --blur                                        # the 15 s template renders with motion blur in about 32 s
```

Then replace the parts that make it your product:

| File | Change |
|---|---|
| `app/js/core.js` | The model and the reducer: `initialState(opts)` and `reduce(state, action)`. Keep them pure. |
| `app/js/ui.js` | `mount(el, opts)`. Buttons carry `data-act`, inputs carry `data-field`. Text fields update state without re-rendering. |
| `app/styles.css` | Scoped under the app's root class. Keep the `:where()` resets. |
| `timeline.mjs` | `T` (the beats) and `ACTIONS` (what the viewer watches someone do) |
| `film/10-scene.js` | The camera keys and the film's own moments |
| `build.mjs` / `audio.mjs` | The stage, the type and the score |

## What the kit provides

| Module | Provides |
|---|---|
| `build.mjs` | `buildAppFilm(url, opts)`: app, kit, film scripts and base CSS → `sequence.html` + `video.miraiclip.json`. `cap()` for headlines. |
| `browser/film-core.js` | Easing, monotone keyframe curves, `camTransform` / `project` / `camPos`, `filmCamera(keys, probes)` |
| `browser/replay.js` | `appReplay({ slot, bar, mount, actions })` → `replay(t)`, `rect(el)`, `q(sel)`. Action kinds: click, type, retype, focus. Snapshots via `cap`. |
| `browser/overlay.js` | `place`, `w2w`, `flyClone`, `heroClone`, `poseCursor`, `revealMask`, `underline`, `drawLine`, `lineIO`, `fadeIO`, `scrimAt` |
| `timeline.mjs` | `retypeAt`, `keyTimes`, `validateActions` (catches bad actions before the build) |
| `audio.mjs` | `createScore(dur)`: `ep`, `click`, `key`, `shimmer`, `whoosh`, `bell`, `kick`, `uiFromActions`, `write` |
| `render.mjs` | `renderFilm(url, { name, T })`: picture, score, mux, then 7 checks on the written file, with timings |
| `e2e.mjs` | `openApp(url)` → `check`, `text`, `done` in Chrome via playwright-core |
| `new.mjs` | The scaffold, from `template/` |

## Lessons built in

Each of these cost a debugging round once and now can't recur:

- **CSS resets are wrapped in `:where()`.** A plain reset out-ranked component classes and stripped buttons of their padding and borders.
- **`#world`'s child rule excludes `#win`.** A generic `left:0; top:0` moved the window off-centre.
- **The floor lives in its own 3D context (`#ground`).** Chrome sorted a large floor plane in front of the product.
- **Typed values are mirrored into the markup.** The exporter captures the DOM, not live form state, so fields looked empty.
- **The focused field gets `.is-focused`.** A background tab never shows `:focus`.
- **Transitions and animations inside the window are off.** Every frame must be a pure function of `t`.
- **The mux runs `alimiter` after `loudnorm`.** loudnorm alone let the AAC encode reach a true peak of 0 dBFS.
- **The e2e `text()` drops icon buttons.** A toast's × made correct assertions fail.
- **`validateActions` checks the action list first.** An overlap or a typo fails at build time, not mid-render.

## Tests

```sh
node --test examples/gallery/_lib/app-film/test/   # 8 tests: timeline helpers, camera maths, the synth, the scaffold and its build
```
