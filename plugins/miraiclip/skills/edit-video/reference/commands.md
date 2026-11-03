# Commands (short reference)

The source of truth is `get_command_schema` on the live server. Times are integer microseconds. `?` = optional.

## Project, assets, tracks

| Command | Payload |
| --- | --- |
| `project/set-settings` | `{ width?, height?, fps?, name? }` |
| `asset/add` | `{ id, kind: "video"\|"audio"\|"image"\|"font", src, durationUs?, width?, height?, fps?, name? }`; fonts: `family`, `weight?`, `style?`, `weightRange?`; provenance: `source?`, `license?`, `attribution?` |
| `asset/remove` | `{ id }` (fails while a clip uses it) |
| `track/add` | `{ id, kind: "video"\|"audio", name?, index? }` (later = on top) |
| `track/remove` / `track/rename` / `track/reorder` | `{ id }` / `{ trackId, name }` / `{ trackId, index }` |
| `track/set-property` | `{ trackId, muted?, solo?, locked?, hidden? }` |

## Clips

`clip/add` payload by `kind` (all take `id`, `trackId`, `startUs`, `durationUs`, `transform?: { x, y, scale, rotation, opacity }`):

| kind | Extra fields |
| --- | --- |
| `video` | `assetId`, `trimStartUs?` (in-point in the file), `volume?`, `fadeInUs?`, `fadeOutUs?` |
| `audio` | same as video (goes on an audio track) |
| `image` | `assetId` |
| `text` | `text` (`\n` for lines), `fontFamily?`, `fontSizePx?` (48), `color?`, `fontWeight?`, `fontStyle?`, `lineHeight?`, `letterSpacing?` (em), `textAlign?`, outline `strokeColor?` / `strokeWidthFrac?`, shadow or glow `shadowColor?` / `shadowBlurFrac?` / `shadowOffsetFrac?` (fractions of font size; offset 0 = glow; `null` on `clip/set-property` removes) |
| `caption` | `words: [{ text, startUs, durationUs }]` (times relative to the clip), `style?` (see below) |
| `html` | `template`, `params?`, `widthPx?`, `heightPx?`, `animated?`, `animationOffsetUs?` |

Caption `style`: `preset` (`plain`, `highlight`, `karaoke`, `pop`, `reveal`), `display` (`block`\|`word`), `fontFamily`, `fontSizeFrac` (0.06 = 6% of frame height), `fontWeight`, `color`, `highlightColor`, `backgroundColor`, `activeBackgroundColor`, `textTransform` (`uppercase`), `strokeColor`, `strokeWidthFrac`, `shadowColor`, `shadowBlurFrac`, `shadowOffsetFrac`, `lineHeight`, `letterSpacing`. Style merges on `clip/set-property`; `null` clears optional fields.

