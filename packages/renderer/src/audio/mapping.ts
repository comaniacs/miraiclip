/**
 * Pure clip-audio math shared by realtime playback (AudioEngine) and offline
 * export mixing — one source of truth for gains, trims, and chunk mapping so
 * preview and export can never disagree about what a composition sounds like.
 */
import type { AudioClip, Clip, ProjectDocument, VideoClip } from "@miraiclip/core";
import type { Us } from "../media/types.js";

/** Clips that can make sound: audio clips, and video clips (embedded track). */
export function isAudible(clip: Clip): clip is VideoClip | AudioClip {
  return clip.kind === "audio" || clip.kind === "video";
}

/** Effective gain: clip volume × track mute/solo state. */
export function gainFor(clip: VideoClip | AudioClip, doc: ProjectDocument): number {
  const track = doc.tracks[clip.trackId];
  if (!track) return 0;
  const anySolo = Object.values(doc.tracks).some((t) => t.solo);
  const audible = !track.muted && (!anySolo || track.solo);
  return audible ? clip.volume : 0;
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
