import type { Draft } from "immer";
import { nanoid } from "nanoid";
import type { z } from "zod";
import { CommandRejectedError } from "../errors.js";
import {
  DEFAULT_TRANSFORM,
  TRACK_ACCEPTS,
  type Asset,
  type Clip,
  type ProjectDocument,
  type Track,
} from "../types.js";
import { builtinPayloadSchemas, type BuiltinCommandType } from "./schemas.js";

/** Applies a validated payload to a draft of the document. */
export type CommandHandler<P = unknown> = (doc: Draft<ProjectDocument>, payload: P) => void;

type Parsed<T extends BuiltinCommandType> = z.output<(typeof builtinPayloadSchemas)[T]>;

function reject(type: string, code: string, message: string): never {
  throw new CommandRejectedError(type, code, message);
}

function getTrack(doc: Draft<ProjectDocument>, type: string, trackId: string): Draft<Track> {
  const track = doc.tracks[trackId];
  if (!track) reject(type, "track-not-found", `no track "${trackId}"`);
  return track;
}

function getClip(doc: Draft<ProjectDocument>, type: string, clipId: string): Draft<Clip> {
  const clip = doc.clips[clipId];
  if (!clip) reject(type, "clip-not-found", `no clip "${clipId}"`);
  return clip;
}

function assertTrackAccepts(type: string, track: Track, clipKind: Clip["kind"]): void {
  if (!TRACK_ACCEPTS[track.kind].includes(clipKind)) {
    reject(
      type,
      "kind-mismatch",
      `track "${track.id}" (${track.kind}) does not accept ${clipKind} clips`,
    );
  }
}

function assertUniqueId(
  type: string,
  map: Record<string, unknown>,
  id: string,
  what: string,
): void {
  if (id in map) reject(type, "duplicate-id", `${what} "${id}" already exists`);
}

