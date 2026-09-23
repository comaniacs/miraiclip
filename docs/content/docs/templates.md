---
title: Templates
weight: 10
---

Parameterized videos: a template project + a data payload → a hydrated document → export. `@miraiclip/templates` is how one composition becomes a hundred personalized videos — batch generation, video-as-an-API, localized variants — with **no code in the template**: templates are JSON, hydration is pure and deterministic, and no LLM sits in the render loop.

```sh
npm install @miraiclip/templates
```

[See templates run live](../examples#templates) — define, hydrate, and validate in your browser.

## The model

A template is an ordinary `ProjectDocument` plus declared blanks:

```json
{
  "version": 1,
  "name": "Outreach",
  "doc": { "…": "an ordinary project document" },
  "fields": [
    { "name": "name",   "type": "text",  "maxLength": 40 },
    { "name": "accent", "type": "color", "default": "#ff8c32" },
    { "name": "logo",   "type": "asset", "assetId": "logo", "required": false }
  ]
}
```

Blanks bind by placeholder — `{{name}}` in a text clip's `text`, in caption words, or in an [html clip](rendering/html-clips)'s `params` string values. An `asset` field names an asset id instead: the payload's value replaces that asset's `src` (and optionally `durationUs`); hydration never touches clip timing or structure, so it cannot produce an invalid document. One field declaration drives payload validation, UI form generation, and LLM tool schemas alike.

Field types: `text` (`maxLength`, `pattern`, `enum`), `number` (`min`, `max`, `integer`), `boolean`, `color` (a CSS color string), `asset` (`assetId`). A field with a `default` or `required: false` is optional.

## Author a template

Build the document with ordinary commands, then declare the blanks:

```ts
import { defineTemplate, extractFields } from "@miraiclip/templates";

// project = createProject(...) + dispatches; placeholders go in the content:
project.dispatch({ type: "clip/add", payload: {
  kind: "html", id: "card", trackId: "overlay", startUs: 0, durationUs: 4_000_000,
  template: `<div style="background:{{bg}};font:700 40px sans-serif">{{copy}}</div>`,
  params: { bg: "{{accent}}", copy: "Hi {{name}}" },
  widthPx: 600, heightPx: 200,
} });

const template = defineTemplate({
  name: "Outreach",
  doc: project.toJSON(),
  fields: [
    { name: "name",   type: "text", maxLength: 40 },
    { name: "accent", type: "color", default: "#ff8c32" },
  ],
});
// extractFields(project.toJSON()) proposes the field list from the placeholders.
```

`defineTemplate` (and `parseTemplate`, for loading a `.miraiclip-template.json` file) cross-checks coherence up front: every placeholder has a field, every field is used, asset fields point at real assets. A template that loads is a template that hydrates.

An html clip's `params` whose whole value is one placeholder binds **typed** — `params: { size: "{{fontSize}}" }` with a `number` field puts a number in the param, not a string.

## Hydrate and render

```ts
import { hydrate, tryHydrate } from "@miraiclip/templates";
import { createProject } from "@miraiclip/core";

const doc = hydrate(template, { name: "Vinamra", accent: "#2e8f63" });
const project = createProject(doc); // preview it, edit it, exportProject it — it's a normal document

// Agents self-correct from machine-readable failures instead of catching:
const result = tryHydrate(template, data);
// { ok: true, doc } | { ok: false, issues: [{ path: "data.name", message: "…" }] }
```

Hydration is pure: same template + same data → the same document, every time, in any environment.

## Batch render (Node)

`@miraiclip/templates/render` drives [server export](export/server-side)'s warm export sessions — one headless Chrome kept alive across rows, so a row costs an export, not a browser launch:

```ts
import { renderTemplateBatch } from "@miraiclip/templates/render";

const { rows, failed } = await renderTemplateBatch(template, [
  { name: "Ada",  accent: "#ff0000" },
  { name: "Grace", accent: "#0000ff" },
], {
  out: "out/{name}.mp4",       // {field} and {index} substitute; or (data, index) => path
  format: "mp4", quality: "high",
  concurrency: 2,              // parallel browsers working the rows
});
// Each row reports { ok, filePath, bytesWritten } or its issues — a bad row
// never aborts the others (pass stopOnError: true to stop scheduling instead).
```

Or from the command line — JSON, NDJSON, or CSV rows (CSV cells coerce to each field's declared type):

```sh
miraiclip-templates render outreach.miraiclip-template.json \
  --data leads.csv --out "out/{name}.mp4" --quality high --concurrency 2
miraiclip-templates describe outreach.miraiclip-template.json
```

The same warm engine is exported directly as `createExportSession()` from `@miraiclip/server-export` for export-on-demand services.

## Templates as LLM tools

The field schema doubles as a tool definition — an agent fills the payload, `hydrate` validates it, and the render is deterministic:

```ts
import { toFieldToolDefinition, describeTemplate } from "@miraiclip/templates";

const tool = toFieldToolDefinition(template);           // Anthropic tool_use shape
const openai = toFieldToolDefinition(template, { style: "openai" });
const summary = describeTemplate(template);             // compact prompt context
```

Pair with the [AI command interface](ai-integration) for the full loop: an agent designs the template once through commands, then filling it is one typed tool call per video.

## Boundaries

- Hydration binds **content only** (text, caption words, html params, asset sources) — never durations, positions, or structure. That's what makes it safe by construction; repeaters (an array field producing N clips), conditionals, and formatters are future template versions.
- Swapped video/audio should match the placeholder media's duration, or carry `durationUs` in the payload — clip timing is the template author's.
- MP4 batch output needs a real Chrome (H.264), same as all [server export](export/server-side); WebM works on any Chromium.
