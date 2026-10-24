# Notes · Example 1 · Launch film

Pass 1 verified 22 Oct 2026 in the React studio (`miraiclip-react-template` at `8e302b7`, the GitHub main branch), in headless Chromium with software WebGL. Not yet checked on the Windows test PC or with the local checkout's unpushed changes.

## Definition of done

- [x] Opens from the examples folder with no console errors (both files).
- [ ] Plays at speed 1.00 in the `?perf` overlay — needs the Windows PC (headless rendering here is software-only).
- [x] Every editable value changes from the studio: 39 fields in the template form; the same params show in the inspector after **Open project…**. Exception: the timeline mock's clip names (intro.mp4, Captions…) are illustration, not copy.
- [x] One change updates every scene: product name, wordmark and both colours tested through the template form.
- [ ] Each declared format looks designed — only 16:9 so far; 9:16 is the next pass.
- [ ] Browser export matches preview — export is done by hand on the Windows PC.
- [ ] Server export matches browser export — not run yet.
- [x] Readable on a phone: smallest copy is 24 px at 1080p.
- [x] Media licences noted: Inter (SIL OFL). No other media.
- [x] SDK issues logged below, not worked around inside the example (except the font embedding, which is the documented fallback).
- [x] Craft notes logged below.

## Comparison scorecard (1–5)

Compared against the reference site's free **Product Hero** scene (5.7 s) and its home launch film. Its **Launch Video Template** is Pro and its preview opens on 25 Oct, so the like-for-like comparison is still to do. Scores come from live previews and studio frame-by-frame review, not from same-copy renders.

| Criterion | Reference | Pass 1 | Pass 2 (motion) | Pass 3 | Note |
| --- | --- | --- | --- | --- | --- |
| Hook | 4 | 4 | 4 | 4 | Both clear by second 2 |
| Motion | 5 | 3 | 4 | 5 | Pass 2: spring/expo easing, scene exits, camera push, 3D tilts, typing, counters in focus, bounce and ping. Pass 3 adds the 3D rise and dolly, and beats that overlap |
| Typography and layout | 4 | 4 | 4 | 4 | Comparable |
| Detail | 5 | 3 | 4 | 4 | Pass 2: shimmer, caret, light sweep, meters, waveform, spinner → check. Pass 3 adds a real product screenshot; the other scenes are still graphic-only |
| Editability | 2 | 5 | 5 | 5 | 44-field form with a screenshot slot, brand kit, no code |
| Formats | 1 | 1 | 1 | 2 | Ours: 16:9 and 9:16 from one source; theirs: 16:9 |
| Export fidelity | – | – | – | – | Your export on the Windows PC |
| Time to make | – | ~1 h | ~1.5 h | ~1.5 h | Pass 2 includes building the motion system, which later examples reuse |

**Verdict after pass 2: close but not passing.** Motion and detail are one point short, mostly for lack of imagery and 3D camera moves; formats are still 16:9 only.

**Verdict after pass 3: passes on everything checked here** (motion 5, detail 4, editability 5, formats 2 against their 1). Detail stays a point below because the reveal is the only scene with real imagery. Still open: your export on the Windows PC and the like-for-like comparison after 25 Oct.

## Pass 2 · motion (22 Oct)

- Reviewed frame by frame at 0.15 / 0.5 / 0.9 / 1.4 / 2.2 / 2.85 s into every scene, plus extra frames at 0.35–0.6 s for the 3D tilts.
- Fixed: the stat numbers vanished once they got a blur (see craft notes); clips springing past the timeline panel's edge (clip growth now uses expo-out, no overshoot).
- The font now loads from `https://assets.miraiclip.com/templates/miraiclip-launch/InterVariable.woff2` (R2 bucket `miraiclip-assets`), not a `data:` URL. Until it is uploaded and the domain is connected, the studio falls back to another font.

## Pass 3 · product reveal and 9:16 (23 Oct)

