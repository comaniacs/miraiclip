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
  /**
   * A scale-and-translate of the whole clip about the composition's top-left:
   * a clip centred at (x, y) is drawn at (tx + scale·x, ty + scale·y) and its
   * own scale is multiplied by `scale` (zoomThrough). Composes with other
   * transitions' affines multiplicatively.
   */
  affine?: { scale: number; txPx: number; tyPx: number };
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
   * The clips keep showing their FIRST/LAST frame through the window instead
   * of sourcing media from beyond their bounds, so the kind needs no spare
   * footage (core's `transitionHoldsFrames` mirrors this for validation;
   * a test keeps the two in step). Implies `rendersBothClips`.
   */
  holdsFrames?: boolean;
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

const EASES = {
  linear: (p: number) => p,
  in: (p: number) => p * p * p,
  out: (p: number) => 1 - (1 - p) ** 3,
  inOut: (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
} as const;

/**
 * Zoom through a region of the outgoing clip into the incoming one. The
 * camera dives toward a fixed point so the chosen rect grows to fill the
 * frame; the incoming clip lives inside that rect (scaled 1/Z) and arrives
 * full-frame exactly as the dive ends. Both clips hold a frame — no handles.
 */
const zoomThrough: TransitionRenderer = {
  rendersBothClips: true,
  holdsFrames: true,
  frame: (role, progress, params, { compositionSize: { width: W, height: H } }) => {
    const rect = (params?.["rect"] as { x: number; y: number; w: number; h: number } | undefined) ?? {
      x: 0.375, y: 0.375, w: 0.25, h: 0.25,
    };
    const easeName = params?.["ease"];
    const ease = EASES[(typeof easeName === "string" && easeName in EASES ? easeName : "inOut") as keyof typeof EASES];
    const rw = rect.w * W;
    const rh = rect.h * H;
    const cx = rect.x * W + rw / 2;
    const cy = rect.y * H + rh / 2;
    const Z = Math.max(W / rw, H / rh);
    const fade = Math.min(1, 2 * progress);
    if (!(Z > 1)) return role === "to" ? { opacity: fade } : null;
    const e = ease(progress);
    const z = Z ** e;
    // The camera's fixed point: maps the rect centre to the screen centre at full zoom.
    const fx = (W / 2 - Z * cx) / (1 - Z);
    const fy = (H / 2 - Z * cy) / (1 - Z);
    const camX = fx * (1 - z);
    const camY = fy * (1 - z);
    if (role === "from") return { affine: { scale: z, txPx: camX, tyPx: camY } };
    // Incoming: lives in the world at scale 1/Z, centred on the rect centre.
    const wx = cx - W / (2 * Z);
    const wy = cy - H / (2 * Z);
    return {
      opacity: fade,
      affine: { scale: z / Z, txPx: camX + z * wx, tyPx: camY + z * wy },
    };
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
  zoomThrough,
  dipToBlack: dip(0x000000),
  dipToWhite: dip(0xffffff),
})) {
  renderers.set(kind, renderer);
}

const BUILTIN_TRANSITION_RENDERERS: ReadonlySet<string> = new Set(renderers.keys());

/**
 * Register how a custom transition kind draws. Pair it with core's
 * `registerTransitionKind(kind, paramsSchema)` so commands validate. A kind
 * without a renderer draws as a hard cut at the boundary.
 */
export function registerTransitionRenderer(
  kind: string,
  renderer: TransitionRenderer,
  options?: { replace?: boolean },
): void {
  const existing = renderers.get(kind);
  if (existing === renderer) return; // idempotent (plugin loaded twice, HMR re-evaluation)
  if (existing && BUILTIN_TRANSITION_RENDERERS.has(kind)) {
    throw new Error(`"${kind}" is a built-in transition renderer and can't be replaced`);
  }
  if (existing && !options?.replace) throw new Error(`transition renderer "${kind}" is already registered`);
  renderers.set(kind, renderer);
}

/** Remove a custom transition renderer (plugin unload). Returns whether it existed. */
export function unregisterTransitionRenderer(kind: string): boolean {
  if (BUILTIN_TRANSITION_RENDERERS.has(kind)) throw new Error(`"${kind}" is a built-in transition renderer`);
  return renderers.delete(kind);
}

export function getTransitionRenderer(kind: string): TransitionRenderer | undefined {
  return renderers.get(kind);
}
