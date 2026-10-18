/**
 * Effect regions evaluated at a clip-relative time: the one function preview,
 * export and stills share, so a moving redaction box lands in the same place
 * everywhere.
 */
import { evaluateKeyframes } from "./animation.js";
import type { Clip, EffectInstance, EffectRegion, Us } from "./types.js";

export interface EvaluatedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  shape: "rect" | "ellipse";
  feather: number;
  invert: boolean;
}

/** The region's rectangle at `localUs` (clip-relative), with defaults filled in. */
export function evaluateEffectRegion(region: EffectRegion, localUs: Us, clipDurationUs?: Us): EvaluatedRegion {
  const a = region.animations;
  const at = (prop: "x" | "y" | "width" | "height"): number => {
    const keyframes = a?.[prop];
    return keyframes && keyframes.length ? evaluateKeyframes(keyframes, localUs, region[prop], clipDurationUs) : region[prop];
  };
  return {
    x: at("x"),
    y: at("y"),
    width: Math.max(0, at("width")),
    height: Math.max(0, at("height")),
    shape: region.shape ?? "rect",
    feather: region.feather ?? 0,
    invert: region.invert ?? false,
  };
}

/** True when any enabled effect on the clip has a keyframed region (renderers update it every frame). */
export function hasAnimatedEffectRegion(clip: Clip): boolean {
  return (clip.effects ?? []).some(
    (e: EffectInstance) => e.enabled && e.region?.animations && Object.values(e.region.animations).some((k) => k && k.length > 0),
  );
}
