/**
 * Clip time-remap: how a media clip's timeline time maps to its source.
 *
 * A video or audio clip plays its source at a constant `speed` (absent = 1).
 * `speed: 2` plays twice as fast (a 4 s clip shows 8 s of footage), `0.5`
 * plays at half speed, and `speed: 0` is a freeze frame: every frame of the
 * clip shows the source frame at `trimStartUs`, and it makes no sound.
 *
 * Every renderer path (preview, audio, browser export, worker export, server
 * export) maps time through these helpers, so they can never disagree.
 */
import type { Clip, ProjectDocument, Us } from "./types.js";

/** Slowest non-frozen speed (1/16×). */
export const MIN_CLIP_SPEED = 1 / 16;
/** Fastest speed (16×). */
export const MAX_CLIP_SPEED = 16;

/** The clip's playback speed: its `speed` when it has a source, else 1. */
export function clipSpeed(clip: Clip): number {
  if (!("trimStartUs" in clip)) return 1;
  const speed = (clip as { speed?: number }).speed;
  return speed === undefined ? 1 : speed;
}

/** True for a freeze-frame clip (`speed: 0`). */
export function isFrozenClip(clip: Clip): boolean {
  return clipSpeed(clip) === 0;
}

/** Whether a speed value is allowed: 0 (freeze) or within MIN..MAX. */
export function isValidClipSpeed(speed: number): boolean {
  return speed === 0 || (Number.isFinite(speed) && speed >= MIN_CLIP_SPEED && speed <= MAX_CLIP_SPEED);
}

/**
 * Timeline position → position in the clip's source media. Exact for speed 1
 * (`trimStartUs + offset`), rounded to whole µs otherwise.
 */
export function toSourceUs(clip: Clip, timelineUs: Us): Us {
  const trim = "trimStartUs" in clip ? (clip as { trimStartUs: Us }).trimStartUs : 0;
  const speed = clipSpeed(clip);
  const offset = timelineUs - clip.startUs;
  if (speed === 1) return trim + offset;
  return trim + Math.round(offset * speed);
}

/**
 * Source position → timeline position for this clip (the inverse of
 * `toSourceUs`). Undefined for a frozen clip, where every timeline instant
 * shows the same source frame.
 */
export function toTimelineUs(clip: Clip, sourceUs: Us): Us | undefined {
  const trim = "trimStartUs" in clip ? (clip as { trimStartUs: Us }).trimStartUs : 0;
  const speed = clipSpeed(clip);
  if (speed === 0) return undefined;
  if (speed === 1) return clip.startUs + (sourceUs - trim);
  return clip.startUs + (sourceUs - trim) / speed;
}

/** How much source media the clip consumes (0 for a freeze frame). */
export function sourceSpanUs(clip: Clip): Us {
  const speed = clipSpeed(clip);
  return speed === 1 ? clip.durationUs : Math.round(clip.durationUs * speed);
}

/** Source position just past the clip's last frame. */
export function sourceEndUs(clip: Clip): Us {
  const trim = "trimStartUs" in clip ? (clip as { trimStartUs: Us }).trimStartUs : 0;
  return trim + sourceSpanUs(clip);
}

/**
 * Timeline length a clip needs to play `sourceUs` of media at `speed`
 * (at least 1 µs). Used when a speed change keeps the same footage.
 */
export function durationForSource(sourceUs: Us, speed: number): Us {
  if (speed === 0) return Math.max(1, sourceUs);
  return Math.max(1, Math.round(sourceUs / speed));
}

/**
 * Spare footage on one side of a clip, in TIMELINE µs at the clip's speed:
 * what a transition centered on its edge can borrow. Infinite for clips with
 * no source and for freeze frames (the frame simply holds).
 */
export function clipHeadroomTimelineUs(doc: ProjectDocument, clip: Clip, side: "in" | "out"): number {
  if (!("assetId" in clip) || !("trimStartUs" in clip)) return Number.POSITIVE_INFINITY;
  const speed = clipSpeed(clip);
  if (speed === 0) return Number.POSITIVE_INFINITY;
  const trim = (clip as { trimStartUs: Us }).trimStartUs;
  if (side === "in") return trim / speed;
  const asset = doc.assets[(clip as { assetId: string }).assetId];
  if (!asset || asset.durationUs === undefined) return Number.POSITIVE_INFINITY;
  return Math.max(0, asset.durationUs - sourceEndUs(clip)) / speed;
}
