# Motion: presets and keyframes

Two ways to move things:

| Moving… | Use |
| --- | --- |
| A whole clip (footage, photo, logo, a static HTML card, a caption block) | Animation presets via `mc animate`, or `keyframe/set` |
| Parts inside a title or graphic (words, cards, bars, counters) | CSS `@keyframes` in an animated HTML clip (see `html-recipes.md`) |

## Animation presets

In a Miraiclip editor, the `animate_clip` tool takes these same presets (`in`, `loop`, `out`, `easing`), on the clip as it is now; the `mc` commands below are for Claude Code.

The same presets as the Miraiclip editor's animation panel. A recipe has up to three slots: **in** (from the clip's start), **loop** (between in and out), **out** (into the end, end-anchored so it follows trims).

```bash
MC="node ${CLAUDE_PLUGIN_ROOT}/scripts/mc.mjs"
$MC presets                                              # list them
$MC animate --clip title --in up --out fade              # 600 ms in, 500 ms out, smooth
$MC animate --clip logo --in pop --in-ms 500 --easing snappy
$MC animate --clip photo-1,photo-2,photo-3 --loop kenburns
$MC animate --clip badge --in zoom --loop pulse --out fade
$MC animate --clip title                                 # no slots: removes the animation
```

| Slot | Presets |
| --- | --- |
| in / out | `fade`, `up`, `down`, `left`, `right` (slide 12% of the frame + fade), `zoom` (from 60%), `spin`, `pop` (0 → 110% → 100%) |
| loop | `pulse` (scale ±6%, 1.2 s), `float` (y ±2%, 2 s), `sway` (±3°, 2.4 s), `kenburns` (scale +15% and drift over the clip) |
| easing | `smooth` (ease-out in, ease-in out), `snappy` (fast start, long settle), `linear` |

- The command reads the **saved** project file, so `apply_commands` the clip first, then run `animate`, then `apply_commands` its output. Presets animate from the clip's current `transform`, so set position and scale first.
- Applying a recipe replaces the clip's visual keyframes (x, y, scale, rotation, opacity). Volume keyframes stay.
- In and out share the clip: if they don't fit, both shrink.

## Hand-made keyframes

```json
{ "type": "keyframe/set", "payload": { "clipId": "photo", "property": "scale", "timeUs": 0, "value": 1, "easing": "easeOut" } }
{ "type": "keyframe/set", "payload": { "clipId": "photo", "property": "scale", "timeUs": 4000000, "value": 1.2 } }
{ "type": "keyframe/set", "payload": { "clipId": "photo", "property": "opacity", "timeUs": 400000, "anchor": "end", "value": 1, "easing": "easeIn" } }
{ "type": "keyframe/set", "payload": { "clipId": "photo", "property": "opacity", "timeUs": 0, "anchor": "end", "value": 0 } }
```

- Properties: `x`, `y`, `scale`, `rotation` (degrees), `opacity`, `volume`.
- `timeUs` is relative to the clip's start, or with `anchor: "end"`, measured back from its end.
- The easing on a keyframe shapes the segment **leaving** it. Values: `linear`, `hold`, `easeIn`, `easeOut`, `easeInOut`, or a bezier `{ "kind": "bezier", "x1": 0.2, "y1": 0.8, "x2": 0.2, "y2": 1 }`.
- `keyframe/clear` with a `property` removes all keyframes of that property.

## Useful moves

| Move | How |
| --- | --- |
| Punch-in on a talking head (hide a jump cut) | `clip/set-property` `{ "transform": { "scale": 1.15 } }` on every other segment. Static, not animated. Keep the face in frame: adjust `y` a little (0.45–0.48) if the head gets cut |
| Slow push-in on a photo or wide shot | `--loop kenburns`, or scale 1 → 1.1 over the clip, `linear` |
| Picture-in-picture | `transform: { "x": 0.8, "y": 0.78, "scale": 0.32 }` on an upper track, plus `effect/add` `roundedCorners`, then `--in pop` |
| Split screen | Two clips on two tracks, `x: 0.25` and `x: 0.75`, `scale` so each fills half; crop is not available, so use footage that frames well |
| Logo sting | Logo image clip, `--in pop --easing snappy`, then `--loop pulse` only if it stays on screen > 3 s |
| Music duck under a line of voice | `volume` keyframes: 0.8 → 0.2 over 300 ms before the line, back to 0.8 over 500 ms after |