export const builtinHandlers: {
  [T in BuiltinCommandType]: CommandHandler<Parsed<T>>;
} = {
  "project/set-settings": (doc, p) => {
    Object.assign(doc.settings, p);
  },

  "asset/add": (doc, p) => {
    assertUniqueId("asset/add", doc.assets, p.id, "asset");
    const asset: Asset = { id: p.id, kind: p.kind, src: p.src };
    if (p.durationUs !== undefined) asset.durationUs = p.durationUs;
    if (p.width !== undefined) asset.width = p.width;
    if (p.height !== undefined) asset.height = p.height;
    if (p.fps !== undefined) asset.fps = p.fps;
    doc.assets[p.id] = asset;
  },
  "asset/remove": (doc, p) => {
    if (!doc.assets[p.id]) reject("asset/remove", "asset-not-found", `no asset "${p.id}"`);
    const used = Object.values(doc.clips).some(
      (c) => "assetId" in c && c.assetId === p.id,
    );
    if (used) reject("asset/remove", "asset-in-use", `asset "${p.id}" is used by clips`);
    delete doc.assets[p.id];
  },

  "track/add": (doc, p) => {
    assertUniqueId("track/add", doc.tracks, p.id, "track");
    doc.tracks[p.id] = {
      id: p.id,
      kind: p.kind,
      name: p.name ?? p.id,
      muted: false,
      solo: false,
      locked: false,
    };
    const index = Math.min(p.index ?? doc.trackOrder.length, doc.trackOrder.length);
    doc.trackOrder.splice(index, 0, p.id);
  },
  "track/remove": (doc, p) => {
    getTrack(doc, "track/remove", p.id);
    for (const clip of Object.values(doc.clips)) {
      if (clip.trackId === p.id) delete doc.clips[clip.id];
    }
    doc.trackOrder = doc.trackOrder.filter((tid) => tid !== p.id);
    delete doc.tracks[p.id];
  },
  "track/reorder": (doc, p) => {
    getTrack(doc, "track/reorder", p.trackId);
    const from = doc.trackOrder.indexOf(p.trackId);
    doc.trackOrder.splice(from, 1);
    doc.trackOrder.splice(Math.min(p.index, doc.trackOrder.length), 0, p.trackId);
  },
  "track/rename": (doc, p) => {
    getTrack(doc, "track/rename", p.trackId).name = p.name;
  },
  "track/set-property": (doc, p) => {
    const track = getTrack(doc, "track/set-property", p.trackId);
    if (p.muted !== undefined) track.muted = p.muted;
    if (p.solo !== undefined) track.solo = p.solo;
    if (p.locked !== undefined) track.locked = p.locked;
  },

  "clip/add": (doc, p) => {
    assertUniqueId("clip/add", doc.clips, p.id, "clip");
    const track = getTrack(doc, "clip/add", p.trackId);
    assertTrackAccepts("clip/add", track, p.kind);
    if (p.kind !== "text" && !doc.assets[p.assetId]) {
      reject("clip/add", "asset-not-found", `no asset "${p.assetId}"`);
    }
    const transform = { ...DEFAULT_TRANSFORM, ...p.transform };
    const { transform: _t, ...rest } = p;
    doc.clips[p.id] = { ...rest, transform } as Clip;
  },
  "clip/remove": (doc, p) => {
    getClip(doc, "clip/remove", p.clipId);
    delete doc.clips[p.clipId];
  },
  "clip/move": (doc, p) => {
    const clip = getClip(doc, "clip/move", p.clipId);
    if (p.trackId !== undefined && p.trackId !== clip.trackId) {
      const track = getTrack(doc, "clip/move", p.trackId);
      assertTrackAccepts("clip/move", track, clip.kind);
      clip.trackId = p.trackId;
    }
    if (p.startUs !== undefined) clip.startUs = p.startUs;
  },
  "clip/trim": (doc, p) => {
    const clip = getClip(doc, "clip/trim", p.clipId);
    if (p.startUs !== undefined) clip.startUs = p.startUs;
    if (p.durationUs !== undefined) clip.durationUs = p.durationUs;
    if (p.trimStartUs !== undefined) {
      if (!("trimStartUs" in clip)) {
        reject("clip/trim", "not-trimmable", `${clip.kind} clips have no source trim`);
      }
      clip.trimStartUs = p.trimStartUs;
    }
  },
  "clip/split": (doc, p) => {
    const clip = getClip(doc, "clip/split", p.clipId);
    const endUs = clip.startUs + clip.durationUs;
    if (p.atUs <= clip.startUs || p.atUs >= endUs) {
      reject(
        "clip/split",
        "out-of-range",
        `atUs ${p.atUs} is outside clip "${p.clipId}" (${clip.startUs}..${endUs})`,
      );
    }
    const newId = p.newClipId ?? nanoid();
    assertUniqueId("clip/split", doc.clips, newId, "clip");
    const offset = p.atUs - clip.startUs;
    const right: Clip = {
      ...(JSON.parse(JSON.stringify(clip)) as Clip),
      id: newId,
      startUs: p.atUs,
      durationUs: clip.durationUs - offset,
    };
    if ("trimStartUs" in right) right.trimStartUs += offset;
    clip.durationUs = offset;
    doc.clips[newId] = right;
  },
  "clip/duplicate": (doc, p) => {
    const clip = getClip(doc, "clip/duplicate", p.clipId);
    const newId = p.newClipId ?? nanoid();
    assertUniqueId("clip/duplicate", doc.clips, newId, "clip");
    const copy: Clip = {
      ...(JSON.parse(JSON.stringify(clip)) as Clip),
      id: newId,
    };
    if (p.startUs !== undefined) copy.startUs = p.startUs;
    if (p.trackId !== undefined) {
      const track = getTrack(doc, "clip/duplicate", p.trackId);
      assertTrackAccepts("clip/duplicate", track, copy.kind);
      copy.trackId = p.trackId;
    }
    doc.clips[newId] = copy;
  },
  "clip/set-property": (doc, p) => {
    const clip = getClip(doc, "clip/set-property", p.clipId);
    if (p.transform) Object.assign(clip.transform, p.transform);
    if (p.volume !== undefined) {
      if (!("volume" in clip)) {
        reject("clip/set-property", "no-audio", `${clip.kind} clips have no volume`);
      }
      clip.volume = p.volume;
    }
    for (const key of ["text", "fontFamily", "fontSizePx", "color"] as const) {
      if (p[key] !== undefined) {
        if (clip.kind !== "text") {
          reject("clip/set-property", "not-text", `"${key}" only applies to text clips`);
        }
        (clip as Record<typeof key, unknown>)[key] = p[key];
      }
    }
  },
};
