# Scorecard, notes and metadata

## Rubric

Score 1–5 for the template and for the closest reference in its category (a template or component that does the same job). Compare like for like: the same copy, the same accent colour, about the same length.

| Criterion | What to check | Bar to pass |
| --- | --- | --- |
| Hook | Is the message clear by second 2? | Equal or better |
| Motion | Easing, timing, holds, no jank or pops; every scene keeps moving after it lands | Equal or better |
| Typography and layout | Hierarchy, spacing, safe margins, in every theme and both formats | Equal or better |
| Detail | Depth, micro-motion, transitions between beats | Equal or better |
| Editability | Can a non-coder change every word, image, number and colour? | Better: every visible word, image and data point is a field |
| Formats | How many shapes look designed, not cropped | Better: at least 2 (16:9 and 9:16), plus four themes |
| Export fidelity | Export matches the preview | Export = preview (the user checks this on their machine) |

A template **passes** when the first four are equal or better and editability and formats are better.

What keeps a 4 from being a 5 on motion is usually the camera: a move into the area that matters (a zoom into the chart, a dolly through the wall). Note that as the next improvement rather than blocking on it.

## notes.md

```markdown
# Notes · <Title>

Built and checked <date> in the React studio (<commit>), headless Chromium. Export is yours.

## Checks

- [x] Opens with no console errors; <n> fields.
- [x] 16:9 motion beats (`contact-sheet.png`); all four themes, one settled frame per scene (`contact-sheet-themes.png`); 9:16 in <themes> (`contact-sheet-vertical.png`).
- [ ] Speed 1.00 and export, on the user's machine.

Fixed while checking: <one line each>.

## Scores (1–5)

Reference: <what it was compared with, described by category; internal only>.

| Criterion | Reference | Ours | Note |
| --- | --- | --- | --- |
| Hook | | | |
| Motion | | | |
| Typography and layout | | | |
| Detail | | | |
| Editability | | | |
| Formats | | | |

**Verdict: passes / not yet.**

## Craft notes

- <a new pattern or pitfall, in one or two lines; also add it to reference/patterns.md>
```

## template.json

Catalog metadata that the template library website reads later:

```json
{
  "id": "metrics-reel",
  "title": "Metrics reel",
  "goal": "report-and-present",
  "type": "results",
  "formats": ["16:9", "9:16"],
  "themes": ["terminal", "midnight", "paper", "pop"],
  "defaultTheme": "terminal",
  "durationSec": 24,
  "style": ["data-viz", "kinetic-type"],
  "pace": "steady",
  "industry": ["saas", "any"],
  "startFrom": ["numbers"],
  "fields": 61,
  "assets": [{ "url": "https://assets.miraiclip.com/templates/_shared/", "license": "SIL OFL 1.1" }],
  "source": "new"
}
```

| Key | Values |
| --- | --- |
| `goal` | `launch`, `show-how-it-works`, `build-trust`, `report-and-present`, `grow-on-social`, `explain-and-teach`, `celebrate-and-connect` |
| `pace` | `calm`, `steady`, `energetic` |
| `startFrom` | `text`, `screenshots`, `numbers`, `footage`, `recording` |
| `assets` | One entry per file or shared folder, with its licence (and the credit, if the licence needs one) |
