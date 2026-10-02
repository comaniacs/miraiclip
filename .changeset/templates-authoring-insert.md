---
"@miraiclip/templates": patch
---

Templates for editors: `suggestTemplateFields` lists what in a finished project could stay editable (texts, html-clip params with colors detected, media used by clips), and `templateFromDocument` turns the chosen ones into optional fields defaulting to their current values ("Save as template"). `insertDocument` / `insertCommands` add a hydrated template to an existing project at a time, as one undo step: new tracks on top, every id remapped, keyframes, effects and transitions carried over, matching media and fonts reused. `fitClipsToMedia` shortens clips that would overrun shorter swapped-in media and fits transitions to the footage left around each cut. Templates take optional `category`, `tags` and `thumbnail`; fields take an optional `label`.
