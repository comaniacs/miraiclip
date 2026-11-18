# @miraiclip/html-composition

Import and export **data-attribute HTML compositions** — plain HTML pages whose elements carry their own timing (`data-start`, `data-duration`, `data-track-index`) — to and from [Miraiclip](https://docs.miraiclip.com/) documents.

```ts
import { importHtmlComposition, exportHtmlComposition } from "@miraiclip/html-composition";
import { createProject } from "@miraiclip/core";

const { doc, warnings } = importHtmlComposition(html);
const project = createProject(doc); // now editable, undoable, exportable

const { html: back } = exportHtmlComposition(project.getState().doc);
```

## Editing html clips by element

Every element of an html clip's template can get a stable id (`data-mc`), so people and assistants can change one element (its text, inline style, attributes, place) without rewriting the markup. Edits are planned into an ordinary `clip/set-property` command, so undo, history and sync work as usual.

```ts
import { describeHtml, formatHtmlOutline, planHtmlEdit, cleanHtml } from "@miraiclip/html-composition";

const { elements } = describeHtml(clip.template);   // ids in document order, own text, inline style
console.log(formatHtmlOutline(elements));          // #e1 div.paper {position:absolute; …} …

const commands = planHtmlEdit(doc, clip.id, [
  { op: "text", id: "e7", text: "9.00" },
  { op: "style", id: "e3", set: { left: "120px", color: "#c0392b" } },
  { op: "move", id: "e9", ref: "e2", position: "before" },
  { op: "insert", html: "<div>SEAT 14</div>", ref: "e1", position: "last" },
]);
project.transaction(() => commands.forEach((c) => project.dispatch(c)));

// Markup from a model or a paste: no handlers, javascript:, external fetches, frames or scripts.
const { template, removed } = cleanHtml(untrusted);
```

Operations: `text`, `html` (inner markup), `replace` (outer), `style` (merge; `null` removes), `attr`, `insert`, `move`, `duplicate`, `remove`. A batch is all or nothing (`HtmlEditError` with a `code` and the failing `index`). Ids are stamped in document order, so an outline read from an unstamped template matches the ids the stored, stamped template gets. Inline `<svg>` is one element; its insides are edited with `html`.

## Words, colours and type

For translating and rebranding a design written in markup, without touching its layout:

```ts
import { htmlTexts, setHtmlTexts, htmlPalette, recolorHtml, htmlFonts, refontHtml } from "@miraiclip/html-composition";

const { texts } = htmlTexts(template);            // [{ id: "e4", index: 0, text: "TOTAL:" }, …] (no numbers, params, svg or code)
setHtmlTexts(template, [{ id: "e4", index: 0, text: "合計:" }]);

htmlPalette(template);                            // [{ color: "#094a9f", text: 3, fill: 1, line: 1 }, …], most used first
recolorHtml(template, { "#094a9f": "#0b1630" });  // everywhere, alpha kept

htmlFonts(template);                              // [{ family: "Alfa Slab One", largestPx: 190, uses: 1 }, …]
refontHtml(template, { "Alfa Slab One": "Fraunces" }); // fallbacks kept
```

`@miraiclip/localize` translates the words in html clips' markup with these, and `@miraiclip/brand` rebrands their colours and type.

## Merging two edits of one clip

Two people (or a person and an assistant) edit the same html clip from the same starting point:

```ts
import { mergeHtml } from "@miraiclip/html-composition";

const { template, conflicts } = mergeHtml(base, mine, current); // mine replayed onto current
```

Element by element (by `data-mc` id): attributes, each inline style property, its own text, its place, whether it exists. Where both changed the same thing, `mine` wins and `conflicts` counts it; an element the other side removed stays removed; both sides' new elements are kept with distinct ids.

Docs: https://docs.miraiclip.com/
