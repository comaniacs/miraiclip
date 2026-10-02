/**
 * Pure clip-audio math shared by realtime playback (AudioEngine) and offline
 * export mixing — one source of truth for gains, trims, and chunk mapping so
 * preview and export can never disagree about what a composition sounds like.
 */
import {
  evaluateKeyframes,
  isAudioClip,
  isVideoClip,
  type AudioClip,
  type Clip,
  type ProjectDocument,
  type VideoClip,
} from "@miraiclip/core";
import type { Us } from "../media/types.js";
import { transitionGainAt, transitionRampTimes } from "../transitions/timing.js";

/** Clips that can make sound: audio clips, and video clips (embedded track). */
export function isAudible(clip: Clip): clip is VideoClip | AudioClip {
  return isVideoClip(clip) || isAudioClip(clip);
}

/** The track's mute/solo gate: 1 when audible, 0 when muted or soloed out. */
export function trackGate(clip: VideoClip | AudioClip, doc: ProjectDocument): number {
  const track = doc.tracks[clip.trackId];
  if (!track) return 0;
  const anySolo = Object.values(doc.tracks).some((t) => t.solo);
  return !track.muted && (!anySolo || track.solo) ? 1 : 0;
}

/** The clip's volume at a timeline position — animated when volume keyframes exist. */
export function clipVolumeAt(clip: VideoClip | AudioClip, timelineUs: Us): number {
  const keyframes = clip.animations?.volume;
  if (!keyframes || keyframes.length === 0) return clip.volume;
  return evaluateKeyframes(keyframes, timelineUs - clip.startUs, clip.volume);
}

/**
 * The clip's fade envelope (0..1) at a timeline position: a linear ramp up
 * over `fadeInUs` from the clip start and down over `fadeOutUs` to its end.
 * Fades longer than the clip are scaled down proportionally so they meet.
 */
export function clipFades(clip: VideoClip | AudioClip): { inUs: Us; outUs: Us } {
  const fadeIn = Math.max(0, clip.fadeInUs ?? 0);
  const fadeOut = Math.max(0, clip.fadeOutUs ?? 0);
  const total = fadeIn + fadeOut;
  if (total <= clip.durationUs || total === 0) return { inUs: fadeIn, outUs: fadeOut };
  const k = clip.durationUs / total;
  return { inUs: fadeIn * k, outUs: fadeOut * k };
}

export function fadeGainAt(clip: VideoClip | AudioClip, timelineUs: Us): number {
  const { inUs, outUs } = clipFades(clip);
  if (inUs === 0 && outUs === 0) return 1;
  const intoUs = timelineUs - clip.startUs;
  const leftUs = clip.startUs + clip.durationUs - timelineUs;
  let g = 1;
  if (inUs > 0) g = Math.min(g, Math.max(0, intoUs / inUs));
  if (outUs > 0) g = Math.min(g, Math.max(0, leftUs / outUs));
  return Math.min(1, g);
}

/** Fade corner times inside (from, to) — ramp points that reproduce the envelope exactly. */
function fadeRampTimes(clip: VideoClip | AudioClip, fromUs: Us, toUs: Us): Us[] {
  const { inUs, outUs } = clipFades(clip);
  const endUs = clip.startUs + clip.durationUs;
  const corners: Us[] = [];
  if (inUs > 0) corners.push(clip.startUs, clip.startUs + inUs);
  if (outUs > 0) corners.push(endUs - outUs, endUs);
  return corners.filter((t) => t > fromUs && t < toUs);
}

/** True when the clip's gain changes over time (keyframes or fades). */
export function hasGainEnvelope(clip: VideoClip | AudioClip): boolean {
  return (clip.animations?.volume?.length ?? 0) > 0 || (clip.fadeInUs ?? 0) > 0 || (clip.fadeOutUs ?? 0) > 0;
}

/**
 * Effective gain: clip volume × fades × track mute/solo state. Pass `atTimelineUs`
 * to honor volume keyframes; omitted, the clip's static volume applies.
 */
