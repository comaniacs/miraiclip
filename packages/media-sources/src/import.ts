import { TRACK_ACCEPTS, type Project, type Us } from "@miraiclip/core";
import type { ResolvedMedia } from "./types.js";

export interface ImportMediaOptions {
  /** Timeline position for the clip (default: the playhead). */
  atUs?: Us;
  /** Target track. Default: the first video track free for the clip's span, else a new one. */
  trackId?: string;
  /** Clip length (default: a video's duration, 5 s for a photo). */
  durationUs?: Us;
  assetId?: string;
  clipId?: string;
  /** Name for a newly created track (default "Stock"). */
  trackName?: string;
  /** Add the asset only (no clip). */
  assetOnly?: boolean;
}

export interface ImportMediaResult {
  assetId: string;
  clipId?: string;
  trackId?: string;
}

let seq = 0;
const makeId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++seq).toString(36)}`;

const PHOTO_DURATION_US = 5_000_000;
const VIDEO_FALLBACK_US = 10_000_000;

/** The `asset/add` payload for a resolved file, provenance included. */
export function mediaAssetPayload(resolved: ResolvedMedia, id: string) {
  return {
    id,
    kind: resolved.kind === "photo" ? ("image" as const) : ("video" as const),
    src: resolved.src,
    name: resolved.name,
    source: resolved.source,
    ...(resolved.width ? { width: resolved.width } : {}),
    ...(resolved.height ? { height: resolved.height } : {}),
    ...(resolved.kind === "video" && resolved.durationUs ? { durationUs: resolved.durationUs } : {}),
    ...(resolved.license ? { license: resolved.license } : {}),
    ...(resolved.attribution ? { attribution: resolved.attribution } : {}),
  };
}

/**
 * Add a resolved photo or video to a project in ONE transaction (one undo step):
 * `asset/add` with source, license and attribution, then `clip/add` on a video track.
 * Libraries ask you not to hotlink: copy the file into your own storage first and pass
 * `{ ...resolved, src: storedUrl }`.
 */
export function importMedia(
  project: Project,
  resolved: ResolvedMedia,
  options: ImportMediaOptions = {},
): ImportMediaResult {
  const assetId = options.assetId ?? makeId(resolved.kind === "photo" ? "image" : "video");
  const result: ImportMediaResult = { assetId };
  const clipKind = resolved.kind === "photo" ? "image" : "video";
  project.transaction(() => {
    project.dispatch({ type: "asset/add", payload: mediaAssetPayload(resolved, assetId) });
    if (options.assetOnly) return;

    const state = project.getState();
    const doc = state.doc;
    const startUs = Math.max(0, Math.round(options.atUs ?? state.playheadUs));
    const durationUs = Math.max(
      1,
      Math.round(
        options.durationUs ??
          (resolved.kind === "photo" ? PHOTO_DURATION_US : (resolved.durationUs ?? VIDEO_FALLBACK_US)),
      ),
    );
    const endUs = startUs + durationUs;

    let trackId = options.trackId;
    if (!trackId) {
      const clips = Object.values(doc.clips);
      trackId = doc.trackOrder.find((tid) => {
        const t = doc.tracks[tid];
        if (!t || t.locked || !TRACK_ACCEPTS[t.kind].includes(clipKind)) return false;
        return !clips.some(
          (c) => c.trackId === tid && c.startUs < endUs && c.startUs + c.durationUs > startUs,
        );
      });
    }
    if (!trackId) {
      trackId = makeId("track");
      project.dispatch({
        type: "track/add",
        payload: { id: trackId, kind: "video", name: options.trackName ?? "Stock" },
      });
    }

    const clipId = options.clipId ?? makeId("clip");
    project.dispatch({
      type: "clip/add",
      payload: { kind: clipKind, id: clipId, trackId, assetId, startUs, durationUs },
    });
    result.clipId = clipId;
    result.trackId = trackId;
  }, `add ${resolved.kind}: ${resolved.name}`);
  return result;
}