| Command | Payload |
| --- | --- |
| `clip/remove` | `{ clipId }` |
| `clip/move` | `{ clipId, startUs?, trackId? }` |
| `clip/trim` | `{ clipId, startUs?, durationUs?, trimStartUs? }` |
| `clip/split` | `{ clipId, atUs, newClipId? }` (`atUs` is timeline time) |
| `clip/duplicate` | `{ clipId, newClipId?, startUs?, trackId? }` |
| `clip/set-property` | `{ clipId, …fields of its kind }`: `transform` merges; html: `template`, `params` (merge), `unsetParams`, `widthPx`/`heightPx` (`null` = composition size), `animated`; custom kinds: `props` (merge), `unsetProps` |
| `clip/set-speed` | `{ clipId, speed, keepDuration?, ripple? }`: video/audio, 0.0625–16 (0 = freeze, video only). Default keeps the footage, so the length changes; `keepDuration: true` keeps the length; `ripple: true` moves later clips on the track |
| `clip/freeze` | `{ clipId, atUs, durationUs, freezeClipId?, rightClipId?, ripple? }`: hold the frame at `atUs` (timeline time; the clip's end holds its last frame). Splits the clip and pushes the rest of the track back unless `ripple: false` |

There is no ripple delete. To remove a section and close the gap, `clip/split` at both ends, `clip/remove` the middle, and `clip/move` every later clip left by the removed length, or rebuild the sequence with `mc recut`.

## Keyframes, effects, transitions

| Command | Payload |
| --- | --- |
| `keyframe/set` | `{ clipId, property: x\|y\|scale\|rotation\|opacity\|volume\|blur\|reveal, timeUs, value, easing?, anchor?: "start"\|"end" }` |
| `keyframe/remove` | `{ clipId, property, timeUs, anchor? }` |
| `keyframe/clear` | `{ clipId, property? }` |
| `effect/add` | `{ clipId, kind, params?, enabled?, index?, effectId? }` |
| `effect/update` | `{ clipId, effectId, params?, enabled?, region? }` (params merge; `region: null` = whole clip) |
| `effect/set-region-keyframe` | `{ clipId, effectId, property: x\|y\|width\|height, timeUs, value, easing?, anchor? }` |
| `effect/clear-region-keyframes` | `{ clipId, effectId, property? }` |
| `effect/remove` / `effect/reorder` | `{ clipId, effectId }` / `{ clipId, effectId, index }` |

Keyframe values: `x`/`y` and `scale` as the clip's transform; `blur` is a blur over the whole clip as a fraction of the frame height (0–0.25, rests at 0); `reveal` is the share of a text clip's characters that show (0–1, text only, rests at 1). The animation presets Blur (in/out) and Typewriter (in, text) are keyframes on these.

`effect/add` takes `region?: { x, y, width, height, shape?: "rect"|"ellipse", feather?, invert? }` (fractions of the CLIP's frame, top-left origin) to apply the effect to part of the clip only: `blur` or `pixelate` a password field, or `colorAdjust` with `brightness: -0.5` and `invert: true` for a spotlight. The region follows the clip through zooms and moves.

Effect ids are generated unless you pass `effectId` in `effect/add`. Pass one (e.g. `"grade"`) so you can update it later without reading the project JSON.
| `transition/add` | `{ kind, fromClipId, toClipId, durationUs, params?, id? }` |
| `transition/update` / `transition/remove` | `{ transitionId, durationUs?, params? }` / `{ transitionId }` |

Transition kinds: `crossDissolve`, `dipToBlack`, `dipToWhite`, `wipe` and `slide` (`params.direction`: `left`, `right`, `up`, `down`).

## Markers and plugins

| Command | Payload |
| --- | --- |
| `marker/add` | `{ id?, timeUs, label, durationUs?, data? }`: a chapter, tutorial step or note (doesn't render) |
| `marker/update` | `{ markerId, timeUs?, label?, durationUs?\|null, data?\|null }` |
| `marker/remove` | `{ markerId }` |
| `plugin/add` | `{ name, version, url, integrity?, replace? }`: a plugin module whose custom kinds the document uses (the server must run with `--allow-plugins`) |
| `plugin/remove` | `{ name }` |

## Effect kinds (param = default)

| Category | Kinds |
| --- | --- |
| color | colorAdjust(brightness=0, contrast=0, saturation=0, hue=0), mono(intensity=1), invert, warm(intensity=1), cool(intensity=1), hueShift(hue=90), vibrance(amount=0.5), exposure(stops=0.5), contrastCurve(intensity=0.7), gamma(gamma=1.4), channelSwap, duotone(intensity, shadow=#1e1b4b, highlight=#f472b6), gradientMap(intensity, dark, mid, light), colorPop(intensity, color=#ef4444, tolerance=0.08), solarize, threshold, posterize(levels=4) |
| film | sepia, vintage(0.8), polaroid, kodachrome, technicolor, thermal, grain(intensity=0.3), tealOrange, noir, bleachBypass, crossProcess, faded, matte, goldenHour, moonlight, cyberpunk, vaporwave, cyanotype, infrared, lomo, nightVision (all `intensity`, default 1) |
| stylize | pixelate, halftone, dotMatrix, crosshatch, neonEdges(intensity, color), sketch, emboss, sharpen(amount=0.8), toon, oilPaint, hexPixelate, retro8bit, dither, frostedGlass |
| glitch | rgbSplit, scanlines, crt, vhs, glitch, tvStatic, lensFringe |
| light | blur(amount=0.02), vignette(intensity=0.6, size=0.5), glow(intensity=0.6, radius, threshold=0.55), dreamy, tiltShift(blur, focus=0.5, band=0.25), zoomBlur, motionBlur(distance, angle=0), colorVignette(intensity=0.8, color=#7c3aed, size=0.5), lightLeak(intensity=0.8, color=#ff7a18) |
| distort | fisheye, pinch, swirl, wave, ripple, mirrorX, mirrorY, kaleidoscope |
| frame | chromaKey(color=#00ff00, similarity=0.4, smoothness=0.1, spill=0.1), letterbox(size=0.12), roundedCorners(radius=0.08) |

Sizes are fractions of the frame. Film looks at intensity 1 are strong: start at 0.2–0.4.

## Errors

A failed `dispatch` / `apply_commands` changes nothing. `apply_commands` reports `failedIndex` and the error:

| `kind` / code | Fix |
| --- | --- |
| `unknown-command` | Use a type from `list_commands` |
| `invalid-payload` | Per-field issues listed; check `get_command_schema` |
| `clip-not-found`, `track-not-found`, `asset-not-found`, `effect-not-found`, `transition-not-found`, `keyframe-not-found` | Read ids from `get_state` (or `get_project_json` for effect ids); earlier commands in the same batch count |
| `duplicate-id` | Pick a new id |
| `not-adjacent`, `different-tracks`, `duplicate-boundary` | Transition clips must touch on one track; one transition per cut |
| `insufficient-handles` | Trim the clips so each has half the transition's length of extra media past the cut, or shorten the transition |
| `not-html`, `not-text` | That field belongs to another clip kind |
| `font-needs-family` | Font assets need `family` |
