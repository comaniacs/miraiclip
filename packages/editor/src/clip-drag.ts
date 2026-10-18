import { TRACK_ACCEPTS, clipSpeed, isAudioClip, isVideoClip, type Clip, type Project, type Us } from "@miraiclip/core";
import { clipsByTrack } from "./selectors.js";

/** What a drag changes: the whole clip, its in-point, or its out-point. */
export type ClipDragMode = "move" | "trim-start" | "trim-end";

/** The dragged clip as it would land right now. Nothing is dispatched until `commit`. */
export interface ClipDragPreview {
  clipId: string;
  mode: ClipDragMode;
  originTrackId: string;
  /** The track it would land on (differs from `originTrackId` only when moving across tracks). */
  trackId: string;
  startUs: Us;
  durationUs: Us;
}

export interface ClipDragOptions {
  /**
   * Snap distance in µs. Callers usually derive it from a pixel distance at
   * the current zoom: `pxToUs(8, pxPerSecond)`. 0 turns snapping off.
   */
  snapThresholdUs: Us;
  /** Shortest a trim can make the clip (default 200 ms). */
  minDurationUs?: Us;
  /** Snap targets in µs. Default: 0, the playhead, and every other clip edge on the clip's track. */
  snapTargets?: readonly Us[];
}

export interface ClipDrag {
  readonly preview: ClipDragPreview;
  /**
   * Pointer moved: `deltaUs` is the horizontal movement since the drag began;
   * `overTrackId` the track under the pointer (move only). A track that is
   * locked or can't hold this clip kind is ignored.
   */
  update(deltaUs: Us, overTrackId?: string): ClipDragPreview;
  /** Dispatch the result as one `clip/move` or `clip/trim`. Returns false when nothing changed. */
  commit(): boolean;
}

/** The value in `targets` closest to `valueUs` within `thresholdUs`, else `valueUs` itself. */
export function snapToTargets(valueUs: Us, targets: readonly Us[], thresholdUs: Us): Us {
  let best = valueUs;
  let bestDelta = thresholdUs;
  for (const target of targets) {
    const delta = Math.abs(target - valueUs);
    if (delta <= bestDelta) {
      bestDelta = delta;
      best = target;
    }
  }
  return best;
}

/** Default snap targets for a clip: 0, the playhead, and the other clips' edges on its track. */
export function clipSnapTargets(project: Project, clip: Clip): Us[] {
  const state = project.getState();
  const targets: Us[] = [0, state.playheadUs];
  for (const other of clipsByTrack(state.doc.clips).get(clip.trackId) ?? []) {
    if (other.id !== clip.id) targets.push(other.startUs, other.startUs + other.durationUs);
  }
  return targets;
}

/**
 * Start dragging a clip (move, or trim either edge) with snapping. Pure: the
 * caller turns pointer events into `update(deltaUs, overTrackId)` and calls
 * `commit()` on release, so a drag is one undo step. Returns null when the
 * clip doesn't exist or sits on a locked track.
 */
export function beginClipDrag(
  project: Project,
  clipId: string,
  mode: ClipDragMode,
  options: ClipDragOptions,
): ClipDrag | null {
  const { doc } = project.getState();
  const clip = doc.clips[clipId];
  if (!clip || doc.tracks[clip.trackId]?.locked) return null;

  const minDurationUs = options.minDurationUs ?? 200_000;
  const targets = options.snapTargets ?? clipSnapTargets(project, clip);
  const threshold = options.snapThresholdUs;
  const origin = {
    startUs: clip.startUs,
    durationUs: clip.durationUs,
    endUs: clip.startUs + clip.durationUs,
    trackId: clip.trackId,
    trimStartUs: isVideoClip(clip) || isAudioClip(clip) ? clip.trimStartUs : undefined,
    speed: clipSpeed(clip),
  };
  let preview: ClipDragPreview = {
    clipId,
    mode,
    originTrackId: clip.trackId,
    trackId: clip.trackId,
    startUs: clip.startUs,
    durationUs: clip.durationUs,
  };

  const acceptsClip = (trackId: string): boolean => {
    const track = project.getState().doc.tracks[trackId];
    return !!track && !track.locked && (TRACK_ACCEPTS[track.kind] as readonly string[]).includes(clip.kind);
  };

  return {
    get preview() {
      return preview;
    },
    update(deltaUs, overTrackId) {
      if (mode === "move") {
        let startUs = Math.max(0, origin.startUs + deltaUs);
        // Snap whichever edge is closer to a target: the start first, then the end.
        const snappedStart = snapToTargets(startUs, targets, threshold);
        const snappedEnd = snapToTargets(startUs + origin.durationUs, targets, threshold);
        if (snappedStart !== startUs) startUs = snappedStart;
        else if (snappedEnd !== startUs + origin.durationUs) startUs = snappedEnd - origin.durationUs;
        const trackId = overTrackId && acceptsClip(overTrackId) ? overTrackId : origin.trackId;
        preview = { ...preview, trackId, startUs: Math.round(Math.max(0, startUs)) };
      } else if (mode === "trim-end") {
        let endUs = origin.startUs + Math.max(minDurationUs, origin.durationUs + deltaUs);
        endUs = snapToTargets(endUs, targets, threshold);
        preview = { ...preview, durationUs: Math.round(Math.max(minDurationUs, endUs - origin.startUs)) };
      } else {
        // trim-start: move the in-point, keep the out-point fixed.
        const latest = origin.endUs - minDurationUs;
        let startUs = Math.min(latest, Math.max(0, origin.startUs + deltaUs));
        startUs = Math.min(latest, Math.max(0, snapToTargets(startUs, targets, threshold)));
        const rounded = Math.round(startUs);
        preview = { ...preview, startUs: rounded, durationUs: origin.endUs - rounded };
      }
      return preview;
    },
    commit() {
      if (mode === "move") {
        const moved = preview.startUs !== origin.startUs;
        const crossed = preview.trackId !== origin.trackId;
        if (!moved && !crossed) return false;
        project.dispatch({
          type: "clip/move",
          payload: { clipId, startUs: preview.startUs, ...(crossed ? { trackId: preview.trackId } : {}) },
        });
        return true;
      }
      if (mode === "trim-end") {
        if (preview.durationUs === origin.durationUs) return false;
        project.dispatch({ type: "clip/trim", payload: { clipId, durationUs: preview.durationUs } });
        return true;
      }
      if (preview.startUs === origin.startUs) return false;
      project.dispatch({
        type: "clip/trim",
        payload: {
          clipId,
          startUs: preview.startUs,
          durationUs: preview.durationUs,
          // Media clips keep their content in place: the source in-point moves with the edge.
          ...(origin.trimStartUs !== undefined
            ? { trimStartUs: Math.max(0, origin.trimStartUs + Math.round((preview.startUs - origin.startUs) * origin.speed)) }
            : {}),
        },
      });
      return true;
    },
  };
}
