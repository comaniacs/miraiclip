---
title: HTML Clips
weight: 6
---

Author overlays as HTML and CSS. An `html` clip rasterizes a template (flexbox, grid, gradients, shadows, emoji — the whole styling toolbox) into the composition, where it behaves like any other clip: keyframes, effects, and transitions all apply, and it renders identically in preview, browser export, stills, and [server export](../../export/server-side) — the clip is plain data, so it crosses every boundary custom code can't.

```ts
project.dispatch({
  type: "clip/add",
  payload: {
    kind: "html", id: "lower-third", trackId: "overlay",
    startUs: 1_000_000, durationUs: 4_000_000,
    template: `
      <div style="display:flex;align-items:center;gap:16px;height:100%;
                  background:linear-gradient(90deg,#e91e63cc,#9c27b0cc);
                  border-radius:16px;color:#fff;font:700 40px sans-serif;padding:0 28px">
        {{name}} <span style="font:400 26px sans-serif;opacity:.8">{{role}}</span>
      </div>`,
    params: { name: "Ada Lovelace", role: "Analyst" },
    widthPx: 640, heightPx: 96,          // raster size in composition pixels
    transform: { x: 0.32, y: 0.85 },
  },
});
```

## Params

`{{name}}` placeholders substitute from `params` (strings, numbers, booleans — values are HTML-escaped, so params are always data, never markup). Update them any time; a param change re-rasters the template in place (~2ms):

```ts
project.dispatch({
  type: "clip/set-property",
  payload: { clipId: "lower-third", params: { role: "Programmer" } },
});
```

Params are the substrate for parameterized videos: one template, many renders.

## Sizing & animation

The template rasterizes at `widthPx`×`heightPx` in composition pixels (default: the composition size) and places like every clip — `transform` positions its center, and standard keyframes animate `x`, `y`, `scale`, `rotation`, `opacity` over the raster for free. Content changes go through params. CSS animations inside the template don't run: a clip is a deterministic snapshot of (template, params, size), which is what preview/export parity requires.

## Fonts & images

The raster is an isolated document, so resources are inlined automatically:

- **Fonts** — reference a [font asset](../captions)'s `family` in the template's CSS and its file is embedded into the raster as an `@font-face` data URI. System fonts (`sans-serif`, …) just work.
- **Images** — reference an image asset as `src="asset:<id>"` and its bytes are inlined the same way.

External URLs never load inside a raster — inline the asset or use a `data:` URI.

```ts
project.dispatch({ type: "asset/add", payload: { id: "logo", kind: "image", src: "/media/logo.png" } });
project.dispatch({
  type: "clip/add",
  payload: {
    kind: "html", id: "badge", trackId: "overlay", startUs: 0, durationUs: 3_000_000,
    template: `<img src="asset:logo" style="width:100%"/>`,
    widthPx: 200, heightPx: 200, transform: { x: 0.9, y: 0.12 },
  },
});
```

## Boundaries

- **Worker export renders html clips too**: workers have no DOM, so `exportProjectInWorker`/`exportViaWorker` rasterize every html clip on the main thread first (deduplicated, one raster per unique template + params + size) and transfer the bitmaps to the worker with the export. No API change — it just works. Posting to the worker yourself instead? Pre-render with `collectHtmlRasters(doc)` and include the result (transferring its `transfer` list) as `htmlRasters` on the start message.
- Exports and stills **wait for rasters** before the first frame (the same readiness gate now also covers image assets), so an overlay can never be half-missing in an exported file — a template that fails to rasterize fails the export loudly.
- Scripts and iframes inside templates don't execute; interactivity has no meaning in rendered video.
- **Rasters are density-aware**: templates rasterize at the render density (output ÷ composition size in exports and stills, devicePixelRatio in previews via `createPlayer({ outputSize })`), so upscaled outputs and hi-DPI screens stay sharp — layout is identical at every density.
- Text antialiasing varies across platforms, so exact pixels of text can differ between machines — Chromium-family browsers are the rendering target, as everywhere in Miraiclip.

For the machinery (and how to swap in your own rasterizer), `rasterizeHtml` and `substituteParams` are exported from `@miraiclip/renderer`.
