# Notes · Example 9 · Metrics reel

Built and checked 24 Oct 2026 in the React studio (GitHub main `8e302b7`), headless Chromium. Export is yours.

## Checks

- [x] Opens with no console errors. 61 fields.
- [x] 16:9: motion beats in `contact-sheet.png`. All four themes, one settled frame per scene, in `contact-sheet-themes.png`. 9:16: terminal and pop, one frame per scene, in `contact-sheet-vertical.png`.
- [ ] Speed 1.00 and export, on the Windows PC.

Fixed while checking:
- The SVG charts drew nothing until they had the SVG namespace (see README).
- Terminal's `> ` prompt glyph sat in front of the hero number; removed for that number.
- Pop's leading bar value was unreadable over the blue circle; it is ink now.
- The paper and pop goal rings sit on their own card.
- In 9:16, the hero moved down and the bars got more room.

## Scores (1–5)

Reference: the reference site's data components (number tickers, animated charts, progress rings). Single components, not a finished report.

| Criterion | Reference | Ours | Note |
| --- | --- | --- | --- |
| Hook | 3 | 4 | Ticker of the film's own numbers |
| Motion | 4 | 4 | Counters, drawn sparkline and chart with scan line, staggered bars, a ring that laps past 100 %, a stamp. Short of 5: no camera move into the chart |
| Typography and layout | 4 | 4 | |
| Detail | 4 | 4 | Tooltip, ranks, mini sparklines, a second lap |
| Editability | 2 | 5 | Data points are fields |
| Formats | 1 | 2 | Plus four themes |

**Verdict: passes.**

## Craft notes

- Data-driven SVG in a template: flip the y axis (`translate(0 100) scale(1 -1)`) so a field is a height. Use `preserveAspectRatio="none"` with `vector-effect="non-scaling-stroke"` so lines stay crisp at any aspect. Draw it on with a `clip-path` reveal rather than `stroke-dashoffset`, which non-scaling strokes break.
- To sync dots with a linear reveal of duration D starting at d0, point i of n has delay `d0 + D·i/(n−1)`.
- `calc(x / max(a, b, c) * 82%)` normalises bars in pure CSS.
