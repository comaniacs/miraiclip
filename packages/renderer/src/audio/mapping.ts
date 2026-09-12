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
 * Effective gain: clip volume × track mute/solo state. Pass `atTimelineUs`
 * to honor volume keyframes; omitted, the clip's static volume applies.
 */
export function gainFor(
  clip: VideoClip | AudioClip,
  doc: ProjectDocument,
  atTimelineUs?: Us,
): number {
  const gate = trackGate(clip, doc);
  if (gate === 0) return 0;
  return atTimelineUs === undefined ? clip.volume : clipVolumeAt(clip, atTimelineUs);
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
 * the step. Returns null when the clip's volume is not animated — callers
 * use a plain setGain.
 */
export function volumeAutomation(
  clip: VideoClip | AudioClip,
  doc: ProjectDocument,
  fromTimelineUs: Us,
  toTimelineUs: Us,
): GainPoint[] | null {
  const keyframes = clip.animations?.volume;
  if (!keyframes || keyframes.length === 0) return null;
  const gate = trackGate(clip, doc);
  const times = new Set<Us>([fromTimelineUs, toTimelineUs]);
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
    .map((atTimelineUs) => ({ atTimelineUs, value: gate * clipVolumeAt(clip, atTimelineUs) }));
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
