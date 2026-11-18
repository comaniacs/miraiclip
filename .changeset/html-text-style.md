---
"@miraiclip/html-composition": minor
"@miraiclip/localize": minor
"@miraiclip/brand": minor
---

Translate and rebrand designs written as html markup, without touching their layout.

- html-composition: `htmlTexts` / `setHtmlTexts` (every piece of text a viewer reads, by element and place; numbers, params, svg and code left out), `htmlPalette` / `recolorHtml` (colours by use, swapped everywhere with alpha kept), `htmlFonts` / `refontHtml` (families with their largest size, swapped with fallbacks kept), `hexColor`.
- localize: `collectText` / `localizeProject` translate the words in html clips' markup as `html-text` units (one command per clip); `htmlText: false` turns it off.
- brand: `applyBrand` gives an html clip's largest type the heading face and the rest the body face (monospace, barcode and icon faces kept), and recolours a clip written as markup (no colour fields) by role, keeping text readable on its main panel. `brandHtmlFonts` and `brandHtmlColors` are exported.
