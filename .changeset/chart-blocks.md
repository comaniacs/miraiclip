---
"@miraiclip/registry": minor
---

Charts: `chartContent(spec)` plans an `html` clip (an inline SVG) for a bar, column, line, pie or donut chart from typed data (`labels`, `values`, optional `title`, `colors`, `textColor`, `fontFamily`, `showValues`, `unit`). Colors are params (`c0`…, `text`) so a palette or brand kit recolors it without re-planning; the spec rides along as `params.chart`, read back with `chartSpecOf`. `parseChartSpec` and `chartSpecSchema` validate input.
