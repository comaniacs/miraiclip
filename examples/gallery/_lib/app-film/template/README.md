# __TITLE__

A launch film for __TITLE__, made from the real app with the app-film kit (`../_lib/app-film`). There is no WebGL: it is HTML, CSS 3D and the app's own code.

## Run

```sh
node --test app/test/*.test.mjs                               # the app's logic
node app/test/e2e.mjs                                         # the website in Chrome
node build.mjs                                                # → sequence.html, video.miraiclip.json
node ../../../scripts/mc.mjs check video.miraiclip.json       # every action finds its element; the window stays in frame
node ../../../scripts/mc.mjs stills video.miraiclip.json --at 1,4,6,8.5,14 --sheet
node render.mjs --blur                                        # the final: picture, score, mux, validation, timings
```

## Files

| File | What to change |
|---|---|
| `app/` | The product: `core.js` (model and reducer), `ui.js` (`mount(el, opts)`), `styles.css` (scoped) |
| `timeline.mjs` | The beats and `ACTIONS`, the clicks and typing the viewer watches |
| `film/10-scene.js` | The camera keys and the film's own moments |
| `build.mjs` | The stage, the headlines and the lockup |
| `audio.mjs` | The score |
