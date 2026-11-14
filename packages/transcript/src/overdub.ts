/**
 * Overdubbing: replacing some spoken words with new speech, in place. `overdubSlot`
 * finds the words on the timeline (no audio needed, so a caller can look before it
 * pays for a take) and `planOverdub` fits a take into their room as plain commands: the
 * old words are muted (their clip is split around them and the middle piece goes
 * silent, so the picture and everything else stays put) and the new speech is a clip on
 * its own audio track where the old words were. Nothing moves, so lip-sync and
 * captions stay where they were. The old room is the words themselves plus the pause up
 * to the next word. New speech shorter than that leaves a little more silence; slightly
 * longer is sped up by at most `maxSpeedup`; longer than that is refused (`too_long`),
 * because the only way to fit it is to move things. Computed on a scratch copy, so the
 * commands replay as one undo step.
 */
import {
  applyCommands,
  createProject,
  isAudioClip,
  isVideoClip,
  type ProjectDocument,
} from "@miraiclip/core";
import { sourceRangesOnTimeline } from "./cuts.js";
import type { Command, Transcript } from "./types.js";

export const OVERDUB_DEFAULTS = {
  /** Most words replaced at once. */
  maxWords: 40,
  /** How much a take may be sped up to fit before it is refused. */
  maxSpeedup: 1.15,
  /** How much of the pause before the next word is left alone. */
  tailUs: 40_000,
  /** Fade at the seams, so the cuts don't click. */
  fadeUs: 15_000,
  trackId: "overdub",
  trackName: "Overdub",
} as const;

export interface OverdubOptions {
  maxWords?: number;
  maxSpeedup?: number;
  tailUs?: number;
  fadeUs?: number;
  /** The audio track the new speech goes on (created when missing). */
  trackId?: string;
  trackName?: string;
}

export class OverdubPlanError extends Error {
  constructor(
    readonly code: "bad_words" | "clip_missing" | "too_long" | "transcript_changed",
    message: string,
  ) {
    super(message);
    this.name = "OverdubPlanError";
  }
}

export interface OverdubWords {
  /** The media the transcript belongs to. */
  assetId: string;
  /** First and last word replaced (indexes into the transcript, inclusive). */
  from: number;
  to: number;
  /** What those words say now, to be sure the transcript is still the one that was looked at. */
  replaces?: string | undefined;
}

