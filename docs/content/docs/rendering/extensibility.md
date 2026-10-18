---
title: Custom Effects & Transitions
weight: 5
---

Bring your own effect and transition kinds. Registration has two halves — core validates, the renderer draws — and a registered kind is a first-class citizen: it dispatches through the same commands, undoes, serializes, and renders identically in preview, browser export, and stills.

```ts
import { registerEffectKind, registerTransitionKind } from "@miraiclip/core";
import { registerEffectRenderer, registerTransitionRenderer } from "@miraiclip/renderer";
```

Register at app startup, before creating players or running exports. Check the [built-in effect library](../effects#effect-library) first — 79 kinds ship built in, and built-ins also render in worker and server export.

## A custom effect

Core half — the param schema `effect/add` and `effect/update` validate against (it also enters the [command catalog](../../command-catalog) for AI tool use):

```ts
import { z } from "zod";

registerEffectKind("oldPhoto", z.object({
  amount: z.number().min(0).max(1).default(1),
}));
```

Renderer half — a factory building a Pixi filter from params, updated **in place** so dragging a slider never recompiles a shader:

```ts
import { ColorMatrixFilter } from "pixi.js";

registerEffectRenderer("oldPhoto", (params) => {
  const filter = new ColorMatrixFilter();
  const apply = (p: Record<string, unknown>) => {
    filter.reset();
    filter.sepia(true);
    filter.alpha = (p["amount"] as number) ?? 1;
  };
  apply(params);
  return { kind: "oldPhoto", filter, update: apply };
});
```

Use it like any built-in:

```ts
project.dispatch({
  type: "effect/add",
  payload: { clipId: "clip-1", kind: "oldPhoto", params: { amount: 0.8 } },
});
```

For shader effects, build a `Filter` with `GlProgram.from({ vertex, fragment })` — the built-in library ([shaders](https://github.com/comaniacs/miraiclip/blob/main/packages/renderer/src/effects/library/shaders.ts), [factories](https://github.com/comaniacs/miraiclip/blob/main/packages/renderer/src/effects/library/library.ts)) is the reference pattern. Two rules the built-ins follow: length-denoting params are **fractions of composition height** converted via `context.compositionSize()` (times `context.renderScale()` inside shaders, which run in output pixels) (absolute pixels diverge between scaled preview and full-res export), and `update` mutates the existing filter rather than rebuilding it.

## A custom transition

A transition renderer is pure math over progress: given which side a clip is on and how far the window has run (0 → 1, the cut at 0.5), return the frame's adjustments. Four primitives compose: `opacity` (multiplied in), `reveal` (directional mask), `offsetXPx`/`offsetYPx` (composition pixels), and `overlay` (a full-frame solid).

```ts
registerTransitionKind("flash", z.object({}));

registerTransitionRenderer("flash", {
  // Overlay kinds cover the hard cut — no out-of-source-bounds media needed.
  rendersBothClips: false,
  frame: (role, progress) =>
    role === "from"
      ? { overlay: { color: 0xffffff, alpha: 1 - Math.abs(2 * progress - 1) } }
      : null,
});

project.dispatch({
  type: "transition/add",
  payload: { kind: "flash", fromClipId: "a", toClipId: "b", durationUs: 500_000 },
});
```

A blend kind renders **both clips through the window** (set `rendersBothClips: true`): the outgoing clip keeps showing past its end and the incoming starts early, both from source trim headroom — `transition/add` validates the headroom (`insufficient-handles`) and the decode pipeline extends automatically. A fade-push in one expression:

```ts
registerTransitionRenderer("fadePush", {
  rendersBothClips: true,
  frame: (role, progress, _params, { compositionSize }) =>
    role === "to"
      ? { opacity: progress, offsetXPx: (1 - progress) * compositionSize.width * 0.5 }
      : null,
});
```

The five built-ins are written through this exact contract ([source](https://github.com/comaniacs/miraiclip/blob/main/packages/renderer/src/transitions/registry.ts)) — read them as templates. Every kind, custom included, gets the equal-power audio crossfade automatically.

## Custom clip kinds

Registered with `registerClipKind` (core: props schema + allowed track kinds) and drawn by a **clip renderer**, registered once for the whole bundle:

```ts
import { Graphics } from "pixi.js";
import { registerClipRenderer } from "@miraiclip/renderer";

registerClipKind("counter", {
  propsSchema: z.object({ from: z.number().default(0), to: z.number().default(100) }),
  trackKinds: ["video"],
});

registerClipRenderer("counter", {
  // The container's origin is the clip's center, in composition pixels.
  create(container, clip, { compositionSize }) {
    const bar = new Graphics();
    container.addChild(bar);
    return {
      tick(clip, timeUs) {
        const p = Math.min(1, (timeUs - clip.startUs) / clip.durationUs);
        const { width } = compositionSize();
        bar.clear().rect(-width / 4, -10, (width / 2) * p, 20).fill("#5b8cff");
      },
    };
  },
});
```

`update(clip)` runs when props change and `tick(clip, timeUs)` every rendered frame — deterministic code-driven graphics (charts, counters, generative visuals) animate off the clip's own props and time, with export parity by construction. The clip's transform, keyframes, effects (regions included) and transitions apply like any built-in. Edit props with `clip/set-property` `props`. Per-call `factories` on `createPlayer` / `exportProject` / `renderProjectStill` still work and take precedence.

## Plugins: custom kinds everywhere

Package your kinds as a **plugin** and list it in the document, and every runtime that renders the document loads it — the page, the export worker, the server-export page and the MCP server.

A plugin is one standalone ES module (no bare imports — bundle your dependencies). Everything it needs arrives through `register(api)`:

```js
// charts-plugin.mjs
export default {
  name: "@acme/charts",
  version: "1.0.0",
  register({ z, core, renderer }) {
    core.registerClipKind("acme/bar", { propsSchema: z.object({ value: z.number().default(0) }), trackKinds: ["video"] });
    if (!renderer) return; // Node (MCP): validation only
    const { Graphics } = renderer.pixi;
    renderer.registerClipRenderer("acme/bar", {
      create(container) {
        const g = new Graphics();
        container.addChild(g);
        return { update: (clip) => g.clear().rect(-100, -20, clip.props.value * 2, 40).fill("#22c55e") };
      },
    });
  },
};
```

Declare it in the document (an SRI hash pins the exact code):

```ts
project.dispatch({
  type: "plugin/add",
  payload: { name: "@acme/charts", version: "1.0.0", url: "https://cdn.acme.dev/charts@1.0.0.mjs", integrity: "sha384-…" },
});
```

Then load it wherever the document is opened:

```ts
import { loadDocumentPlugins } from "@miraiclip/renderer";

const loaded = await loadDocumentPlugins(project.getState().doc);
// … preview, export (the export worker loads them itself) …
loaded.unload(); // optional: unregister the kinds again
```

`api.z` is core's zod (schemas must come from the same instance core validates with), `api.core` registers core kinds, and `api.renderer` (absent in Node) registers effect, transition and clip renderers and hands you the Pixi classes to draw with (`Container`, `Graphics`, `Sprite`, `Text`, `Texture`, `Filter`, `GlProgram`, `ColorMatrixFilter`, `BlurFilter`). Loading is idempotent per realm, a newer version of the same plugin replaces its kinds (hot reload), and a failed load (HTTP error, integrity mismatch, a `register` that throws) undoes that plugin's registrations. Options: `allow(ref)`, `requireIntegrity`, `baseUrl`, `fetchSource`.

**On a server, plugins are code you didn't write**, so server export and the MCP server run them only when you opt in: `plugins: { allow: true }` (or a list of allowed URL prefixes, or a predicate) on `exportProjectFile`, `createExportSession` and `createRenderSession`, and `--allow-plugins [prefixes]` / `--require-integrity` for `miraiclip-mcp`. The server reads and verifies the module, the page registers it for that one job and unloads it afterwards, so a warm session never leaks one document's kinds into the next.

## Animation

Standard keyframes (`keyframe/set` on x, y, scale, rotation, opacity, volume) apply to **every** clip kind, custom included — placement math is kind-agnostic, and transitions compose onto keyframed placement. Keyframing *effect params* is on the [roadmap](../../roadmap); today, animate params from a custom clip node's `tick`.

## Boundaries

Renderers are functions, so they can't be sent across a process or thread boundary — but [plugins](#plugins-custom-kinds-everywhere) can: worker export and server export render custom kinds that come from a plugin the document declares. Kinds registered directly in your app code (not through a plugin) render on the main thread only: preview, `exportProject` and `renderProjectStill`. A kind with a schema but no renderer is still valid data: an unknown effect applies no visual, and an unknown transition draws as a hard cut.

## Registries

Registries are module-global. Registering the **same** schema or renderer again is a no-op (a module evaluated twice under hot reload, a plugin loaded twice). A **different** definition for a taken name throws unless you pass `{ replace: true }`, so two libraries can't silently fight over one name. Built-in kinds can never be replaced or removed. `unregisterEffectKind`, `unregisterTransitionKind`, `unregisterClipKind` (core) and `unregisterEffectRenderer`, `unregisterTransitionRenderer`, `unregisterClipRenderer` (renderer) remove custom kinds — the plugin loader uses them to clean up after a job.
