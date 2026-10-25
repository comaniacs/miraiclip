---
name: reformat
description: Turn the open project into another aspect ratio or platform version - 16:9 to 9:16 (Reels, TikTok, Shorts), 1:1 or 4:5, or a short social cut-down - re-laying out footage, titles and captions for the new frame. Use when the user wants the same video in a different shape.
---

# Reformat

Load `edit-video` first if you haven't. A reformat changes the frame, then re-lays out every clip for it. It edits this project; if the user wants to keep the original shape too, tell them to duplicate the project first (one sentence, then go on if they already said so).

## 1. Plan per clip

Read the state once and decide, for every clip:

| Clip | In the new frame |
| --- | --- |
| Footage with a subject (video/image) | Fill the frame and keep the subject centred (formulas below) |
| Footage where the whole frame matters (screen recordings, slides) | Keep `scale: 1`, and put a blurred copy behind it: the same clip on a lower track, scaled to fill, `add_effect` blur (0.04) and darken (brightness −0.2), volume 0 |
| Full-frame HTML scenes | Rewrite the template for the new size (root `width`/`height`, stack side-by-side layouts vertically, recheck font sizes): `clip/set-property` `{ template, widthPx: null, heightPx: null }` |
| Sized HTML (lower thirds, badges) and text | Move `x`/`y` into the new safe zone (`reference/craft.md` → Safe zones); break long lines |
| Captions | `fontSizeFrac` × oldH/newH × 1.2 (16:9 → 9:16: 0.055 → about 0.04), `y` → 0.7, 3 words per clip if you can rebuild them (`captions`) |

### Reframing footage

`scale: 1` fits the source inside the frame. To fill a `W×H` frame from a `sw×sh` source:

- `fill = max((W/H) / (sw/sh), (sw/sh) / (W/H))`: 16:9 → 9:16 is 3.16, → 1:1 is 1.78, → 4:5 is 2.22.
- Subject at horizontal fraction `f` of the source (0.5 = centre): `x = 0.5 + (0.5 − f) × fill`. Keep `|x − 0.5| ≤ (fill − 1) / 2`, or the frame shows an empty edge. Same for `y`.
- You can't see the footage: assume the subject is centred unless the user says otherwise, and say so.

## 2. Apply

1. `project/set-settings` with the new `width` and `height` (same fps).
2. One `apply_commands` batch with every `clip/set-property` from the plan.
3. Animated clips: keyframes on `x`/`y`/`scale` hold values from the old layout. Re-apply preset animations with `animate_clip` (they start from the new transform); scale hand-made keyframes yourself (`set_keyframes`).

## 3. Cut-downs

For a shorter social version: keep the strongest 15–30 s with the hook first, remove or `trim_clip` the rest, `close_gaps`, keep the end card. Social versions open on the most visual moment, not the title.

## 4. Check and hand off

From the state: every text and caption inside the new safe zones, nothing left at old positions, no footage showing an edge. Tell the user the new shape and length, what you assumed about subject position, and to scrub through the footage shots to check the framing.
