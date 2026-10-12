import type { Project, Transform } from "@miraiclip/core";
import { createCommands } from "./commands.js";
import { beginGesture, type Gesture } from "./gesture.js";

/**
 * Moving, scaling and rotating a clip on the preview, with no DOM. Geometry
 * is in composition pixels (the project's width × height); a view converts
 * pointer positions into that space and draws the result.
 */

/** A point in composition pixels. */
export interface CompositionPoint {
  xPx: number;
  yPx: number;
}

/**
 * Where a clip is drawn. Structurally the renderer's `ClipBounds`
 * (`getClipBounds` / `hitTest` on the preview), so those can be passed as is.
 */
export interface TransformBounds {
  clipId: string;
  /** The placement point (transform x/y in pixels). Scale and rotation pivot here. */
  originXPx: number;
  originYPx: number;
  /** Center of the drawn content. */
  centerXPx: number;
  centerYPx: number;
  scale: number;
  rotationDeg: number;
  /** Corners clockwise from top-left, rotation applied. */
  corners: readonly [CompositionPoint, CompositionPoint, CompositionPoint, CompositionPoint];
}

export type TransformDragMode = "move" | "scale" | "rotate";

export interface TransformDragOptions {
  /** Snap distance for moves, in composition px (0, the default, turns snapping off). */
  snapThresholdPx?: number;
  /** Movement below this (composition px) is a click, not a drag (default 0). */
  dragThresholdPx?: number;
  /** Scale limits (default 0.05 … 20). */
  minScale?: number;
  maxScale?: number;
}

export interface TransformModifiers {
  /** Move: place freely, without snapping. */
  altKey?: boolean;
  /** Rotate: 15° steps. */
  shiftKey?: boolean;
}

/** Frame lines a move snapped to, in composition px, for drawing guides. */
export interface TransformGuides {
  x: number[];
  y: number[];
}

export interface TransformDrag {
  readonly clipId: string;
  readonly mode: TransformDragMode;
  /** True once the pointer passed the drag threshold. */
  readonly moved: boolean;
  /** Pointer moved to `point` (composition px). Applies the edit live and returns the guides to show. */
  update(point: { x: number; y: number }, modifiers?: TransformModifiers): TransformGuides;
  /** Finish: the drag is one undo step. */
  end(): void;
}

const NO_GUIDES: TransformGuides = { x: [], y: [] };

/** True when the clip can be moved on the preview: it exists, is visual, and its track isn't locked. */
export function canTransformClip(project: Project, clipId: string): boolean {
  const doc = project.getState().doc;
  const clip = doc.clips[clipId];
  if (!clip || clip.kind === "audio") return false;
  const track = doc.tracks[clip.trackId];
  return !!track && !track.locked;
}

/**
 * Write transform values. A property with keyframes gets a keyframe at the
 * playhead; the others change the clip's static transform.
 */
export function writeClipTransform(project: Project, clipId: string, patch: Partial<Transform>): void {
  const clip = project.getState().doc.clips[clipId];
  if (!clip) return;
  const statics: Partial<Transform> = {};
  const timeUs = Math.round(Math.max(0, project.getState().playheadUs - clip.startUs));
  for (const [property, value] of Object.entries(patch) as [keyof Transform, number][]) {
    if ((clip.animations?.[property]?.length ?? 0) > 0) {
      project.dispatch({ type: "keyframe/set", payload: { clipId, property, timeUs, value } });
    } else statics[property] = value;
  }
  if (Object.keys(statics).length) createCommands(project).setClipProperty(clipId, { transform: statics });
}

/**
 * Snap the closest candidate to the closest target within `thresholdPx`.
 * Returns the offset to add and the target hit, or null.
 */
export function snapOffset(
  candidates: readonly number[],
  targets: readonly number[],
  thresholdPx: number,
): { delta: number; target: number } | null {
  let best: { delta: number; target: number } | null = null;
  for (const c of candidates) {
    for (const t of targets) {
      const delta = t - c;
      if (Math.abs(delta) <= thresholdPx && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, target: t };
    }
  }
  return best;
}

/**
 * Start moving, scaling or rotating a clip from `bounds` (where it is drawn
 * now, keyframes evaluated). `start` is the pointer in composition px.
 * Returns null when the clip can't be transformed (missing, audio, locked).
 *
 * Moves snap the content's box (edges and center) to the frame's edges and
 * center; scale is uniform around the origin; rotation snaps gently to
 * right angles, or to 15° steps with Shift.
 */
