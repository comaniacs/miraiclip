import { TRACK_ACCEPTS, US_PER_SECOND, type Project, type Us } from "@miraiclip/core";
import { newId } from "./ids.js";
import { isTrackFree } from "./selectors.js";

export interface PlaceAssetOptions {
  /** Id for the new clip (default: a generated `clip-…` id). */
  clipId?: string;
  /** Length of a still image clip (default 5 s). */
  imageDurationUs?: Us;
  /** Select the new clip (default true). */
  select?: boolean;
}

const DEFAULT_IMAGE_US = 5 * US_PER_SECOND;

/**
 * Add an asset as a clip on a track (`clip/add`). Returns the clip id, or null
 * when the asset or track is missing, the track is locked, the track can't
 * hold that kind, or the asset isn't placeable (fonts).
 */
export function placeAssetOnTrack(
  project: Project,
  assetId: string,
  trackId: string,
  startUs: Us,
  options: PlaceAssetOptions = {},
): string | null {
  const { doc } = project.getState();
  const asset = doc.assets[assetId];
  const track = doc.tracks[trackId];
  if (!asset || !track || track.locked) return null;
  if (!(TRACK_ACCEPTS[track.kind] as readonly string[]).includes(asset.kind)) return null;
  if (asset.kind !== "video" && asset.kind !== "audio" && asset.kind !== "image") return null;

  const id = options.clipId ?? newId("clip");
  const start = Math.max(0, Math.round(startUs));
  const imageUs = options.imageDurationUs ?? DEFAULT_IMAGE_US;
  const durationUs = asset.kind === "image" ? imageUs : asset.durationUs ?? imageUs;
  project.dispatch({
    type: "clip/add",
    payload: { kind: asset.kind, id, trackId, assetId, startUs: start, durationUs },
  });
  if (options.select ?? true) project.setSelection([id]);
  return id;
}

/**
 * Add an asset at the playhead on the first accepting, unlocked track that is
 * free for the clip's span; when none is, add a new track after the last
 * accepting one. One undo step either way. Returns the clip id or null.
 */
export function placeAssetAtPlayhead(
  project: Project,
  assetId: string,
  options: PlaceAssetOptions = {},
): string | null {
  const state = project.getState();
  const { doc } = state;
  const asset = doc.assets[assetId];
  if (!asset) return null;
  const imageUs = options.imageDurationUs ?? DEFAULT_IMAGE_US;
  const startUs = Math.round(state.playheadUs);
  const endUs = startUs + (asset.kind === "image" ? imageUs : asset.durationUs ?? imageUs);
  const accepting = doc.trackOrder.filter((trackId) => {
    const track = doc.tracks[trackId];
    return !!track && !track.locked && (TRACK_ACCEPTS[track.kind] as readonly string[]).includes(asset.kind);
  });
  if (accepting.length === 0) return null;
  const free = accepting.find((trackId) => isTrackFree(doc, trackId, startUs, endUs));

  let placed: string | null = null;
  project.transaction(() => {
    let trackId = free;
    if (!trackId) {
      const kind = doc.tracks[accepting[0]!]!.kind;
      const sameKind = doc.trackOrder.filter((id) => doc.tracks[id]?.kind === kind).length;
      trackId = newId("track");
      project.dispatch({
        type: "track/add",
        payload: {
          id: trackId,
          kind,
          name: `${kind === "audio" ? "Audio" : "Video"} ${sameKind + 1}`,
          index: doc.trackOrder.lastIndexOf(accepting[accepting.length - 1]!) + 1,
        },
      });
    }
    placed = placeAssetOnTrack(project, assetId, trackId, startUs, options);
  }, "add clip");
  return placed;
}
