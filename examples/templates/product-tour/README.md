# Example 5 · Product tour

A 21.6 s guided tour of a product from one screenshot, in 16:9 and 9:16 and four themes: hook → a spotlight glides across three areas of the screenshot with a caption for each → numbered hotspots pop on with pulsing rings and labels → an automation runs step by step (connectors draw, steps light up, "Ran in 1.2 s") → the same flow on a phone (a tap ripples, a share sheet slides up) → end card. Every word, both colours, the screenshot and the theme are fields (36).

Scenes adapted from the studio's built-in *Spotlight tour*, *Feature hotspots*, *Automation run* and *App walkthrough (taps)*, rebuilt on the shared kit.

| Where | File | What it is |
| --- | --- | --- |
| here | `build.mjs` | Fields and scenes; uses `../_kit.mjs` |
| here | `product-tour*.miraiclip.json` | Plain projects with the default copy, one per theme and format |
| here | `notes.md`, `template.json`, `contact-sheet*.png` | Notes, metadata, frames (`-themes`: one frame per scene in each theme) |
| `miraiclip-react-template/public/templates/` | `product-tour.miraiclip-template.json` (pop, its own look), `-midnight`, `-paper`, `-terminal`, each with `-vertical` | The templates |

```bash
node examples/templates/product-tour/build.mjs
```

The sample screenshot is example 1's (`templates/miraiclip-launch/product.jpg` in R2) and fonts come from `templates/_shared/`; no new uploads. The spotlight and hotspots point at the screenshot's left-middle, right and bottom areas, so a different screenshot works best with a similar layout (preview, side panel, timeline or table).
