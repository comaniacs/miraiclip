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

The markup itself can change too (a code editor, say): `clip/set-property` takes `template`, `unsetParams` (placeholders the new markup no longer uses) and `widthPx` / `heightPx` (`null` falls back to the composition size). The clip keeps its id, keyframes, effects and transitions, and the change is one undo step.

```ts
project.dispatch({
  type: "clip/set-property",
  payload: { clipId: "badge", template: `<b style="color:{{color}}">{{label}}</b>`, params: { label: "New" }, unsetParams: ["name"], widthPx: 600 },
});
```

## Sizing & animation

The template rasterizes at `widthPx`×`heightPx` in composition pixels (default: the composition size) and places like every clip — `transform` positions its center, and standard keyframes animate `x`, `y`, `scale`, `rotation`, `opacity` over the raster for free. Content changes go through params. By default CSS animations inside the template don't run: a static clip is a deterministic snapshot of (template, params, size), rasterized once.

## Animated templates

Set `animated: true` and the template re-rasterizes **every frame at the clip's time**, so CSS `@keyframes` inside it play in preview, seek when you scrub, and export frame-exactly. Write animations as usual, with two rules:

- Every animation is paused and seeked by the renderer, which owns `animation-delay`. Stagger elements with the `--d` custom property instead (`style="--d:.4s"`); it inherits, so setting it on a parent delays the whole group.
- Use `animation-fill-mode: both` (or `forwards`) so elements hold their end state.

`--t` (seconds into the clip) and `--T` (the clip's length) are set on the template root, so exits can be timed from the end: `style="--d:calc(var(--T) - .5s)"`.

```ts
project.dispatch({
  type: "clip/add",
  payload: {
    kind: "html", id: "follow", trackId: "overlay", startUs: 0, durationUs: 4_000_000,
    animated: true, widthPx: 900, heightPx: 260,
    template: `<style>
      @keyframes rise { from { transform: translateY(120px); opacity: 0 } }
      @keyframes press { 50% { transform: scale(.92) } }
      .card { animation: rise .5s cubic-bezier(.2,.8,.2,1) both }
      .btn { --d: 1s; animation: press .3s ease-in-out both }
    </style>
    <div class="card">… <button class="btn">Follow</button></div>`,
  },
});
```

Cost: one raster is a few milliseconds, and only visible animated clips re-raster. In preview, one raster runs at a time and the newest requested frame wins (the previous frame stays up meanwhile); exports and stills wait for each frame's raster before drawing it. A split continues the animation across the cut (`animationOffsetUs` on the right half). Toggle with `clip/set-property { animated }`.

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

- **Worker export renders html clips too**: workers have no DOM, so `exportProjectInWorker`/`exportViaWorker` rasterize every html clip on the main thread first (deduplicated, one raster per unique template + params + size) and transfer the bitmaps to the worker with the export. No API change — it just works. Posting to the worker yourself instead? Pre-render with `collectHtmlRasters(doc)` and include the result (transferring its `transfer` list) as `htmlRasters` on the start message. Animated clips change every frame, so they aren't pre-rendered: the worker asks the main thread for each frame's raster (`need-html-raster` → `html-raster`); a custom worker host installs its own source with `setHtmlRasterSource`.
- Exports and stills **wait for rasters** before the first frame (the same readiness gate now also covers image assets), so an overlay can never be half-missing in an exported file — a template that fails to rasterize fails the export loudly.
- Scripts and iframes inside templates don't execute; interactivity has no meaning in rendered video. CSS transitions don't run either (nothing changes state) — use `@keyframes` in an animated clip.
- **Rasters are density-aware**: templates rasterize at the render density (output ÷ composition size in exports and stills, devicePixelRatio in previews via `createPlayer({ outputSize })`), so upscaled outputs and hi-DPI screens stay sharp — layout is identical at every density.
- Text antialiasing varies across platforms, so exact pixels of text can differ between machines — Chromium-family browsers are the rendering target, as everywhere in Miraiclip.

For the machinery (and how to swap in your own rasterizer), `rasterizeHtml` and `substituteParams` are exported from `@miraiclip/renderer`.
