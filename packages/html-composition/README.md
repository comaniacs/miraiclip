# @miraiclip/html-composition

Import and export **data-attribute HTML compositions** — plain HTML pages whose elements carry their own timing (`data-start`, `data-duration`, `data-track-index`) — to and from [Miraiclip](https://docs.miraiclip.com/) documents.

```ts
import { importHtmlComposition, exportHtmlComposition } from "@miraiclip/html-composition";
import { createProject } from "@miraiclip/core";

const { doc, warnings } = importHtmlComposition(html);
const project = createProject(doc); // now editable, undoable, exportable

const { html: back } = exportHtmlComposition(project.getState().doc);
```

Docs: https://docs.miraiclip.com/