- New scene 2, **Product reveal** (3.6 s): the screenshot rises out of the floor in 3D (`rotateX` 46° → 0 on a spring) inside a window frame, the camera dollies across it the whole scene, the headline lands at 0.85 s while the window is still settling, two callouts pop out and float, and a glint crosses the glass once. Total length is now 24.4 s.
- New fields: *Product screenshot* (a media slot; the form shows it under Media), reveal headline, two callouts and an image credit. 44 fields in all.
- The screenshot is an `image` asset drawn inside the HTML through `asset:shot`, so the template's asset field swaps it. Assets now carry licence data (OFL for Inter, CC BY 3.0 for the sample screenshot), which the export dialog's commercial-use check reads.
- **9:16 version**, built from the same scenes with per-scene overrides: `miraiclip-launch-vertical.*`. Checked one settled frame per scene; content sits in the middle of the frame with 80 px side margins.
- Fixed in the studio preview: a duplicated callout and a dark ghost panel in the reveal scene. Both came from the 3D layers: dropping `preserve-3d` cured the duplicate. The ghost also shows for a moment right after seeking, then clears, so it looks like a stale preview raster rather than part of the frame. Watch for it in your export; it should not appear.
- Sample screenshot: the Miraiclip editor from `examples/gallery/funky-launch/ed0.jpg`. It shows a frame of Big Buck Bunny, hence the credit line, which is a field you can clear.

## Findings for the SDK and studio

1. **Relative asset paths break on import.** The gallery file names its font `InterVariable.woff2`; opened in the studio, that resolves against the studio's origin and 404s, so the video silently falls back to another font. Fix here: assets live in R2 and the JSON uses absolute URLs. A missing font only logs an error; the studio could flag it like missing media.
2. **`clip/set-property` silently drops unknown keys.** Passing `animations` did nothing and returned ok; the background's Ken Burns move vanished without an error. Agents need a strict schema or a warning. Use `keyframe/set`.
3. **Brand kit covers colours and fonts, not words.** Product name, tagline and URL in a brand kit don't reach html params. Mapping params named `brand`/`name`, `tagline` and `url` (like the colour roles) would make "change the name once" work for any project, not only for templates.
4. **Per-word kinetic type conflicts with editable text.** Staggered word animations need the words split at build time, which a `{{field}}` can't be. A rasterizer helper (e.g. `data-split="words"` giving each word `--i`) would bring the stagger back for editable text.
5. **Inspector shows raw param names** (`hookLine1`) after **Open project…**; the template form shows the labels. Carrying field labels into the doc (or reading them from the template) would fix it.
6. **Preview seeking can show a stale raster for a moment** in scenes with 3D transforms (a dark panel that clears after about a second). Not seen once settled.
7. **The studio already ships 69 built-in templates** (launch 4, features 5, proof 6, social 7, metrics 3, pricing 4, intro 3, ending 2, events 2, lower-third 2). The example backlog should audit and upgrade these rather than start from zero.

## Craft notes

- Bind every user-facing string to a field; name colour params by brand role (`primary`, `secondary`) so the brand kit and the form both work.
- Without per-word splits, a line-level rise + un-blur, plus a clip-path wipe on the accent line, keeps most of the energy.
- Counters work with an editable target: `--to:{{stat}}` on a registered `@property` integer.
- `color-mix(in srgb, {{primary}} 38%, #0a0d18)` lets a background glow follow the brand colour.
- Several animations on one element share one start time (`--d`). To stage a pop and a later press on one chip, write them as one keyframe sequence; to stage a spinner then a check, use separate elements.
- Never put `filter` or `opacity` animations on text inside a `background-clip:text` parent: the child becomes its own layer and disappears. Animate the clipping parent instead.
- Spring overshoot is wrong for anything that must stay inside a frame (bars filling a track); use expo-out there.
- 3D (`perspective()` + `rotateX/Y`) renders correctly in the rasterizer and sells depth cheaply.
- A scene-level exit (`.x`) plus a short 0.3 s dissolve reads cleaner than a long dissolve between two busy scenes.
