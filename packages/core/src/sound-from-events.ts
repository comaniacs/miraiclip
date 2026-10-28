import type { Command } from "./commands/schemas.js";

/** A sound moment a continuous shot declared (`tl.hit`), as the stage root reports it in `data-stage-events`. */
export interface StageEvent {
  name: string;
  /** Seconds into the sequence. */
  t: number;
  /** `impact`, `click`, `whoosh`, `land` or `shake` (others are accepted and matched by name). */
  kind: string;
  /** −1 (left) … 1 (right), where on screen it happened. */
  pan: number;
}

export interface EventSound {
  assetId: string;
  durationUs: number;
}

export interface SoundFromEventsOptions {
  events: readonly StageEvent[];
  /** Where the sequence clip starts on the composition timeline. */
  sequenceStartUs: number;
  /** One sound per event kind, all from one material set. Events of a kind with no sound are skipped. */
  sounds: Readonly<Record<string, EventSound>>;
  /** An existing audio track to put the clips on. */
  trackId: string;
  /** Clip ids to avoid. */
  existingClipIds?: Iterable<string>;
  /** Prefix for new clip ids (default `sfx`). */
  idPrefix?: string;
  /** Level of each sound effect (default 0.8). */
  volume?: number;
  /** Longest a sound plays, in seconds (default 1.5). */
  maxSeconds?: number;
  /** Two events of one kind closer than this many seconds keep only the first (default 0.08). */
  minGapSeconds?: number;
  /** Music to duck under the hits. */
  music?: { clipId: string; startUs: number; durationUs: number; volume: number };
  /** The music's level during a hit, as a fraction of its own level (default 0.35). */
  duckTo?: number;
}

export interface SoundPlacement {
  clipId: string;
  eventName: string;
  kind: string;
  atUs: number;
  durationUs: number;
  assetId: string;
  /** Where on screen it happened. Audio clips have no pan yet, so this is informational. */
  pan: number;
}

export interface SoundFromEventsPlan {
  commands: Command[];
  placements: SoundPlacement[];
  skipped: { eventName: string; t: number; reason: string }[];
  /** The stretches the music is lowered over, on the composition timeline. */
  ducks: { fromUs: number; toUs: number }[];
}

const US = 1_000_000;
const DUCK_LEAD_US = 100_000;
const DUCK_RELEASE_US = 400_000;

/**
 * Plan sound effects for a continuous shot from its declared hits: one audio clip at each hit
 * (the same sound for every hit of a kind, so the film keeps one material set) and, when music is
 * given, volume keyframes that lower it under the hits and release it after. Pure: it returns commands.
 */
export function planSoundFromEvents(options: SoundFromEventsOptions): SoundFromEventsPlan {
  const { events, sounds } = options;
  const used = new Set(options.existingClipIds ?? []);
  const prefix = options.idPrefix ?? "sfx";
  const volume = options.volume ?? 0.8;
  const maxUs = Math.round((options.maxSeconds ?? 1.5) * US);
  const gapUs = Math.round((options.minGapSeconds ?? 0.08) * US);
  const commands: Command[] = [];
  const placements: SoundPlacement[] = [];
  const skipped: SoundFromEventsPlan["skipped"] = [];
  const lastOfKind = new Map<string, number>();
  let n = 0;
  const nextId = (): string => {
    while (used.has(`${prefix}${n + 1}`)) n++;
    n++;
    used.add(`${prefix}${n}`);
    return `${prefix}${n}`;
  };

  for (const e of [...events].sort((a, b) => a.t - b.t)) {
    const sound = sounds[e.kind];
    if (!sound) {
      skipped.push({ eventName: e.name, t: e.t, reason: `no sound given for kind "${e.kind}"` });
      continue;
    }
    const atUs = options.sequenceStartUs + Math.round(e.t * US);
    const last = lastOfKind.get(e.kind);
    if (last !== undefined && atUs - last < gapUs) {
      skipped.push({ eventName: e.name, t: e.t, reason: "too close to the previous hit of its kind" });
      continue;
    }
    lastOfKind.set(e.kind, atUs);
    const durationUs = Math.min(sound.durationUs, maxUs);
    const clipId = nextId();
    commands.push({
      type: "clip/add",
      payload: { id: clipId, kind: "audio", trackId: options.trackId, assetId: sound.assetId, startUs: atUs, durationUs, trimStartUs: 0, volume },
    });
    placements.push({ clipId, eventName: e.name, kind: e.kind, atUs, durationUs, assetId: sound.assetId, pan: e.pan });
  }

  const ducks: SoundFromEventsPlan["ducks"] = [];
  if (options.music && placements.length) {
    const m = options.music;
    const low = m.volume * (options.duckTo ?? 0.35);
    const windows = placements.map((p) => ({ from: p.atUs, to: p.atUs + p.durationUs })).sort((a, b) => a.from - b.from);
    // Windows whose release and next lead would overlap are one duck.
    for (const w of windows) {
      const prev = ducks[ducks.length - 1];
      if (prev && w.from - prev.toUs < DUCK_RELEASE_US + DUCK_LEAD_US) prev.toUs = Math.max(prev.toUs, w.to);
      else ducks.push({ fromUs: w.from, toUs: w.to });
    }
    const musicEnd = m.startUs + m.durationUs;
    for (const d of ducks) {
      if (d.toUs < m.startUs || d.fromUs > musicEnd) continue;
      const rel = (us: number) => Math.min(m.durationUs, Math.max(0, us - m.startUs));
      const key = (us: number, value: number) => commands.push({ type: "keyframe/set", payload: { clipId: m.clipId, property: "volume", timeUs: rel(us), value, easing: "linear" } });
      key(d.fromUs - DUCK_LEAD_US, m.volume);
      key(d.fromUs, low);
      key(d.toUs, low);
      key(d.toUs + DUCK_RELEASE_US, m.volume);
    }
  }
  return { commands, placements, skipped, ducks };
}
