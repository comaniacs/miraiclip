# @miraiclip/guides

A written, step-by-step guide from the same project as your video: one recording, two deliverables.

```ts
import { buildGuide, addStills, toMarkdown, toHtml } from "@miraiclip/guides";

let guide = buildGuide(doc, { title: "Turn on dark mode", session, clipId: "screen", script });
guide = await addStills(guide, doc, (d, o) => renderSession.renderStill(d, o), {
  store: async (image, step) => save(`images/step-${step.number}.png`, image.data),
});
await save("guide.md", toMarkdown(guide));
await save("guide.html", toHtml(guide));
```

- **Steps** come from step markers (or every click when there are none). Titles come from the marker or the action ("Click “Save”", "Enter email address", "Press Enter").
- **Text** comes from the narration script, or from what was said (fillers dropped).
- **Screenshots** come from any still renderer, taken just before each action, with the control outlined, the rest dimmed and the step number beside it. Sensitive fields are never highlighted.
- **Output** is plain files: Markdown, a standalone HTML page (light/dark) or a fragment, or JSON.

Docs: https://docs.miraiclip.com/
