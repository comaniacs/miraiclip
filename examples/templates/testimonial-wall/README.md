# Example 10 · Testimonial wall

A 23.8 s social-proof film in 16:9 and 9:16 and four themes:
1. A hook with a dropping quote mark.
2. A wall of quote cards, tipped back in perspective, whose four columns drift in opposite directions.
3. A pull quote with a highlighter sweeping every line.
4. The average rating, with five stars filling to it, a counting review total and the breakdown bars.
5. A customer story: a portrait card, the quote wiping down, a verified badge and the result.
6. Two rows of customer names running past each other.
7. An end card.

Every quote, name, role, number, both colours and the theme are fields (54).

| Where | File | What it is |
| --- | --- | --- |
| here | `build.mjs` | Fields and scenes; uses `../_kit.mjs` |
| here | `testimonial-wall*.miraiclip.json` | Plain projects with the default copy, one per theme and format |
| here | `notes.md`, `template.json`, `contact-sheet*.png` | Notes, metadata, frames |
| `miraiclip-react-template/public/templates/` | `testimonial-wall.miraiclip-template.json` (paper, its own look), `-midnight`, `-terminal`, `-pop`, each with `-vertical` | The templates |

```bash
node examples/templates/testimonial-wall/build.mjs
```

No new uploads: fonts come from `templates/_shared/` in R2. The quotes, names and companies are invented samples.

## Tricks worth reusing

- **Avatars without images.** The name goes inside the avatar with `font-size:0`, and `::first-letter` gives the first character its size back. Editing a name updates its avatar.
- **Star fill from a text field.** The rating field (like `4.9`) goes into a custom property, `style="--r:{{rating}}"`, and a clipped row of stars is `width: calc(var(--r) / 5 * 100%)`.
- **Highlighter across wrapped lines.** An inline span with `box-decoration-break: clone`, whose background grows from `background-size: 0% 100%`.
- **Endless wall.** Each column holds six cards and moves 420 px over the scene, alternating up and down. The wall itself gets a single `perspective() rotateX()` and a top and bottom mask; there is no `preserve-3d`.
