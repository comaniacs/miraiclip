/**
 * alignNarration: fit each voice line to its step, deterministically.
 *
 * Every line has a slot (its step, up to the next line). When the line is
 * longer than the slot, the video makes room: a freeze frame at the end of
 * the step (default) or a slow-down of the step. When the line is much
 * shorter, the step can optionally be sped up. Nothing is hidden: every
 * adjustment is an ordinary clip (a freeze), a speed value or a move on the
 * timeline, listed in `placements`, so people can see and fix the sync.
 */
import { applyCommands, createProject, isAudioClip, isVideoClip, type Clip, type ProjectDocument } from "@miraiclip/core";
import { contentEndUs, segmentSlots, type Command, type Script } from "./script.js";
import type { NarrationTake } from "./voice.js";

export interface AlignOptions {
  /** The clips whose picture the narration describes (the screen recording). */
  clipIds: string[];
  /** Clips that must stay in sync with them (a camera recorded alongside). */
  linkedClipIds?: string[];
  /**
   * How to make room when a line is longer than its step:
   * "freeze" (default) holds the step's last frame; "slow" slows the step
   * down (to `minSpeed`, then freezes the rest); "none" lets the line run
   * into the next step.
   */
  fit?: "freeze" | "slow" | "none";
  /** Slowest speed "slow" may use (default 0.5). */
  minSpeed?: number;
  /** Speed up steps with much less to say (default off). */
  speedUp?: false | { maxSpeed?: number; minSlackUs?: number };
  /** Silence before each line, after its step starts (default 0.25 s). */
  leadUs?: number;
  /** Silence after each line before the next step (default 0.35 s). */
  tailUs?: number;
  /** Track for the voice clips (default "narration"). */
  trackId?: string;
  /** Mute the original recording's sound (default true). */
  muteOriginal?: boolean;
  /** Narration clip volume (default 1). */
  volume?: number;
}

export interface Placement {
  segmentId: string;
  /** Where the line plays on the final timeline. */
  startUs: number;
  durationUs: number;
  /** The step's slot on the final timeline. */
  slot: { startUs: number; endUs: number };
  /** What was done to make it fit, and how much timeline time it added (negative = removed). */
  adjustment: "none" | "freeze" | "slow" | "speed" | "overrun";
  deltaUs: number;
}

export interface AlignPlan {
  commands: Command[];
  placements: Placement[];
  /** The project after the commands (a copy). */
  doc: ProjectDocument;
}

type Project = ReturnType<typeof createProject>;

class Editor {
  readonly commands: Command[] = [];
  private n = 0;
  constructor(
    private readonly project: Project,
    private readonly tracks: Set<string>,
  ) {}

  get doc(): ProjectDocument {
    return this.project.getState().doc;
  }

  run(command: Command) {
    const r = applyCommands(this.project, [command]);
    if (!r.ok) throw new Error(`alignNarration: ${command.type} failed: ${JSON.stringify(r.error)}`);
    this.commands.push(command);
  }

  fresh(base: string) {
    let id: string;
    do id = `${base.split("~")[0]}~n${++this.n}`;
    while (this.doc.clips[id]);
    return id;
  }

  private clipsOn(filter: (c: Clip) => boolean, all = false) {
    return Object.values(this.doc.clips).filter((c) => (all || this.tracks.has(c.trackId)) && filter(c));
  }

  /** Split the aligned tracks' clips at `atUs` (no-op where a clip already starts or ends there). */
  splitAt(atUs: number) {
    for (const c of this.clipsOn((c) => c.startUs < atUs && c.startUs + c.durationUs > atUs)) {
      this.run({ type: "clip/split", payload: { clipId: c.id, atUs, newClipId: this.fresh(c.id) } });
    }
  }

  /** Move every clip (all tracks) starting at or after `fromUs`, and markers, by `deltaUs`. */
  shiftFrom(fromUs: number, deltaUs: number, exclude: Set<string> = new Set()) {
    if (!deltaUs) return;
    const later = this.clipsOn((c) => c.startUs >= fromUs && !exclude.has(c.id), true).sort((a, b) => (deltaUs > 0 ? b.startUs - a.startUs : a.startUs - b.startUs));
    for (const c of later) this.run({ type: "clip/move", payload: { clipId: c.id, startUs: c.startUs + deltaUs } });
    for (const m of Object.values(this.doc.markers ?? {})) {
      if (m.timeUs >= fromUs) this.run({ type: "marker/update", payload: { markerId: m.id, timeUs: m.timeUs + deltaUs } });
    }
  }

  /** Make `durationUs` of room at `atUs`: later content moves right, video holds its frame there. */
  hold(atUs: number, durationUs: number) {
    this.splitAt(atUs);
    this.shiftFrom(atUs, durationUs);
    for (const c of this.clipsOn((c) => c.startUs + c.durationUs === atUs)) {
      if (isVideoClip(c)) this.run({ type: "clip/freeze", payload: { clipId: c.id, atUs, durationUs, freezeClipId: this.fresh(c.id), ripple: false } });
    }
  }

