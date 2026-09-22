/**
 * The transition renderer registry: kind → how the compositor draws it.
 *
 * A transition renderer is PURE math over progress — it returns per-frame
 * adjustments the compositor applies to the participating clips through the
 * existing primitives (opacity, directional reveal, pixel offset, and a
 * full-composition overlay). The built-ins are expressed through this exact
 * contract, so a registered custom kind is a first-class citizen: it renders
 * identically in preview, browser export, and stills.
 *
 * Custom renderers are functions, so they cannot cross a process or thread
 * boundary: server export and worker export support built-in kinds only —
 * the same rule as custom clip-kind factories. Register the matching param
 * schema in core with `registerTransitionKind` so `transition/add` validates.
 */
import type { RevealDirection } from "../compositor/types.js";
import type { TransitionRole } from "./timing.js";

export interface TransitionFrameEffects {
  /** Multiplied into the clip's opacity (crossDissolve sets `progress` on the "to" side). */
  opacity?: number;
  /** Directional reveal 0..1 of the clip from an edge (wipe). */
  reveal?: { fraction: number; direction: RevealDirection };
  /** Offset in composition pixels (slide). */
  offsetXPx?: number;
  offsetYPx?: number;
  /**
   * Full-composition solid overlay (dips): when several transitions are
   * active, the highest-alpha overlay wins for the frame.
   */
  overlay?: { color: number; alpha: number };
}

export interface TransitionRenderContext {
  /** The composition size in its own coordinate space. */
  compositionSize: { width: number; height: number };
}

export interface TransitionRenderer {
  /**
   * Whether BOTH clips render through the window (blend kinds — the outgoing
   * clip keeps showing past its end and the incoming starts early, both from
   * source trim headroom, which `transition/add` validates as
   * `insufficient-handles`). False for overlay kinds (dips), which cover the
   * hard cut instead and need no out-of-bounds media at all.
   */
  rendersBothClips: boolean;
  /**
   * The adjustments for one participating clip at one moment. `progress` runs
   * 0 → 1 across the window (0.5 is the cut); `role` says which side this
   * clip is on. Return null for "no adjustment". Called every rendered frame
   * inside the window — keep it allocation-light and pure.
   */
  frame(
    role: TransitionRole,
    progress: number,
    params: Record<string, unknown> | undefined,
    context: TransitionRenderContext,
  ): TransitionFrameEffects | null;
}

const renderers = new Map<string, TransitionRenderer>();

export function directionOf(params: Record<string, unknown> | undefined): RevealDirection {
  const direction = params?.["direction"];
  return direction === "right" || direction === "up" || direction === "down"
    ? direction
    : "left";
}

// ---------------------------------------------------------------------------
// Built-ins — expressed through the public contract (the dogfood is the test).
// ---------------------------------------------------------------------------

const crossDissolve: TransitionRenderer = {
  rendersBothClips: true,
  // Incoming on top at alpha p over the opaque outgoing clip
  // ≡ out·(1−p) + in·p — the dissolve, no render-texture needed.
  frame: (role, progress) => (role === "to" ? { opacity: progress } : null),
};

const wipe: TransitionRenderer = {
  rendersBothClips: true,
  frame: (role, progress, params) =>
    role === "to" ? { reveal: { fraction: progress, direction: directionOf(params) } } : null,
};

const slide: TransitionRenderer = {
  rendersBothClips: true,
  frame: (role, progress, params, context) => {
    if (role !== "to") return null;
    // The incoming clip moves in `direction`, covering the outgoing.
    const remaining = 1 - progress;
    const { width, height } = context.compositionSize;
    switch (directionOf(params)) {
      case "left":
        return { offsetXPx: remaining * width };
      case "right":
        return { offsetXPx: -remaining * width };
      case "up":
        return { offsetYPx: remaining * height };
      case "down":
        return { offsetYPx: -remaining * height };
    }
  },
};

function dip(color: number): TransitionRenderer {
  return {
    rendersBothClips: false,
    // Counted once per transition (its "from" side). Fully opaque at the cut
    // (progress 0.5), so the hard swap underneath is never seen.
    frame: (role, progress) =>
      role === "from" ? { overlay: { color, alpha: 1 - Math.abs(2 * progress - 1) } } : null,
  };
}

for (const [kind, renderer] of Object.entries({
  crossDissolve,
  wipe,
  slide,
  dipToBlack: dip(0x000000),
  dipToWhite: dip(0xffffff),
})) {
  renderers.set(kind, renderer);
}

/**
 * Register how a custom transition kind draws. Pair it with core's
 * `registerTransitionKind(kind, paramsSchema)` so commands validate. A kind
 * without a renderer draws as a hard cut at the boundary.
 */
export function registerTransitionRenderer(kind: string, renderer: TransitionRenderer): void {
  if (renderers.has(kind)) throw new Error(`transition renderer "${kind}" is already registered`);
  renderers.set(kind, renderer);
}

export function getTransitionRenderer(kind: string): TransitionRenderer | undefined {
  return renderers.get(kind);
}
