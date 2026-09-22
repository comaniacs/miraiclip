---
title: Custom Effects & Transitions
weight: 5
---

Bring your own effect and transition kinds. Registration has two halves — core validates, the renderer draws — and a registered kind is a first-class citizen: it dispatches through the same commands, undoes, serializes, and renders identically in preview, browser export, and stills.

```ts
import { registerEffectKind, registerTransitionKind } from "@miraiclip/core";
import { registerEffectRenderer, registerTransitionRenderer } from "@miraiclip/renderer";
```

Register at app startup, before creating players or running exports.

## A custom effect

Core half — the param schema `effect/add` and `effect/update` validate against (it also enters the [command catalog](../../command-catalog) for AI tool use):

```ts
import { z } from "zod";

registerEffectKind("sepia", z.object({
  amount: z.number().min(0).max(1).default(1),
}));
```

Renderer half — a factory building a Pixi filter from params, updated **in place** so dragging a slider never recompiles a shader:

```ts
import { ColorMatrixFilter } from "pixi.js";

registerEffectRenderer("sepia", (params) => {
  const filter = new ColorMatrixFilter();
  const apply = (p: Record<string, unknown>) => {
    filter.reset();
    filter.sepia(true);
    filter.alpha = (p["amount"] as number) ?? 1;
  };
  apply(params);
  return { kind: "sepia", filter, update: apply };
});
```

Use it like any built-in:

```ts
project.dispatch({
  type: "effect/add",
  payload: { clipId: "clip-1", kind: "sepia", params: { amount: 0.8 } },
});
```

For shader effects, build a `Filter` with `GlProgram.from({ vertex, fragment })` — the built-in chroma key ([source](https://github.com/comaniacs/miraiclip/blob/main/packages/renderer/src/effects/pixi-effects.ts)) is the reference pattern. Two rules the built-ins follow: length-denoting params are **composition-relative fractions** converted via `context.compositionSize()` (absolute pixels diverge between scaled preview and full-res export), and `update` mutates the existing filter rather than rebuilding it.

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

Registered with `registerClipKind` (core: props schema + allowed track kinds) and a scene-node factory passed as `factories` to `createPlayer` / `exportProject` / `renderProjectStill`. The factory's node receives `tick(clip, timeUs)` every rendered frame — deterministic code-driven graphics (charts, counters, generative visuals) animate off the clip's own props and time, with export parity by construction.

## Animation

Standard keyframes (`keyframe/set` on x, y, scale, rotation, opacity, volume) apply to **every** clip kind, custom included — placement math is kind-agnostic, and transitions compose onto keyframed placement. Keyframing *effect params* is on the [roadmap](../../roadmap); today, animate params from a custom clip node's `tick`.

## Boundaries

Renderers and factories are functions, so they cannot cross a process or thread boundary: **server export and worker export support built-in kinds only** — main-thread preview, `exportProject`, and `renderProjectStill` all support custom kinds. A kind with a schema but no renderer is still valid data: an unknown effect applies no visual, and an unknown transition draws as a hard cut.

Registries are module-global and reject duplicate kinds (built-ins included), so two libraries can't silently fight over one name.
