/**
 * Putting a (hydrated) template into a project that already has content:
 * the document becomes a batch of ordinary commands — assets, tracks on top
 * of the existing ones, clips shifted to the insert time, their keyframes,
 * effects and transitions — with every id remapped so nothing collides.
 * `insertDocument` dispatches the batch as one transaction (one undo step).
 */
import {
  findCuts,
  isAudioClip,
  isVideoClip,
  type Clip,
  type Command,
  type Easing,
  type Project,
  type ProjectDocument,
} from "@miraiclip/core";

const MIN_TRANSITION_US = 100_000;

export interface InsertOptions {
  /** Timeline position of the inserted document's 0 (default 0). */
  atUs?: number;
  /** Prefix for the new ids (default: derived to avoid every id in the target). */
  idPrefix?: string;
}

export interface InsertPlan {
  commands: Command[];
  /** Source id → id in the target, for clips, tracks and assets. */
  ids: { clips: Record<string, string>; tracks: Record<string, string>; assets: Record<string, string> };
  /** Where the inserted content starts and ends on the target timeline. */
  startUs: number;
  endUs: number;
}

const easingInput = (e: Easing | undefined): unknown => (!e ? "linear" : e.kind === "hold" ? "hold" : e);

/** `asset:<id>` references in html markup, renamed per `map` (unmapped ids stay). */
export function remapAssetRefs(template: string, map: Record<string, string>): string {
  return template.replace(/asset:([\w-]+)/g, (whole, id: string) => (map[id] && map[id] !== id ? `asset:${map[id]}` : whole));
}

/** Same media, same face: reuse the target's asset instead of adding a copy. */
function sameAsset(a: ProjectDocument["assets"][string], b: ProjectDocument["assets"][string]): boolean {
  if (a.kind !== b.kind || a.src !== b.src) return false;
  if (a.kind === "font") {
    const fa = a as { family?: string; weight?: unknown; style?: unknown };
    const fb = b as { family?: string; weight?: unknown; style?: unknown };
    return fa.family === fb.family && fa.weight === fb.weight && fa.style === fb.style;
  }
  return true;
}

/**
 * The commands that add `source` (e.g. `hydrate(template, data)`) to
 * `target`. Pure: nothing is dispatched. Tracks without clips aren't added. The target's settings are left
 * alone; compare `source.settings` yourself if the frame size matters.
 */
