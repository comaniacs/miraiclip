---
name: reformat
description: Turn a Miraiclip project into another aspect ratio or platform version - 16:9 to 9:16 (Reels, TikTok, Shorts), 1:1 or 4:5 - repositioning footage, titles and captions, through the MCP server. Use when the user wants the same video in a different shape or a cut-down for social.
---

# Reformat

Read the `edit-video` skill first. A reformat changes the frame, then re-lays out every clip for it. It edits the project in place, so first ask whether to keep the original: if yes, copy the folder (or `video.miraiclip.json` to `video-16x9.miraiclip.json`) before you start, because the MCP server always edits `video.miraiclip.json`.

## 1. Plan per clip kind

`get_state` with `include_json: true` once, and make a table: every clip, its kind, current `transform`, and what happens to it.

| Clip kind | In the new frame |
| --- | --- |
| Footage (video/image) with a subject | Fill the frame and centre the subject (formulas below) |
| Footage where the whole frame matters (screen recordings, slides) | Keep `scale: 1` (fits by width), add a blurred copy behind: duplicate the clip onto a lower track, scale it to fill, `effect/add` `blur` 0.04 plus `colorAdjust` brightness −0.2, volume 0 |
| Full-frame HTML scenes | Rewrite the template for the new size (root `width`/`height`, stack side-by-side layouts vertically, recheck font sizes). Use `clip/set-property` `{ template, widthPx: null, heightPx: null }` |
| Sized HTML (lower thirds, badges) | Keep the template; move `x`/`y` into the new safe zone; widen or shrink `widthPx` if needed |
| Text clips | Move into the safe zone; break long lines (`\n`) |
| Captions | `fontSizeFrac` relative to frame height: multiply by oldH/newH × 1.2 (16:9 → 9:16: 0.055 → ≈ 0.037–0.04), `y` → 0.7, fewer words per clip (rebuild with `mc captions --max-words 3` if you have the words) |

Safe zones for the target are in `reference/craft.md`.

### Reframing footage (tested)

`scale: 1` fits the source inside the frame. To **fill** the new frame, with source size `sw×sh` and new frame `W×H`:

- `fill = max( (W/H) / (sw/sh), (sw/sh) / (W/H) )`. 16:9 → 9:16: 3.16. 16:9 → 1:1: 1.78. 16:9 → 4:5: 2.22.
- To put the source point at horizontal fraction `f` (0 = left edge, 0.5 = centre) in the middle of the new frame: `x = 0.5 + (0.5 − f) × fill`. A speaker at the left third (`f` ≈ 0.33) in 16:9 → 9:16 gives `x` ≈ 1.03.
- Keep `|x − 0.5| ≤ (fill − 1) / 2`, or the frame shows an empty edge. Same for `y` with vertical framing.

Find `f` by looking at a `preview_frame` of the original before you change the settings.

## 2. Apply

1. `project/set-settings` with the new `width`/`height` (fps unchanged).
2. One `apply_commands` batch with every `clip/set-property` from the plan, labelled `reformat 9:16`.
3. Keyframed clips: keyframes on `x`/`y`/`scale` hold absolute values from the old layout. Re-run `mc animate` for preset animations (it rebuilds from the new transform); scale hand-made keyframe values yourself.

## 3. Cut-downs

For a shorter social version: pick the strongest 15–30 s (hook first), remove or trim the other clips, close gaps by moving later clips left, and keep the end card. Social versions open on the most visual moment, not on the title.

## 4. Review

Contact sheet of a draft at 360×640 (see `edit-video` → Review). Check that the subject stays in frame in every shot (footage reframed by a fixed `x` can drift out when the speaker moves; split the clip and set `x` per part), nothing sits in the platform UI zones, and captions are legible at phone size.

Export with a name that says the shape: `launch-9x16.mp4`.
