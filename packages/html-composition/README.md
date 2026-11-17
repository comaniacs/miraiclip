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

Docs: https://docs.miraiclip.com/
