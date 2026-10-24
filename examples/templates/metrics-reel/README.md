# Example 9 · Metrics reel

A 24 s results film in 16:9 and 9:16 and four themes:
1. A hook with a ticker of the film's own numbers.
2. A hero number that counts up over a drawn sparkline.
3. A line chart that draws itself from six editable points, with a scan line and a tooltip on the last value.
4. Ranked bars that grow to their share of the leader.
5. Four KPI tiles with mini sparklines.
6. A goal ring that laps past 100 % and gets a stamp.
7. An end card.

Every number, label, chart point, both colours and the theme are fields (61). Change the period and the numbers and the same film reports any month or quarter.

| Where | File | What it is |
| --- | --- | --- |
| here | `build.mjs` | Fields and scenes; uses `../_kit.mjs` |
| here | `metrics-reel*.miraiclip.json` | Plain projects with the default copy, one per theme and format |
| here | `notes.md`, `template.json`, `contact-sheet*.png` | Notes, metadata, frames (`-themes`: one frame per scene in each theme) |
| `miraiclip-react-template/public/templates/` | `metrics-reel.miraiclip-template.json` (terminal, its own look), `-midnight`, `-paper`, `-pop`, each with `-vertical` | The templates |

```bash
node examples/templates/metrics-reel/build.mjs
```

No new uploads: fonts come from `templates/_shared/` in R2.

## How the data fields work

- **Counters.** A registered `@property --n` (an integer) animates from 0 to `--to`, which is the field, and `counter()` prints it. Whole numbers only, up to 4 digits. Put symbols in the *before* and *after* fields (`$`, `K`, `%`).
- **Line chart.** An inline SVG with `viewBox="0 0 500 100"`, `preserveAspectRatio="none"` and a flipped y axis. The path is `M0 {{p1}} L100 {{p2}} …`, so each point field (0–100) is its height directly. The dots and the tooltip are HTML placed at `bottom: calc({{pN}} * 1%)`, so they land on the line at any size.
- **Bars.** Each bar is `width: calc(v / max(v1…v5) * 82%)`. The leader always fills the row and the others scale to it, whatever the units.
- **Goal ring.** A registered `--a` drives two conic gradients. The first fills to `min(a, 100)`; the second lap, in the second colour, shows `max(a − 100, 0)`. A value under 100 just leaves the ring short.

**Inline SVG needs `xmlns="http://www.w3.org/2000/svg"`.** The scene is rasterized inside an XHTML `foreignObject`, and without the namespace an `<svg>` is an unknown XHTML element that draws nothing.