export function beginTransformDrag(
  project: Project,
  bounds: TransformBounds,
  mode: TransformDragMode,
  start: { x: number; y: number },
  options: TransformDragOptions = {},
): TransformDrag | null {
  if (!canTransformClip(project, bounds.clipId)) return null;
  const { width: W, height: H } = project.getState().doc.settings;
  const snapPx = options.snapThresholdPx ?? 0;
  const threshold = options.dragThresholdPx ?? 0;
  const minScale = options.minScale ?? 0.05;
  const maxScale = options.maxScale ?? 20;
  const startTransform = {
    x: bounds.originXPx / W,
    y: bounds.originYPx / H,
    scale: bounds.scale,
    rotation: bounds.rotationDeg,
  };
  const gesture: Gesture = beginGesture(project, mode === "move" ? "move clip" : mode === "scale" ? "scale clip" : "rotate clip");
  const clipId = bounds.clipId;
  let moved = false;

  return {
    clipId,
    mode,
    get moved() {
      return moved;
    },
    update(point, modifiers = {}) {
      const dx = point.x - start.x;
      const dy = point.y - start.y;
      if (!moved && Math.hypot(dx, dy) < threshold) return NO_GUIDES;
      moved = true;

      if (mode === "move") {
        let ox = dx;
        let oy = dy;
        const guides: TransformGuides = { x: [], y: [] };
        if (snapPx > 0 && !modifiers.altKey) {
          const xs = bounds.corners.map((c) => c.xPx + dx);
          const ys = bounds.corners.map((c) => c.yPx + dy);
          const sx = snapOffset([Math.min(...xs), bounds.centerXPx + dx, Math.max(...xs)], [0, W / 2, W], snapPx);
          const sy = snapOffset([Math.min(...ys), bounds.centerYPx + dy, Math.max(...ys)], [0, H / 2, H], snapPx);
          if (sx) {
            ox += sx.delta;
            guides.x.push(sx.target);
          }
          if (sy) {
            oy += sy.delta;
            guides.y.push(sy.target);
          }
        }
        gesture.update(() =>
          writeClipTransform(project, clipId, { x: round4(startTransform.x + ox / W), y: round4(startTransform.y + oy / H) }),
        );
        return guides;
      }

      if (mode === "scale") {
        const r0 = Math.hypot(start.x - bounds.originXPx, start.y - bounds.originYPx);
        const r1 = Math.hypot(point.x - bounds.originXPx, point.y - bounds.originYPx);
        if (r0 < 1) return NO_GUIDES;
        const scale = clamp(startTransform.scale * (r1 / r0), minScale, maxScale);
        gesture.update(() => writeClipTransform(project, clipId, { scale: round4(scale) }));
        return NO_GUIDES;
      }

      const a0 = Math.atan2(start.y - bounds.centerYPx, start.x - bounds.centerXPx);
      const a1 = Math.atan2(point.y - bounds.centerYPx, point.x - bounds.centerXPx);
      let deg = startTransform.rotation + ((a1 - a0) * 180) / Math.PI;
      deg = ((((deg + 180) % 360) + 360) % 360) - 180; // -180 … 180
      if (modifiers.shiftKey) deg = Math.round(deg / 15) * 15;
      else if (Math.abs(deg - Math.round(deg / 90) * 90) < 3) deg = Math.round(deg / 90) * 90;
      gesture.update(() => writeClipTransform(project, clipId, { rotation: Math.round(deg * 10) / 10 }));
      return NO_GUIDES;
    },
    end() {
      gesture.end();
    },
  };
}

/** Move a clip by whole composition pixels (arrow-key nudges), as one undo step. Returns false when it can't move. */
export function nudgeClip(project: Project, bounds: TransformBounds, dxPx: number, dyPx: number): boolean {
  if (!canTransformClip(project, bounds.clipId) || (!dxPx && !dyPx)) return false;
  const { width: W, height: H } = project.getState().doc.settings;
  project.transaction(
    () =>
      writeClipTransform(project, bounds.clipId, {
        ...(dxPx ? { x: round4((bounds.originXPx + dxPx) / W) } : {}),
        ...(dyPx ? { y: round4((bounds.originYPx + dyPx) / H) } : {}),
      }),
    "nudge clip",
  );
  return true;
}

/**
 * Where a rotate handle sits: `distancePx` beyond the middle of the top
 * edge, along the content's "up". Returns the handle and the edge midpoint
 * (for a connecting line), in composition px.
 */
export function rotateHandlePosition(
  bounds: TransformBounds,
  distancePx: number,
): { handle: CompositionPoint; anchor: CompositionPoint } {
  const [tl, tr] = bounds.corners;
  const anchor = { xPx: (tl.xPx + tr.xPx) / 2, yPx: (tl.yPx + tr.yPx) / 2 };
  const rad = (bounds.rotationDeg * Math.PI) / 180;
  const flip = bounds.scale < 0 ? -1 : 1;
  return {
    anchor,
    handle: { xPx: anchor.xPx + Math.sin(rad) * distancePx * flip, yPx: anchor.yPx - Math.cos(rad) * distancePx * flip },
  };
}

const CURSORS = ["nwse-resize", "nesw-resize", "nwse-resize", "nesw-resize"] as const;

/** CSS resize cursor for corner `index` (0 top-left, clockwise), adjusted for rotation. */
export function cornerCursor(index: number, rotationDeg: number): string {
  const steps = Math.round((((rotationDeg % 180) + 180) % 180) / 90);
  return CURSORS[(index + steps) % 4]!;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round4 = (v: number) => Math.round(v * 10_000) / 10_000;