export function gainFor(
  clip: VideoClip | AudioClip,
  doc: ProjectDocument,
  atTimelineUs?: Us,
): number {
  const gate = trackGate(clip, doc);
  if (gate === 0) return 0;
  if (atTimelineUs === undefined) return clip.volume;
  return (
    clipVolumeAt(clip, atTimelineUs) *
    fadeGainAt(clip, atTimelineUs) *
    transitionGainAt(doc, clip.id, atTimelineUs)
  );
}

export interface GainPoint {
  atTimelineUs: Us;
  value: number;
}

/**
 * Gain automation for a window of timeline time: window endpoints plus every
 * volume-keyframe boundary inside it, ready for `linearRampToValueAtTime`
 * scheduling (per-chunk gain STEPPING produces zipper noise — ramps don't).
 * Hold easings get a pre-point just before the jump so the ramp reproduces
 * the step; fade corners are points too (a linear fade is exact between
 * them). Returns null when the clip's gain is constant — callers use a
 * plain setGain.
 */
export function volumeAutomation(
  clip: VideoClip | AudioClip,
  doc: ProjectDocument,
  fromTimelineUs: Us,
  toTimelineUs: Us,
): GainPoint[] | null {
  const keyframes = clip.animations?.volume ?? [];
  const rampTimes = [
    ...transitionRampTimes(doc, clip.id, fromTimelineUs, toTimelineUs),
    ...fadeRampTimes(clip, fromTimelineUs, toTimelineUs),
  ];
  if (keyframes.length === 0 && rampTimes.length === 0 && !hasGainEnvelope(clip)) return null;
  const gate = trackGate(clip, doc);
  const times = new Set<Us>([fromTimelineUs, toTimelineUs, ...rampTimes]);
  for (let i = 0; i < keyframes.length; i++) {
    const atUs = clip.startUs + keyframes[i]!.timeUs;
    if (atUs > fromTimelineUs && atUs < toTimelineUs) times.add(atUs);
    // A hold segment jumps at the NEXT keyframe: pin the held value just before.
    if (keyframes[i]!.easing.kind === "hold" && i + 1 < keyframes.length) {
      const jumpUs = clip.startUs + keyframes[i + 1]!.timeUs;
      if (jumpUs - 1 > fromTimelineUs && jumpUs - 1 < toTimelineUs) times.add(jumpUs - 1);
    }
  }
  return [...times]
    .sort((a, b) => a - b)
    .map((atTimelineUs) => ({
      atTimelineUs,
      value:
        gate *
        clipVolumeAt(clip, atTimelineUs) *
        fadeGainAt(clip, atTimelineUs) *
        transitionGainAt(doc, clip.id, atTimelineUs),
    }));
}

export interface MappedChunk {
  /** Timeline position where this (possibly clipped) chunk begins playing. */
  playFromTimelineUs: Us;
  /** Offset into the chunk's buffer to start from. */
  offsetIntoChunkUs: Us;
  /** How much of the chunk plays (clipped to the clip's end). */
  durationUs: Us;
}

/**
 * Map a decoded media chunk into timeline time for a clip, clamped to a
 * window start and to the clip's own end.
 * Returns "behind" when the chunk ends before the window (skip it) and
 * "past-end" when it starts after the clip ends (the lane is done).
 */
export function mapChunkToTimeline(
  clip: VideoClip | AudioClip,
  chunkTimestampUs: Us,
  chunkDurationUs: Us,
  windowStartUs: Us,
): MappedChunk | "behind" | "past-end" {
  const clipEndUs = clip.startUs + clip.durationUs;
  const timelineStartUs = clip.startUs + (chunkTimestampUs - clip.trimStartUs);
  const timelineEndUs = timelineStartUs + chunkDurationUs;
  if (timelineEndUs <= windowStartUs) return "behind";
  if (timelineStartUs >= clipEndUs) return "past-end";
  const playFromTimelineUs = Math.max(timelineStartUs, windowStartUs);
  return {
    playFromTimelineUs,
    offsetIntoChunkUs: playFromTimelineUs - timelineStartUs,
    durationUs: Math.min(timelineEndUs, clipEndUs) - playFromTimelineUs,
  };
}