export function insertCommands(target: ProjectDocument, source: ProjectDocument, options: InsertOptions = {}): InsertPlan {
  const atUs = Math.max(0, Math.round(options.atUs ?? 0));
  const taken = new Set([...Object.keys(target.clips), ...Object.keys(target.tracks), ...Object.keys(target.assets), ...Object.keys(target.transitions ?? {})]);
  let prefix = options.idPrefix ?? "tpl";
  if (options.idPrefix === undefined) {
    for (let n = 1; [...taken].some((id) => id.startsWith(`${prefix}-`)); n++) prefix = `tpl${n}`;
  }
  const fresh = (id: string) => {
    let next = `${prefix}-${id}`;
    for (let i = 2; taken.has(next); i++) next = `${prefix}-${id}-${i}`;
    taken.add(next);
    return next;
  };

  const commands: Command[] = [];
  const ids: InsertPlan["ids"] = { clips: {}, tracks: {}, assets: {} };

  for (const asset of Object.values(source.assets)) {
    const existing = Object.values(target.assets).find((a) => sameAsset(a, asset));
    if (existing) {
      ids.assets[asset.id] = existing.id;
      continue;
    }
    const id = taken.has(asset.id) ? fresh(asset.id) : (taken.add(asset.id), asset.id);
    ids.assets[asset.id] = id;
    commands.push({ type: "asset/add", payload: { ...asset, id } });
  }

  // New tracks go on top of the existing ones, in the source's order (empty ones are skipped).
  const used = new Set(Object.values(source.clips).map((c) => c.trackId));
  source.trackOrder.filter((trackId) => used.has(trackId)).forEach((trackId, i) => {
    const track = source.tracks[trackId];
    if (!track) return;
    const id = fresh(trackId);
    ids.tracks[trackId] = id;
    commands.push({ type: "track/add", payload: { id, kind: track.kind, name: track.name, index: target.trackOrder.length + i } });
    const flags = { ...(track.muted ? { muted: true } : {}), ...(track.solo ? { solo: true } : {}), ...(track.locked ? { locked: true } : {}), ...(track.hidden ? { hidden: true } : {}) };
    if (Object.keys(flags).length) commands.push({ type: "track/set-property", payload: { trackId: id, ...flags } });
  });

  let startUs = Number.POSITIVE_INFINITY;
  let endUs = atUs;
  const clips = Object.values(source.clips).sort((a, b) => a.startUs - b.startUs);
  for (const clip of clips) ids.clips[clip.id] = fresh(clip.id);
  for (const clip of clips) {
    const trackId = ids.tracks[clip.trackId];
    if (!trackId) continue;
    const { animations, effects, ...rest } = clip as Clip & Record<string, unknown>;
    const payload: Record<string, unknown> = { ...rest, id: ids.clips[clip.id], trackId, startUs: clip.startUs + atUs };
    if ("assetId" in clip && typeof clip.assetId === "string") payload.assetId = ids.assets[clip.assetId] ?? clip.assetId;
    // Html templates reference media as `asset:<id>` (inlined at raster time): follow renamed assets.
    if (clip.kind === "html" && typeof payload.template === "string") payload.template = remapAssetRefs(payload.template, ids.assets);
    // Custom clip kinds keep their own fields under `props` in clip/add.
    const builtin = ["video", "audio", "image", "text", "caption", "html"].includes(clip.kind);
    commands.push({ type: "clip/add", payload: builtin ? payload : { kind: clip.kind, id: payload.id, trackId, startUs: payload.startUs, durationUs: clip.durationUs, ...(rest.transform ? { transform: rest.transform } : {}), props: (clip as { props?: unknown }).props ?? {} } });
    startUs = Math.min(startUs, clip.startUs + atUs);
    endUs = Math.max(endUs, clip.startUs + atUs + clip.durationUs);
    for (const [property, keyframes] of Object.entries(animations ?? {})) {
      for (const k of keyframes ?? []) {
        commands.push({ type: "keyframe/set", payload: { clipId: ids.clips[clip.id], property, timeUs: k.timeUs, ...(k.anchor ? { anchor: k.anchor } : {}), value: k.value, easing: easingInput(k.easing) } });
      }
    }
    for (const e of effects ?? []) {
      commands.push({ type: "effect/add", payload: { clipId: ids.clips[clip.id], kind: e.kind, params: e.params, enabled: e.enabled, effectId: fresh(e.id) } });
    }
  }

  for (const t of Object.values(source.transitions ?? {})) {
    const from = ids.clips[t.fromClipId];
    const to = ids.clips[t.toClipId];
    if (!from || !to) continue;
    commands.push({ type: "transition/add", payload: { id: fresh(t.id), kind: t.kind, fromClipId: from, toClipId: to, durationUs: t.durationUs, ...(t.params ? { params: t.params } : {}) } });
  }

  return { commands, ids, startUs: Number.isFinite(startUs) ? startUs : atUs, endUs };
}

/** Insert `source` into `project` as one undo step; returns the plan (ids, time range). */
export function insertDocument(project: Project, source: ProjectDocument, options: InsertOptions = {}): InsertPlan {
  const plan = insertCommands(project.getState().doc, source, options);
  project.transaction(() => {
    for (const command of plan.commands) project.dispatch(command);
  }, "Insert template");
  return plan;
}

/**
 * Shorten video / audio clips that would play past the end of their media —
 * e.g. after a media slot was filled with a clip shorter than the
 * placeholder — and fit transitions to the footage their clips now have
 * around each cut (shortened, or dropped when there's none). Later clips on
 * the track don't move; returns a new document.
 */
export function fitClipsToMedia(doc: ProjectDocument): ProjectDocument {
  const out = structuredClone(doc);
  for (const clip of Object.values(out.clips)) {
    if (!isVideoClip(clip) && !isAudioClip(clip)) continue;
    const media = out.assets[clip.assetId]?.durationUs;
    if (!media) continue;
    const available = media - clip.trimStartUs;
    if (available <= 0) {
      clip.trimStartUs = 0;
      clip.durationUs = Math.min(clip.durationUs, media);
    } else if (clip.durationUs > available) {
      clip.durationUs = available;
    }
  }
  // Transitions need their clips to still meet, with spare footage on both
  // sides of the cut: shorten the ones the new media can't cover, drop the rest.
  const cuts = findCuts(out);
  for (const [id, t] of Object.entries(out.transitions ?? {})) {
    const cut = cuts.find((c) => c.fromClipId === t.fromClipId && c.toClipId === t.toClipId);
    if (!cut || cut.maxTransitionUs < MIN_TRANSITION_US) delete out.transitions[id];
    else if (t.durationUs > cut.maxTransitionUs) t.durationUs = cut.maxTransitionUs;
  }
  return out;
}