  /** Re-time [a, b) on the aligned tracks to last `newLen`, by changing speed. Returns the change in length. */
  retime(a: number, b: number, newLen: number) {
    const oldLen = b - a;
    const delta = newLen - oldLen;
    if (!delta) return 0;
    this.splitAt(a);
    this.splitAt(b);
    const inside = this.clipsOn((c) => c.startUs >= a && c.startUs + c.durationUs <= b).sort((x, y) => x.startUs - y.startUs);
    const ratio = newLen / oldLen;
    const scale = (c: Clip) => {
      const start = a + Math.round((c.startUs - a) * ratio);
      const speed = "trimStartUs" in c ? ((c as { speed?: number }).speed ?? 1) : undefined;
      if (speed) {
        this.run({ type: "clip/set-speed", payload: { clipId: c.id, speed: Math.max(1 / 16, Math.min(16, speed / ratio)), ripple: false } });
      } else {
        this.run({ type: "clip/trim", payload: { clipId: c.id, durationUs: Math.max(1, Math.round(c.durationUs * ratio)) } });
      }
      if (start !== c.startUs) this.run({ type: "clip/move", payload: { clipId: c.id, startUs: start } });
    };
    const ids = new Set(inside.map((c) => c.id));
    if (delta > 0) {
      this.shiftFrom(b, delta, ids);
      for (const c of [...inside].reverse()) scale(this.doc.clips[c.id]!);
    } else {
      for (const c of inside) scale(this.doc.clips[c.id]!);
      this.shiftFrom(b, delta, ids);
    }
    return delta;
  }
}

export function alignNarration(doc: ProjectDocument, script: Script, takes: readonly NarrationTake[], options: AlignOptions): AlignPlan {
  const lead = options.leadUs ?? 250_000;
  const tail = options.tailUs ?? 350_000;
  const fit = options.fit ?? "freeze";
  const minSpeed = options.minSpeed ?? 0.5;
  const trackId = options.trackId ?? "narration";
  const media = [...options.clipIds, ...(options.linkedClipIds ?? [])];
  for (const id of media) if (!doc.clips[id]) throw new Error(`no clip "${id}" in the project`);
  const tracks = new Set(media.map((id) => doc.clips[id]!.trackId));
  if (tracks.has(trackId)) throw new Error(`the narration track "${trackId}" is one of the aligned tracks`);
  const project = createProject(structuredClone(doc), { historyLimit: 1 });
  const ed = new Editor(project, tracks);
  const byId = new Map(takes.map((t) => [t.segmentId, t]));
  const slots = segmentSlots(script, contentEndUs(doc));

  let offset = 0;
  const placed: Omit<Placement, "slot">[] = [];
  const slotOf: { id: string; a: number; len: number }[] = [];
  for (const slot of slots) {
    const take = byId.get(slot.id);
    const a = slot.startUs + offset;
    const b = slot.endUs + offset;
    const len = b - a;
    if (!take) {
      slotOf.push({ id: slot.id, a, len });
      continue;
    }
    const need = lead + take.durationUs + tail;
    let adjustment: Placement["adjustment"] = "none";
    let delta = 0;
    if (need > len) {
      if (fit === "freeze") {
        ed.hold(b, need - len);
        delta = need - len;
        adjustment = "freeze";
      } else if (fit === "slow" && len > 0) {
        const stretched = Math.min(need, Math.round(len / minSpeed));
        delta = ed.retime(a, b, stretched);
        if (stretched < need) {
          ed.hold(a + stretched, need - stretched);
          delta += need - stretched;
        }
        adjustment = "slow";
      } else {
        adjustment = "overrun";
      }
    } else if (options.speedUp) {
      const maxSpeed = options.speedUp.maxSpeed ?? 2;
      const minSlack = options.speedUp.minSlackUs ?? 1_500_000;
      if (len - need > minSlack) {
        const target = Math.max(need, Math.round(len / maxSpeed));
        delta = ed.retime(a, b, target);
        adjustment = "speed";
      }
    }
    offset += delta;
    placed.push({ segmentId: slot.id, startUs: a + lead, durationUs: take.durationUs, adjustment, deltaUs: delta });
    slotOf.push({ id: slot.id, a, len: len + delta });
  }

  // The voice: one audio clip per line on its own track.
  if (!ed.doc.tracks[trackId]) ed.run({ type: "track/add", payload: { id: trackId, kind: "audio", name: "Narration" } });
  for (const p of placed) {
    const take = byId.get(p.segmentId)!;
    const assetId = `voice-${p.segmentId}`;
    if (ed.doc.assets[assetId]) ed.run({ type: "asset/remove", payload: { id: assetId } });
    ed.run({ type: "asset/add", payload: { id: assetId, kind: "audio", src: take.src, durationUs: take.durationUs, name: take.text.slice(0, 60), source: { provider: take.generator ?? "voice", id: p.segmentId } } });
    // Overrunning lines may overlap the next one on the track: shorten to fit, never overlap.
    const nextStart = placed.find((q) => q.startUs > p.startUs)?.startUs ?? Infinity;
    const durationUs = Math.max(1, Math.min(take.durationUs, nextStart - p.startUs));
    ed.run({ type: "clip/add", payload: { kind: "audio", id: assetId, trackId, assetId, startUs: p.startUs, durationUs, volume: options.volume ?? 1 } });
  }
  if (options.muteOriginal !== false) {
    for (const c of Object.values(ed.doc.clips)) {
      if (tracks.has(c.trackId) && (isVideoClip(c) || isAudioClip(c)) && c.volume > 0) ed.run({ type: "clip/set-property", payload: { clipId: c.id, volume: 0 } });
    }
  }
  const slotIndex = new Map(slotOf.map((s) => [s.id, s]));
  return {
    commands: ed.commands,
    placements: placed.map((p) => {
      const s = slotIndex.get(p.segmentId)!;
      return { ...p, slot: { startUs: s.a, endUs: s.a + s.len } };
    }),
    doc: ed.doc,
  };
}
