# Notes · Example 5 · Product tour

Built and checked 24 Oct 2026 in the React studio (GitHub main `8e302b7`), headless Chromium. Export is yours.

## Checks

- [x] Opens with no console errors; 36 fields, including the screenshot slot.
- [x] 16:9 checked at three moments per scene (`contact-sheet.png`); 9:16 one frame per scene (`contact-sheet-vertical.png`); all four themes one frame per scene (`contact-sheet-themes.png`).
- [ ] Speed 1.00 and export — on the Windows PC.

Fixed while checking: hotspot 2's label crossed hotspot 1's in 9:16 (moved the pin down); the pop theme's two background circles covered 9:16 headlines (smaller and pushed into the corners, in the kit, so every template's pop variant changed).

## Scores (1–5)

Reference: the reference site's Screens & Devices and Cursor & Clicks components (Phone Frame, Laptop Frame, Cursor Track, Tap Through) — single shots, no finished tour.

| Criterion | Reference | Ours | Note |
| --- | --- | --- | --- |
| Hook | 4 | 4 | |
| Motion | 5 | 4 | Spotlight glide, staggered hotspots with pings, drawn connectors, tap ripple and sheet. Short of 5: no camera zoom into each spotlight area |
| Typography and layout | 4 | 4 | |
| Detail | 4 | 4 | Real screenshot, pulsing rings, checks, phone UI |
| Editability | 2 | 5 | 36 fields, screenshot slot, theme |
| Formats | 1 | 2 | Plus four themes |

**Verdict: passes.**

## Craft notes

- A spotlight is one element with a huge `box-shadow` spread (`0 0 0 2400px #000a`) inside the window's `overflow:hidden`; animate its `left/top/width/height` through keyframe stops to glide between areas.
- Show-then-hide captions: outer element fades in at its start, inner fades out at its own `--d`.
- Coordinates of areas are written in the screenshot's own pixel space (1260×708 here), offset by the window bar, and scaled by 0.762 for the 9:16 window.
