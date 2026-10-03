---
"@miraiclip/templates": patch
---

Html clips that draw media inside their markup (`asset:<id>`) now survive insertion: `insertCommands`/`insertDocument` rewrite those references when an asset is renamed or reused, and `suggestTemplateFields` offers media used only that way as a slot.
