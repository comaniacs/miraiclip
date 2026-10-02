import { TRACK_ACCEPTS, type Project, type Us } from "@miraiclip/core";
import type { ResolvedAudio } from "./types.js";

export interface ImportAudioOptions {
  /** Timeline position for the clip (default: the playhead). */
  atUs?: Us;
  /** Target track. Default: the first audio track free for the clip's span, else a new one. */
  trackId?: string;
  /** Clip length (default: the file's duration, then 10 s). */
  durationUs?: Us;
  volume?: number;
  fadeInUs?: Us;
  fadeOutUs?: Us;
  assetId?: string;
  clipId?: string;
  /** Name for a newly created track (default "Music" / "Sound effects" / "Voice" / "Audio"). */
  trackName?: string;
  /** Add the asset only (no clip). */
  assetOnly?: boolean;
}

export interface ImportAudioResult {
  assetId: string;
  clipId?: string;
  trackId?: string;
}

let seq = 0;
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++seq).toString(36)}`;

const DEFAULT_DURATION_US = 10_000_000;

/** The `asset/add` payload for a resolved file, provenance included. */
export function audioAssetPayload(resolved: ResolvedAudio, id: string) {
  return {
    id,
    kind: "audio" as const,
    src: resolved.src,
    name: resolved.name,
    source: resolved.source,
    ...(resolved.durationUs ? { durationUs: resolved.durationUs } : {}),
    ...(resolved.license ? { license: resolved.license } : {}),
    ...(resolved.attribution ? { attribution: resolved.attribution } : {}),
  };
}

/**
 * Add a resolved file to a project in ONE transaction (one undo step):
 * `asset/add` with source, license and attribution, then `clip/add` on an
 * audio track. If the app copies remote files into its own storage, do that
 * first and pass `{ ...resolved, src: storedUrl }`.
 */
export function importAudio(project: Project, resolved: ResolvedAudio, options: ImportAudioOptions = {}): ImportAudioResult {
  const assetId = options.assetId ?? makeId("audio");
  const result: ImportAudioResult = { assetId };
  project.transaction(() => {
    project.dispatch({ type: "asset/add", payload: audioAssetPayload(resolved, assetId) });
    if (options.assetOnly) return;

    const state = project.getState();
    const doc = state.doc;
    const startUs = Math.max(0, Math.round(options.atUs ?? state.playheadUs));
    const durationUs = Math.max(1, Math.round(options.durationUs ?? resolved.durationUs ?? DEFAULT_DURATION_US));
    const endUs = startUs + durationUs;

    let trackId = options.trackId;
    if (!trackId) {
      const clips = Object.values(doc.clips);
      trackId = doc.trackOrder.find((tid) => {
        const t = doc.tracks[tid];
        if (!t || t.locked || !TRACK_ACCEPTS[t.kind].includes("audio")) return false;
        return !clips.some((c) => c.trackId === tid && c.startUs < endUs && c.startUs + c.durationUs > startUs);
      });
    }
    if (!trackId) {
      trackId = makeId("track");
      const name =
        options.trackName ??
        (resolved.kind === "music" ? "Music" : resolved.kind === "sfx" ? "Sound effects" : resolved.kind === "voice" ? "Voice" : "Audio");
      project.dispatch({ type: "track/add", payload: { id: trackId, kind: "audio", name } });
    }

    const clipId = options.clipId ?? makeId("clip");
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "audio",
        id: clipId,
        trackId,
        assetId,
        startUs,
        durationUs,
        ...(options.volume !== undefined ? { volume: options.volume } : {}),
        ...(options.fadeInUs ? { fadeInUs: options.fadeInUs } : {}),
        ...(options.fadeOutUs ? { fadeOutUs: options.fadeOutUs } : {}),
      },
    });
    result.clipId = clipId;
    result.trackId = trackId;
  }, `add audio: ${resolved.name}`);
  return result;
}
