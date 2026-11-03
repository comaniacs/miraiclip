import type { Clip, EvaluatedClip, ProjectSettings } from "@miraiclip/core";
import type { Placement } from "./types.js";

/** Convert a clip's normalized transform to pixel-space placement. */
export function computePlacement(clip: Clip, settings: ProjectSettings): Placement {
  const { transform } = clip;
  return {
    xPx: transform.x * settings.width,
    yPx: transform.y * settings.height,
    scale: transform.scale,
    scaleX: transform.scaleX ?? 1,
    scaleY: transform.scaleY ?? 1,
    rotationRad: (transform.rotation * Math.PI) / 180,
    opacity: transform.opacity,
  };
}

/** Same conversion from keyframe-evaluated values, written into `out` (alloc-free per tick). */
export function placementFromEvaluated(
  evaluated: EvaluatedClip,
  settings: ProjectSettings,
  out: Placement,
): Placement {
  out.xPx = evaluated.x * settings.width;
  out.yPx = evaluated.y * settings.height;
  out.scale = evaluated.scale;
  out.scaleX = evaluated.scaleX ?? 1;
  out.scaleY = evaluated.scaleY ?? 1;
  out.rotationRad = (evaluated.rotation * Math.PI) / 180;
  out.opacity = evaluated.opacity;
  out.blurPx = Math.min(Math.max(evaluated.blur ?? 0, 0), 0.25) * settings.height;
  out.reveal = Math.min(Math.max(evaluated.reveal ?? 1, 0), 1);
  return out;
}

/** Clips per track are stacked by start time (later starts on top). */
export const Z_PER_TRACK = 10_000;

export function zIndexFor(trackIndex: number, clipIndexInTrack: number): number {
  return trackIndex * Z_PER_TRACK + clipIndexInTrack;
}
