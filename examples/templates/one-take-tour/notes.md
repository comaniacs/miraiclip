# Notes · One-take product tour

Built and checked 26 Oct 2026 in the React studio (GitHub main `8e302b7`), headless Chromium. Export is yours.

## Checks

- [x] Opens with no console errors; 37 fields.
- [x] Motion beats across the take (`contact-sheet.png`). All four themes, one settled frame per beat, in 16:9 (`contact-sheet-themes.png`) and 9:16 (`contact-sheet-vertical.png`).
- [x] Long copy: every field at its maxLength in terminal and pop 16:9 and paper 9:16.
- [ ] Speed 1.00 and export, on the Windows PC.

Fixed while checking:
- The hook framing was too tight, so the line was cropped.
- The 9:16 hook didn't wrap (no break opportunity between phrases); fixed with `<wbr/>` between phrases.
- The preview kept tile 2's colour grade.
- Menu labels wrapped in terminal at maximum length. The menus are wider now, labels don't wrap, and the cursor's toggle targets moved to match.
- The pop end card's wordmark is smaller so a 16-character name fits.

## Scores (1–5)

Reference: the user's reference clip (an agent product film, one take), for direction only.

| Criterion | Ours | Note |
| --- | --- | --- |
| Hook | 4 | Phrase build around a glyph, then the greeting |
| Motion | 5 | One continuous camera, cursor-driven, the box grows into the app, whip moves with motion blur |
| Typography and layout | 4 | |
| Detail | 5 | Hover states, toggles, ripples, scan-line tiles, a playhead, a toast |
| Editability | 5 | 37 fields including the image; long copy fits |
| Formats | 4 | 9:16 has its own camera plan; the composer section leaves empty space below it |

**Verdict: passes.**

## Craft notes

- Put a `<wbr/>` between inline-block phrases, or they can never wrap.
- A camera plan reads best as hold → move → hold. Every move gets its own ease, and a whip gets a `blur` stop in the middle.
- Time the UI's reactions to the cursor's click times, and arrive the camera just before the action, not after.
