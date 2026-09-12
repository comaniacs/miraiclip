import type { Draft } from "immer";
import { nanoid } from "nanoid";
import type { z } from "zod";
import { resolveEasing } from "../animation.js";
import { CommandRejectedError } from "../errors.js";
import {
  clipKindRegistration,
  effectParamsSchema,
  isBuiltinClipKind,
  transitionParamsSchema,
} from "../registry.js";
import {
  DEFAULT_TRANSFORM,
  TRACK_ACCEPTS,
  type Asset,
  type Clip,
  type EffectInstance,
  type Keyframe,
  type ProjectDocument,
  type Track,
  type Transition,
  type Us,
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
  if (!(TRACK_ACCEPTS[track.kind] as readonly string[]).includes(clipKind)) {
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

/**
 * Editing a clip's timing or removing it breaks any transition attached to
 * it — the transition depends on the exact cut position and headroom. Every
 * command that changes startUs/durationUs/trimStartUs/trackId (or deletes
 * the clip) drops the affected transitions rather than leaving them invalid.
 */
function dropTransitionsTouching(doc: Draft<ProjectDocument>, clipId: string): void {
  for (const transition of Object.values(doc.transitions)) {
    if (transition.fromClipId === clipId || transition.toClipId === clipId) {
      delete doc.transitions[transition.id];
    }
  }
}

function findEffect(
  doc: Draft<ProjectDocument>,
  type: string,
  clipId: string,
  effectId: string,
): { clip: Draft<Clip>; effects: Draft<EffectInstance>[]; index: number } {
  const clip = getClip(doc, type, clipId);
  const effects = clip.effects ?? [];
  const index = effects.findIndex((e) => e.id === effectId);
  if (index < 0) {
    reject(type, "effect-not-found", `clip "${clipId}" has no effect "${effectId}"`);
  }
  return { clip, effects, index };
}

function parseParams(
  type: string,
  what: "effect" | "transition",
  kind: string,
  params: Record<string, unknown>,
): Record<string, unknown> {
  const schema = what === "effect" ? effectParamsSchema(kind) : transitionParamsSchema(kind);
  if (!schema) reject(type, "unknown-kind", `no registered ${what} kind "${kind}"`);
  const result = schema.safeParse(params);
  if (!result.success) {
    reject(type, "invalid-params", `invalid ${kind} params: ${result.error.message}`);
  }
  return result.data as Record<string, unknown>;
}

/**
 * Source headroom on one side of a cut: how much media exists beyond the
 * clip's visible range. Infinite for generated clips (text/image/caption);
 * unknown asset durations are treated as sufficient (probing may fill them
 * in later — export will surface real gaps).
 */
function headroomUs(
  doc: Draft<ProjectDocument>,
  clip: Clip,
  side: "out" | "in",
): number {
  if (!("assetId" in clip) || !("trimStartUs" in clip)) return Number.POSITIVE_INFINITY;
  if (side === "in") return clip.trimStartUs;
  const asset = doc.assets[clip.assetId];
  if (!asset || asset.durationUs === undefined) return Number.POSITIVE_INFINITY;
  return asset.durationUs - (clip.trimStartUs + clip.durationUs);
}

export const builtinHandlers: {
  [T in BuiltinCommandType]: CommandHandler<Parsed<T>>;
} = {
  "project/set-settings": (doc, p) => {
    Object.assign(doc.settings, p);
  },

  "asset/add": (doc, p) => {
    assertUniqueId("asset/add", doc.assets, p.id, "asset");
    if (p.kind === "font" && !p.family) {
      reject("asset/add", "font-needs-family", `font asset "${p.id}" needs a family name`);
    }
    const asset: Asset = { id: p.id, kind: p.kind, src: p.src };
    if (p.durationUs !== undefined) asset.durationUs = p.durationUs;
    if (p.width !== undefined) asset.width = p.width;
    if (p.height !== undefined) asset.height = p.height;
    if (p.fps !== undefined) asset.fps = p.fps;
    if (p.family !== undefined) asset.family = p.family;
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
      if (clip.trackId === p.id) {
        dropTransitionsTouching(doc, clip.id);
        delete doc.clips[clip.id];
      }
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
    const transform = { ...DEFAULT_TRANSFORM };
    for (const key of ["x", "y", "scale", "rotation", "opacity"] as const) {
      const value = p.transform?.[key];
      if (value !== undefined) transform[key] = value;
    }

    // Custom registered kind: payload under `props`, validated by its schema.
    if (!isBuiltinClipKind(p.kind)) {
      const registration = clipKindRegistration(p.kind);
      if (!registration) {
        reject("clip/add", "unknown-kind", `no registered clip kind "${p.kind}"`);
      }
      if (!registration.trackKinds.includes(track.kind)) {
        reject(
          "clip/add",
          "kind-mismatch",
          `track "${track.id}" (${track.kind}) does not accept ${p.kind} clips`,
        );
      }
      const props = "props" in p ? p.props : {};
      const parsed = registration.propsSchema.safeParse(props);
      if (!parsed.success) {
        reject("clip/add", "invalid-props", `invalid ${p.kind} props: ${parsed.error.message}`);
      }
      doc.clips[p.id] = {
        id: p.id,
        kind: p.kind,
        trackId: p.trackId,
        startUs: p.startUs,
        durationUs: p.durationUs,
        transform,
        props: parsed.data as Record<string, unknown>,
      };
      return;
    }

    assertTrackAccepts("clip/add", track, p.kind as Clip["kind"]);
    if ("assetId" in p) {
      const asset = doc.assets[p.assetId];
      if (!asset) reject("clip/add", "asset-not-found", `no asset "${p.assetId}"`);
      if (asset.kind !== p.kind) {
        reject(
          "clip/add",
          "asset-kind-mismatch",
          `asset "${p.assetId}" is ${asset.kind}, not ${p.kind}`,
        );
      }
    }
    const { transform: _t, ...rest } = p;
    doc.clips[p.id] = { ...rest, transform } as Clip;
  },
  "clip/remove": (doc, p) => {
    getClip(doc, "clip/remove", p.clipId);
    dropTransitionsTouching(doc, p.clipId);
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
    dropTransitionsTouching(doc, p.clipId);
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
    dropTransitionsTouching(doc, p.clipId);
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
    dropTransitionsTouching(doc, p.clipId);
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
    if (p.style !== undefined) {
      if (clip.kind !== "caption" || !("style" in clip)) {
        reject("clip/set-property", "not-caption", `"style" only applies to caption clips`);
      }
      Object.assign(clip.style, p.style);
    }
  },

  // --- Animation (v4) ------------------------------------------------------

  "keyframe/set": (doc, p) => {
    const clip = getClip(doc, "keyframe/set", p.clipId);
    if (p.property === "volume" && !("volume" in clip)) {
      reject("keyframe/set", "no-audio", `${clip.kind} clips have no volume`);
    }
    if (p.property === "opacity" && (p.value < 0 || p.value > 1)) {
      reject("keyframe/set", "out-of-range", "opacity keyframes must be within 0..1");
    }
    if ((p.property === "volume" || p.property === "scale") && p.value < 0) {
      reject("keyframe/set", "out-of-range", `${p.property} keyframes must be >= 0`);
    }
    clip.animations ??= {};
    const keyframes = (clip.animations[p.property] ??= []);
    const keyframe: Keyframe = {
      timeUs: p.timeUs,
      value: p.value,
      easing: resolveEasing(p.easing),
    };
    // Sorted upsert: replace an existing keyframe at the same time.
    const at = keyframes.findIndex((k) => k.timeUs >= p.timeUs);
    if (at < 0) keyframes.push(keyframe);
    else if (keyframes[at]!.timeUs === p.timeUs) keyframes[at] = keyframe;
    else keyframes.splice(at, 0, keyframe);
  },
  "keyframe/remove": (doc, p) => {
    const clip = getClip(doc, "keyframe/remove", p.clipId);
    const keyframes = clip.animations?.[p.property];
    const at = keyframes?.findIndex((k) => k.timeUs === p.timeUs) ?? -1;
    if (!keyframes || at < 0) {
      reject(
        "keyframe/remove",
        "keyframe-not-found",
        `no ${p.property} keyframe at ${p.timeUs} on clip "${p.clipId}"`,
      );
    }
    keyframes.splice(at, 1);
    if (keyframes.length === 0) delete clip.animations![p.property];
  },
  "keyframe/clear": (doc, p) => {
    const clip = getClip(doc, "keyframe/clear", p.clipId);
    if (p.property === undefined) delete clip.animations;
    else if (clip.animations) delete clip.animations[p.property];
  },

  // --- Effects (v4) --------------------------------------------------------

  "effect/add": (doc, p) => {
    const clip = getClip(doc, "effect/add", p.clipId);
    const params = parseParams("effect/add", "effect", p.kind, p.params ?? {});
    const effectId = p.effectId ?? nanoid();
    const effects = (clip.effects ??= []);
    if (effects.some((e) => e.id === effectId)) {
      reject("effect/add", "duplicate-id", `effect "${effectId}" already exists on the clip`);
    }
    const index = Math.min(p.index ?? effects.length, effects.length);
    effects.splice(index, 0, { id: effectId, kind: p.kind, enabled: p.enabled, params });
  },
  "effect/update": (doc, p) => {
    const { effects, index } = findEffect(doc, "effect/update", p.clipId, p.effectId);
    const effect = effects[index]!;
    if (p.params !== undefined) {
      // Merge, then re-validate the WHOLE params object against the kind's schema.
      effect.params = parseParams("effect/update", "effect", effect.kind, {
        ...effect.params,
        ...p.params,
      });
    }
    if (p.enabled !== undefined) effect.enabled = p.enabled;
  },
  "effect/remove": (doc, p) => {
    const { clip, effects, index } = findEffect(doc, "effect/remove", p.clipId, p.effectId);
    effects.splice(index, 1);
    if (effects.length === 0) delete clip.effects;
  },
  "effect/reorder": (doc, p) => {
    const { effects, index } = findEffect(doc, "effect/reorder", p.clipId, p.effectId);
    const [effect] = effects.splice(index, 1);
    effects.splice(Math.min(p.index, effects.length), 0, effect!);
  },

  // --- Transitions (v4) ----------------------------------------------------

  "transition/add": (doc, p) => {
    const from = getClip(doc, "transition/add", p.fromClipId);
    const to = getClip(doc, "transition/add", p.toClipId);
    if (from.trackId !== to.trackId) {
      reject("transition/add", "different-tracks", "transition clips must share a track");
    }
    if (from.startUs + from.durationUs !== to.startUs) {
      reject(
        "transition/add",
        "not-adjacent",
        `"${p.toClipId}" must start exactly where "${p.fromClipId}" ends`,
      );
    }
    for (const existing of Object.values(doc.transitions)) {
      if (existing.fromClipId === p.fromClipId && existing.toClipId === p.toClipId) {
        reject("transition/add", "duplicate-boundary", "this cut already has a transition");
      }
    }
    // Centered on the cut: each side needs half the window of source headroom.
    const half: Us = Math.ceil(p.durationUs / 2);
    if (headroomUs(doc, from, "out") < half) {
      reject(
        "transition/add",
        "insufficient-handles",
        `"${p.fromClipId}" has no source media past its end — trim it shorter or shorten the transition`,
      );
    }
    if (headroomUs(doc, to, "in") < half) {
      reject(
        "transition/add",
        "insufficient-handles",
        `"${p.toClipId}" has no source media before its start — trim it or shorten the transition`,
      );
    }
    const params = parseParams("transition/add", "transition", p.kind, p.params ?? {});
    const transitionId = p.id ?? nanoid();
    assertUniqueId("transition/add", doc.transitions, transitionId, "transition");
    const transition: Transition = {
      id: transitionId,
      trackId: from.trackId,
      fromClipId: p.fromClipId,
      toClipId: p.toClipId,
      kind: p.kind,
      durationUs: p.durationUs,
      alignment: "centered",
      params,
    };
    doc.transitions[transitionId] = transition;
  },
  "transition/update": (doc, p) => {
    const transition = doc.transitions[p.transitionId];
    if (!transition) {
      reject("transition/update", "transition-not-found", `no transition "${p.transitionId}"`);
    }
    if (p.durationUs !== undefined) {
      const from = getClip(doc, "transition/update", transition.fromClipId);
      const to = getClip(doc, "transition/update", transition.toClipId);
      const half: Us = Math.ceil(p.durationUs / 2);
      if (headroomUs(doc, from, "out") < half || headroomUs(doc, to, "in") < half) {
        reject(
          "transition/update",
          "insufficient-handles",
          "not enough source headroom for that duration",
        );
      }
      transition.durationUs = p.durationUs;
    }
    if (p.params !== undefined) {
      transition.params = parseParams("transition/update", "transition", transition.kind, {
        ...transition.params,
        ...p.params,
      });
    }
  },
  "transition/remove": (doc, p) => {
    if (!doc.transitions[p.transitionId]) {
      reject("transition/remove", "transition-not-found", `no transition "${p.transitionId}"`);
    }
    delete doc.transitions[p.transitionId];
  },
};