export interface OverdubSlot {
  /** Where the new speech goes on the timeline: the first clip's span. */
  startUs: number;
  endUs: number;
  /** Each clip's span to mute (the same words can play in several clips). */
  spans: { clipId: string; startUs: number; endUs: number }[];
  /** The words being replaced, as spoken. */
  said: string;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Find the words on the timeline. Throws `OverdubPlanError` when they can't be replaced. */
export function overdubSlot(
  doc: ProjectDocument,
  transcript: Transcript,
  w: OverdubWords,
  options: OverdubOptions = {},
): OverdubSlot {
  const { maxWords, tailUs } = { ...OVERDUB_DEFAULTS, ...options };
  const { words } = transcript;
  if (
    !Number.isInteger(w.from) ||
    !Number.isInteger(w.to) ||
    w.from < 0 ||
    w.to < w.from ||
    w.to >= words.length ||
    w.to - w.from + 1 > maxWords
  ) {
    throw new OverdubPlanError(
      "bad_words",
      `Pick up to ${maxWords} words that are next to each other.`,
    );
  }
  const first = words[w.from];
  const last = words[w.to];
  if (!first || !last)
    throw new OverdubPlanError("bad_words", "Those words aren't in the transcript.");
  const said = clean(
    words
      .slice(w.from, w.to + 1)
      .map((x) => x.text)
      .join(" "),
  );
  if (w.replaces !== undefined && clean(w.replaces) !== said) {
    throw new OverdubPlanError(
      "transcript_changed",
      "The transcript changed since you picked those words. Pick them again.",
    );
  }
  // Old room: the words and the pause after them, up to just before the next word.
  const next = words[w.to + 1];
  const endSource = next ? Math.max(last.endUs, next.startUs - tailUs) : last.endUs;
  const clips = Object.values(doc.clips)
    .filter((c) => (isVideoClip(c) || isAudioClip(c)) && c.assetId === w.assetId)
    .sort((a, b) => a.startUs - b.startUs);
  const spans: OverdubSlot["spans"] = [];
  for (const clip of clips) {
    // The words themselves must be on the timeline whole: a clip that starts or ends in the
    // middle of one has cut it, and there's nothing sensible to replace.
    const [said] = sourceRangesOnTimeline(doc, [{ startUs: first.startUs, endUs: last.endUs }], {
      clipIds: [clip.id],
    });
    const rate = (clip as { speed?: number }).speed ?? 1;
    const whole = (last.endUs - first.startUs) / rate;
    if (!said || said.endUs - said.startUs < whole - 2_000) continue;
    const [span] = sourceRangesOnTimeline(doc, [{ startUs: first.startUs, endUs: endSource }], {
      clipIds: [clip.id],
    });
    if (span) spans.push({ clipId: clip.id, ...span });
  }
  const primary = spans[0];
  if (!primary) {
    throw new OverdubPlanError(
      "clip_missing",
      "Those words aren't on the timeline any more (they were cut or trimmed).",
    );
  }
  return { startUs: primary.startUs, endUs: primary.endUs, spans, said };
}

export interface OverdubTake {
  assetId: string;
  durationUs: number;
  name: string;
  /** How the audio is named in the project (`asset://…`). */
  src: string;
}

export interface OverdubPlan {
  commands: Command[];
  startUs: number;
  /** How long the new speech plays on the timeline (after any speed-up). */
  durationUs: number;
  speed: number;
  roomUs: number;
}

/** Commands that mute the old words and put `take` in their place. */
export function planOverdub(
  doc: ProjectDocument,
  slot: OverdubSlot,
  take: OverdubTake,
  options: OverdubOptions = {},
): OverdubPlan {
  const { maxSpeedup, fadeUs, trackId, trackName } = { ...OVERDUB_DEFAULTS, ...options };
  const room = slot.endUs - slot.startUs;
  const speed = take.durationUs > room ? take.durationUs / room : 1;
  if (speed > maxSpeedup) {
    throw new OverdubPlanError(
      "too_long",
      `The new words take ${(take.durationUs / 1e6).toFixed(1)} s and there's room for ${(room / 1e6).toFixed(1)} s. Use fewer words, or pick more of the sentence to replace.`,
    );
  }
  const scratch = createProject(structuredClone(doc), { historyLimit: 1 });
  const commands: Command[] = [];
  const run = (command: Command) => {
    const r = applyCommands(scratch, [command]);
    if (!r.ok) throw new Error(`overdub: ${command.type} failed: ${JSON.stringify(r.error)}`);
    commands.push(command);
  };
  const state = () => scratch.getState().doc;
  let n = 0;
  const fresh = (base: string) => {
    let id: string;
    do id = `${base.split("~")[0]}~od${++n}`;
    while (state().clips[id]);
    return id;
  };

  // Mute the old words: split each clip around them, the middle piece goes silent.
  for (const span of slot.spans) {
    const clip = state().clips[span.clipId];
    if (!clip) continue;
    let middle = clip.id;
    if (span.endUs < clip.startUs + clip.durationUs) {
      run({
        type: "clip/split",
        payload: { clipId: clip.id, atUs: span.endUs, newClipId: fresh(clip.id) },
      });
    }
    if (span.startUs > clip.startUs) {
      middle = fresh(clip.id);
      run({
        type: "clip/split",
        payload: { clipId: clip.id, atUs: span.startUs, newClipId: middle },
      });
      run({ type: "clip/set-property", payload: { clipId: clip.id, fadeOutUs: fadeUs } });
    }
    run({ type: "clip/set-property", payload: { clipId: middle, volume: 0 } });
  }

  // The new speech, in the old words' place.
  if (!state().tracks[trackId]) {
    run({
      type: "track/add",
      payload: { id: trackId, kind: "audio", name: trackName },
    });
  }
  if (!state().assets[take.assetId]) {
    run({
      type: "asset/add",
      payload: {
        id: take.assetId,
        kind: "audio",
        src: take.src,
        durationUs: take.durationUs,
        name: take.name.slice(0, 60),
      },
    });
  }
  const clipId = `overdub-${take.assetId}`;
  const playsFor = Math.round(take.durationUs / speed);
  run({
    type: "clip/add",
    payload: {
      kind: "audio",
      id: clipId,
      trackId,
      assetId: take.assetId,
      startUs: slot.startUs,
      durationUs: take.durationUs,
      volume: 1,
    },
  });
  if (speed > 1) run({ type: "clip/set-speed", payload: { clipId, speed, ripple: false } });
  run({
    type: "clip/set-property",
    payload: { clipId, fadeInUs: fadeUs, fadeOutUs: fadeUs },
  });
  return { commands, startUs: slot.startUs, durationUs: playsFor, speed, roomUs: room };
}
