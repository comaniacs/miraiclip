---
"@miraiclip/assistant": patch
---

`apply_commands` now rejects an html clip whose markup won't render, before anything is applied: the template is parsed as XML (unclosed `<br>`, a bare `&` or `<`, HTML-only entities like `&nbsp;`, unquoted attributes, mismatched tags) and `asset:<id>` references must name an asset in the project or one added in the same batch. The error says what's wrong and where, so the model fixes it instead of landing a scene that renders blank. `markupProblem` and `assetRefs` are exported.
