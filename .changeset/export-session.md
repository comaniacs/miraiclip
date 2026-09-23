---
"@miraiclip/server-export": minor
---

`createExportSession()` — a persistent exporter: one headless Chrome + harness page kept warm across calls, one full export per `exportFile(doc, options)` call (same options and result as `exportProjectFile`, including streamed `out`), so an export costs an export instead of a browser launch. Calls queue on the one page; a failed export never wedges the session. Built for batch rendering (`@miraiclip/templates`) and export-on-demand services.
