/**
 * Global renderers for custom clip kinds — the drawing half of
 * `registerClipKind`. Unlike per-call `factories`, a registered clip renderer
 * is found by every compositor in the bundle (preview, exports, stills), so a
 * plugin that registers one renders the same everywhere it is loaded:
 * main thread, export worker and the server-export page.
 */
import type { Asset, Clip } from "@miraiclip/core";
import type { NodeFactory } from "./types.js";

/** What a clip renderer gets when it builds a clip's content. */
export interface ClipRenderContext {
  compositionSize: () => { width: number; height: number };
  assets: Readonly<Record<string, Asset>>;
  /** Mark the frame dirty after changing content outside update/tick. */
  invalidate: () => void;
}

/** Hooks a clip renderer returns for one clip's content (all optional). */
export interface ClipRendererInstance {
  /** The clip's props changed (also called once right after create). */
  update?(clip: Clip): void;
  /** Every rendered frame while visible; `timeUs` is the timeline position. */
  tick?(clip: Clip, timeUs: number): void;
  destroy?(): void;
}

/**
 * Draws one custom clip kind. `create` receives a Pixi `Container` whose
 * origin is the clip's center in composition pixels; the clip's transform,
 * keyframes, effects (regions included) and transitions apply to it like any
 * built-in clip.
 */
export interface ClipRenderer {
  create(container: import("pixi.js").Container, clip: Clip, context: ClipRenderContext): ClipRendererInstance | void;
}

const clipRenderers = new Map<string, ClipRenderer>();

export function registerClipRenderer(kind: string, renderer: ClipRenderer, options?: { replace?: boolean }): void {
  const existing = clipRenderers.get(kind);
  if (existing === renderer) return; // idempotent
  if (existing && !options?.replace) throw new Error(`clip renderer "${kind}" is already registered`);
  clipRenderers.set(kind, renderer);
}

/** Remove a custom clip renderer (plugin unload). Returns whether it existed. */
export function unregisterClipRenderer(kind: string): boolean {
  return clipRenderers.delete(kind);
}

export function getClipRenderer(kind: string): ClipRenderer | undefined {
  return clipRenderers.get(kind);
}

/** A NodeFactory for a registered clip renderer (null when the backend can't host containers). */
export function clipRendererFactory(kind: string): NodeFactory | undefined {
  const renderer = clipRenderers.get(kind);
  if (!renderer) return undefined;
  return (clip, { backend, assets }) => backend.createContainer?.(renderer, clip, assets) ?? null;
}
