/**
 * Assistant cases: a plain-language request, the project it starts from, a
 * reference solution (the tool calls a good model would make) and a check on
 * the resulting project.
 *
 * - test/cases.test.ts runs every case with its solution through a scripted
 *   model: it proves the tools do what the check expects (and that each check
 *   accepts a correct edit). No key, runs in CI.
 * - evals/live.eval.ts sends the same prompts to a real model and runs the
 *   same checks: how well the model understands editing requests.
 *
 * Checks judge the outcome, not the route: any sequence of tools that leaves
 * the project in the right state passes. Times allow a little slack where a
 * person would ("at about 5 seconds").
 */
import { expect } from "vitest";
import {
  animationCommands,
  evaluateKeyframes,
  findCuts,
  readAnimation,
  type AudioClip,
  type CaptionClip,
  type Clip,
  type Project,
  type ProjectDocument,
  type TextClip,
  type VideoClip,
} from "@miraiclip/core";
import type { AssistantTurn, ScriptStep, ToolCall } from "../src/index.js";
import { S } from "./fixture.js";

export interface CaseContext {
  doc: ProjectDocument;
  before: ProjectDocument;
  turn: AssistantTurn;
}

export interface EvalCase {
  id: string;
  category: string;
  prompt: string;
  /** Changes to the base fixture before the request. */
  setup?: (project: Project) => void;
  /** What the user is looking at (selection, playhead), as the app would pass it. */
  context?: string;
  /** Selection / playhead to set on the project. */
  select?: string[];
  playheadS?: number;
  /** The right outcome is no edit (a question, or a request the editor can't do). */
  noEdit?: true;
  /** The reference solution: tool calls per model step, then the reply. */
  solution: ScriptStep[];
  check: (c: CaseContext) => void;
}

/* ---------- helpers ---------- */

const call = (name: string, args: Record<string, unknown> = {}): Omit<ToolCall, "id"> => ({ name, arguments: args });
const cmd = (type: string, payload: Record<string, unknown>) => ({ type, payload });
/** One step of tool calls, then a short reply. */
const plan = (...calls: Omit<ToolCall, "id">[]): ScriptStep[] => [{ toolCalls: calls }, "Done."];
const apply = (...commands: { type: string; payload: Record<string, unknown> }[]) => call("apply_commands", { commands });
const answer = (text: string): ScriptStep[] => [text];

const clip = <T extends Clip = Clip>(doc: ProjectDocument, id: string) => doc.clips[id] as T | undefined;
const clipsOn = (doc: ProjectDocument, trackId: string) =>
  Object.values(doc.clips)
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.startUs - b.startUs);
const textClips = (doc: ProjectDocument) => Object.values(doc.clips).filter((c): c is TextClip => c.kind === "text");
const captions = (doc: ProjectDocument) => Object.values(doc.clips).filter((c): c is CaptionClip => c.kind === "caption");
const audioClips = (doc: ProjectDocument) => Object.values(doc.clips).filter((c): c is AudioClip => c.kind === "audio");
const videoClips = (doc: ProjectDocument) => Object.values(doc.clips).filter((c): c is VideoClip => c.kind === "video");
const transitions = (doc: ProjectDocument) => Object.values(doc.transitions);
const recipe = (doc: ProjectDocument, id: string) => readAnimation(clip(doc, id)!);
const near = (actualUs: number, expectedS: number, tolS = 0.15) => expect(Math.abs(actualUs - expectedS * S)).toBeLessThanOrEqual(tolS * S);
const unchanged = ({ doc, before }: CaseContext) => expect(doc).toEqual(before);
const hasEffect = (doc: ProjectDocument, id: string, kind: string) => expect((clip(doc, id)?.effects ?? []).map((e) => e.kind)).toContain(kind);
const textWith = (doc: ProjectDocument, re: RegExp) => textClips(doc).find((c) => re.test(c.text));
/** On-screen text size: font size × clip scale (either is a fair way to resize). */
const shownSize = (t: TextClip) => t.fontSizePx * t.transform.scale;
const overlap = (a: Clip, startS: number, endS: number) => a.startUs < endS * S && a.startUs + a.durationUs > startS * S;

const BUNNY = "Big Buck Bunny";

/* ======================================================================
 * Transitions
 * ==================================================================== */

const transitionCases: EvalCase[] = [
  {
    id: "tr-dissolve-all",
    category: "transitions",
    prompt: "Add a dissolve between every clip.",
    solution: plan(call("add_transition", { kind: "crossDissolve", allCuts: true })),
    check: ({ doc }) => {
      expect(transitions(doc)).toHaveLength(3);
      expect(transitions(doc).every((t) => t.kind === "crossDissolve")).toBe(true);
    },
  },
  {
    id: "tr-dip-black-15",
    category: "transitions",
    prompt: "Dip to black at the cut around 15 seconds.",
    solution: plan(call("add_transition", { kind: "dipToBlack", nearSeconds: 15 })),
    check: ({ doc }) => {
      expect(transitions(doc)).toMatchObject([{ kind: "dipToBlack", fromClipId: "v2", toClipId: "v3" }]);
    },
  },
  {
    id: "tr-wipe-up-v2-v3",
    category: "transitions",
    prompt: "Put an upward wipe between the second and third clips.",
    solution: plan(call("add_transition", { kind: "wipe", fromClipId: "v2", toClipId: "v3", direction: "up" })),
    check: ({ doc }) => {
      expect(transitions(doc)).toMatchObject([{ kind: "wipe", fromClipId: "v2", toClipId: "v3", params: { direction: "up" } }]);
    },
  },
  {
    id: "tr-slide-left-all",
    category: "transitions",
    prompt: "Use slide transitions going left on all cuts.",
    solution: plan(call("add_transition", { kind: "slide", allCuts: true, direction: "left" })),
    check: ({ doc }) => {
      expect(transitions(doc)).toHaveLength(3);
      for (const t of transitions(doc)) expect(t).toMatchObject({ kind: "slide", params: { direction: "left" } });
    },
  },
  {
    id: "tr-dip-white-first",
    category: "transitions",
    prompt: "Make the first cut a dip to white.",
    solution: plan(call("add_transition", { kind: "dipToWhite", fromClipId: "v1", toClipId: "v2" })),
    check: ({ doc }) => {
      expect(transitions(doc)).toMatchObject([{ kind: "dipToWhite", fromClipId: "v1", toClipId: "v2" }]);
    },
  },
  {
    id: "tr-last-cut-dissolve",
    category: "transitions",
    prompt: "Crossfade into the last clip.",
    solution: plan(call("add_transition", { kind: "crossDissolve", fromClipId: "v3", toClipId: "v4" })),
    check: ({ doc }) => {
      expect(transitions(doc)).toMatchObject([{ kind: "crossDissolve", toClipId: "v4" }]);
    },
  },
  {
    id: "tr-one-second",
    category: "transitions",
    prompt: "Add 1 second dissolves on every cut.",
    solution: plan(call("add_transition", { kind: "crossDissolve", allCuts: true, durationSeconds: 1 })),
    check: ({ doc }) => {
      expect(transitions(doc)).toHaveLength(3);
      for (const t of transitions(doc)) near(t.durationUs, 1, 0.05);
    },
  },
  {
    id: "tr-short",
    category: "transitions",
    prompt: "Add very quick dissolves on all cuts, a quarter of a second.",
    solution: plan(call("add_transition", { kind: "crossDissolve", allCuts: true, durationSeconds: 0.25 })),
    check: ({ doc }) => {
      expect(transitions(doc)).toHaveLength(3);
      for (const t of transitions(doc)) near(t.durationUs, 0.25, 0.05);
    },
  },
  {
    id: "tr-remove-all",
    category: "transitions",
    prompt: "Remove all the transitions.",
    setup: (p) => {
      for (const c of findCuts(p.getState().doc)) p.dispatch({ type: "transition/add", payload: { id: `t-${c.fromClipId}`, kind: "crossDissolve", fromClipId: c.fromClipId, toClipId: c.toClipId, durationUs: 500_000 } });
    },
    solution: plan(call("add_transition", { kind: "none", allCuts: true })),
    check: ({ doc }) => expect(transitions(doc)).toHaveLength(0),
  },
  {
    id: "tr-replace-kind",
    category: "transitions",
    prompt: "Change the dissolves to dip to black.",
    setup: (p) => {
      for (const c of findCuts(p.getState().doc)) p.dispatch({ type: "transition/add", payload: { id: `t-${c.fromClipId}`, kind: "crossDissolve", fromClipId: c.fromClipId, toClipId: c.toClipId, durationUs: 500_000 } });
    },
    solution: plan(call("add_transition", { kind: "dipToBlack", allCuts: true })),
    check: ({ doc }) => {
      expect(transitions(doc)).toHaveLength(3);
      expect(transitions(doc).every((t) => t.kind === "dipToBlack")).toBe(true);
    },
  },
  {
    id: "tr-remove-one",
    category: "transitions",
    prompt: "Take the transition off the cut at 20 seconds, keep the others.",
    setup: (p) => {
      for (const c of findCuts(p.getState().doc)) p.dispatch({ type: "transition/add", payload: { id: `t-${c.fromClipId}`, kind: "crossDissolve", fromClipId: c.fromClipId, toClipId: c.toClipId, durationUs: 500_000 } });
    },
    solution: plan(call("add_transition", { kind: "none", nearSeconds: 20 })),
    check: ({ doc }) => {
      expect(transitions(doc).map((t) => t.toClipId).sort()).toEqual(["v2", "v3"]);
    },
  },
  {
    id: "tr-at-playhead",
    category: "transitions",
    prompt: "Add a dissolve at this cut.",
    playheadS: 10.2,
    context: "Playhead: 10.2s.",
    solution: plan(call("add_transition", { kind: "crossDissolve", nearSeconds: 10.2 })),
    check: ({ doc }) => expect(transitions(doc)).toMatchObject([{ fromClipId: "v1", toClipId: "v2" }]),
  },
  {
    id: "tr-selected-clip",
    category: "transitions",
    prompt: "Fade into the selected clip.",
    select: ["v3"],
    context: "Selected: v3 (video, 15.0–20.0s).",
    solution: plan(call("add_transition", { kind: "crossDissolve", toClipId: "v3" })),
    check: ({ doc }) => expect(transitions(doc)).toMatchObject([{ toClipId: "v3" }]),
  },
  {
    id: "tr-slide-right-second",
    category: "transitions",
    prompt: "Slide the third clip in from the left side (moving right).",
    solution: plan(call("add_transition", { kind: "slide", toClipId: "v3", direction: "right" })),
    // A slide transition from v2, or v3 sliding in on its own: both move the clip in from the left.
    check: ({ doc }) => {
      const slid = transitions(doc).some((t) => t.kind === "slide" && t.toClipId === "v3" && t.params?.direction === "right");
      expect(slid || recipe(doc, "v3").recipe.in?.preset === "in:right").toBe(true);
    },
  },
  {
    id: "tr-mixed",
    category: "transitions",
    prompt: "Dissolve at 10 seconds and dip to black at 20 seconds.",
    solution: plan(call("add_transition", { kind: "crossDissolve", nearSeconds: 10 }), call("add_transition", { kind: "dipToBlack", nearSeconds: 20 })),
    check: ({ doc }) => {
      const byTo = Object.fromEntries(transitions(doc).map((t) => [t.toClipId, t.kind]));
      expect(byTo).toEqual({ v2: "crossDissolve", v4: "dipToBlack" });
    },
  },
  {
    id: "tr-no-handles-skipped",
    category: "transitions",
    prompt: "Dissolve every cut.",
    setup: (p) => p.dispatch({ type: "clip/trim", payload: { clipId: "v3", trimStartUs: 0 } }),
    solution: plan(call("add_transition", { kind: "crossDissolve", allCuts: true })),
    check: ({ doc }) => {
      // v2 → v3 has no spare footage before v3: it can't take one; the other two can.
      expect(transitions(doc).map((t) => t.toClipId).sort()).toEqual(["v2", "v4"]);
    },
  },
  {
    id: "tr-longer-existing",
    category: "transitions",
    prompt: "Make the transitions longer, about 1.5 seconds.",
    setup: (p) => {
      for (const c of findCuts(p.getState().doc)) p.dispatch({ type: "transition/add", payload: { id: `t-${c.fromClipId}`, kind: "wipe", fromClipId: c.fromClipId, toClipId: c.toClipId, durationUs: 400_000 } });
    },
    solution: plan(call("add_transition", { kind: "wipe", allCuts: true, durationSeconds: 1.5 })),
    check: ({ doc }) => {
      expect(transitions(doc)).toHaveLength(3);
      for (const t of transitions(doc)) {
        expect(t.kind).toBe("wipe");
        near(t.durationUs, 1.5, 0.1);
      }
    },
  },
  {
    id: "tr-not-on-titles",
    noEdit: true,
    category: "transitions",
    prompt: "Add a dissolve between the title and the first clip.",
    solution: answer("Transitions go between two clips that touch on the same track; the title sits on its own track over the video, so there's no cut between them. I can fade the title in instead."),
    check: (c) => {
      expect(transitions(c.doc)).toHaveLength(0);
      expect(c.turn.reply.length).toBeGreaterThan(0);
    },
  },
];

/* ======================================================================
 * Animation
 * ==================================================================== */

const animationCases: EvalCase[] = [
  {
    id: "an-title-pop",
    category: "animation",
    prompt: "Make the title pop in.",
    solution: plan(call("animate_clip", { clipId: "title", in: "pop" })),
    check: ({ doc }) => expect(recipe(doc, "title").recipe.in?.preset).toBe("in:pop"),
  },
  {
    id: "an-title-pop-fade",
    category: "animation",
    prompt: "Pop the title in and fade it out.",
    solution: plan(call("animate_clip", { clipId: "title", in: "pop", out: "fade" })),
    check: ({ doc }) => expect(recipe(doc, "title").recipe).toMatchObject({ in: { preset: "in:pop" }, out: { preset: "out:fade" } }),
  },
  {
    id: "an-credits-fade-in",
    category: "animation",
    prompt: "Fade in the credits.",
    solution: plan(call("animate_clip", { clipId: "credits", in: "fade" })),
    check: ({ doc }) => expect(recipe(doc, "credits").recipe.in?.preset).toBe("in:fade"),
  },
  {
    id: "an-credits-slide-up",
    category: "animation",
    prompt: "Have the 'Thanks for watching' text slide up into place.",
    solution: plan(call("animate_clip", { clipId: "credits", in: "up" })),
    check: ({ doc }) => expect(recipe(doc, "credits").recipe.in?.preset).toBe("in:up"),
  },
  {
    id: "an-title-slide-down-out",
    category: "animation",
    prompt: "At the end, the title should slide down and away.",
    solution: plan(call("animate_clip", { clipId: "title", out: "down" })),
    check: ({ doc }) => expect(recipe(doc, "title").recipe.out?.preset).toBe("out:down"),
  },
  {
    id: "an-logo-pulse",
    category: "animation",
    prompt: "Make the logo pulse.",
    solution: plan(call("animate_clip", { clipId: "logo1", loop: "pulse" })),
    check: ({ doc }) => expect(recipe(doc, "logo1").recipe.loop?.preset).toBe("loop:pulse"),
  },
  {
    id: "an-logo-float",
    category: "animation",
    prompt: "Let the logo float gently up and down while it's on screen.",
    solution: plan(call("animate_clip", { clipId: "logo1", loop: "float" })),
    check: ({ doc }) => expect(recipe(doc, "logo1").recipe.loop?.preset).toBe("loop:float"),
  },
  {
    id: "an-kenburns-v1",
    category: "animation",
    prompt: "Add a slow Ken Burns zoom to the first clip.",
    solution: plan(call("animate_clip", { clipId: "v1", loop: "kenburns" })),
    check: ({ doc }) => expect(recipe(doc, "v1").recipe.loop?.preset).toBe("loop:kenburns"),
  },
  {
    id: "an-zoom-in-title",
    category: "animation",
    prompt: "Zoom the title in.",
    solution: plan(call("animate_clip", { clipId: "title", in: "zoom" })),
    check: ({ doc }) => expect(recipe(doc, "title").recipe.in?.preset).toBe("in:zoom"),
  },
  {
    id: "an-spin-logo",
    category: "animation",
    prompt: "Spin the logo in.",
    solution: plan(call("animate_clip", { clipId: "logo1", in: "spin" })),
    check: ({ doc }) => expect(recipe(doc, "logo1").recipe.in?.preset).toBe("in:spin"),
  },
  {
    id: "an-slide-left-title",
    category: "animation",
    prompt: "Slide the title in from the right, moving left.",
    solution: plan(call("animate_clip", { clipId: "title", in: "left" })),
    check: ({ doc }) => expect(recipe(doc, "title").recipe.in?.preset).toBe("in:left"),
  },
  {
    id: "an-duration",
    category: "animation",
    prompt: "Fade the title in over 1.5 seconds.",
    solution: plan(call("animate_clip", { clipId: "title", in: "fade", inSeconds: 1.5 })),
    check: ({ doc }) => {
      const r = recipe(doc, "title").recipe;
      expect(r.in?.preset).toBe("in:fade");
      near(r.in!.durationUs, 1.5, 0.1);
    },
  },
  {
    id: "an-snappy",
    category: "animation",
    prompt: "Pop in the credits with a snappy feel.",
    solution: plan(call("animate_clip", { clipId: "credits", in: "pop", easing: "snappy" })),
    check: ({ doc }) => expect(recipe(doc, "credits").recipe.in).toMatchObject({ preset: "in:pop", easing: "snappy" }),
  },
  {
    id: "an-selected",
    category: "animation",
    prompt: "Make it fade out at the end.",
    select: ["credits"],
    context: 'Selected: credits (text, 22.0–27.0s). "This clip" / "it" means the selection.',
    solution: plan(call("animate_clip", { clipId: "credits", out: "fade" })),
    check: ({ doc }) => expect(recipe(doc, "credits").recipe.out?.preset).toBe("out:fade"),
  },
  {
    id: "an-all-text",
    category: "animation",
    prompt: "Fade every text in and out.",
    solution: plan(call("animate_clip", { clipId: "title", in: "fade", out: "fade" }), call("animate_clip", { clipId: "credits", in: "fade", out: "fade" })),
    check: ({ doc }) => {
      for (const id of ["title", "credits"]) expect(recipe(doc, id).recipe).toMatchObject({ in: { preset: "in:fade" }, out: { preset: "out:fade" } });
    },
  },
  {
    id: "an-remove",
    category: "animation",
    prompt: "Remove the animation from the title.",
    setup: (p) => {
      p.dispatch({ type: "keyframe/set", payload: { clipId: "title", property: "opacity", timeUs: 0, value: 0 } });
      p.dispatch({ type: "keyframe/set", payload: { clipId: "title", property: "opacity", timeUs: 500_000, value: 1 } });
    },
    solution: plan(call("animate_clip", { clipId: "title", reset: true })),
    check: ({ doc }) => expect(clip(doc, "title")!.animations ?? {}).toEqual({}),
  },
  {
    id: "an-keep-in-change-out",
    category: "animation",
    prompt: "Keep the title's entrance but make it zoom out at the end.",
    setup: (p) => {
      for (const c of animationCommands(p.getState().doc.clips.title!, { in: { preset: "in:pop", durationUs: 600_000, easing: "smooth" } })) p.dispatch(c);
    },
    solution: plan(call("animate_clip", { clipId: "title", out: "zoom" })),
    check: ({ doc }) => expect(recipe(doc, "title").recipe).toMatchObject({ in: { preset: "in:pop" }, out: { preset: "out:zoom" } }),
  },
  {
    id: "an-out-follows-trim",
    category: "animation",
    prompt: "Add a fade out to the credits.",
    solution: plan(call("animate_clip", { clipId: "credits", out: "fade" })),
    check: ({ doc }) => {
      const kf = clip(doc, "credits")!.animations?.opacity ?? [];
      // Exit keyframes are end-anchored, so they follow a later trim.
      expect(kf.some((k) => k.anchor === "end")).toBe(true);
    },
  },
  {
    id: "an-video-fade-in",
    category: "animation",
    prompt: "Fade the first clip up from black.",
    solution: plan(call("animate_clip", { clipId: "v1", in: "fade" })),
    check: ({ doc }) => expect(recipe(doc, "v1").recipe.in?.preset).toBe("in:fade"),
  },
  {
    id: "an-sway-logo",
    category: "animation",
    prompt: "Give the logo a slight sway.",
    solution: plan(call("animate_clip", { clipId: "logo1", loop: "sway" })),
    check: ({ doc }) => expect(recipe(doc, "logo1").recipe.loop?.preset).toBe("loop:sway"),
  },
  {
    id: "an-audio-refused",
    noEdit: true,
    category: "animation",
    prompt: "Make the music clip spin in.",
    solution: [{ toolCalls: [call("animate_clip", { clipId: "m1", in: "spin" })] }, "Audio has no picture to animate; I can fade the music in instead."],
    check: (c) => {
      expect(clip(c.doc, "m1")!.animations ?? {}).toEqual({});
      expect(c.turn.reply.length).toBeGreaterThan(0);
    },
  },
];

/* ======================================================================
 * Text
 * ==================================================================== */

const textCases: EvalCase[] = [
  {
    id: "tx-change-title",
    category: "text",
    prompt: 'Change the title to "Bunny Adventures".',
    solution: plan(apply(cmd("clip/set-property", { clipId: "title", text: "Bunny Adventures" }))),
    check: ({ doc }) => expect(clip<TextClip>(doc, "title")!.text).toBe("Bunny Adventures"),
  },
  {
    id: "tx-add-at-5",
    category: "text",
    prompt: 'Add a text that says "Chapter 1" at 5 seconds for 3 seconds.',
    solution: plan(apply(cmd("clip/add", { kind: "text", id: "chapter1", trackId: "titles", startUs: 5 * S, durationUs: 3 * S, text: "Chapter 1" }))),
    check: ({ doc }) => {
      const t = textWith(doc, /chapter 1/i);
      expect(t).toBeDefined();
      near(t!.startUs, 5);
      near(t!.durationUs, 3, 0.3);
    },
  },
  {
    id: "tx-bigger",
    category: "text",
    prompt: "Make the title text bigger.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "title", fontSizePx: 128 }))),
    check: ({ doc }) => expect(shownSize(clip<TextClip>(doc, "title")!)).toBeGreaterThan(96),
  },
  {
    id: "tx-smaller-credits",
    category: "text",
    prompt: "Make the credits smaller.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "credits", fontSizePx: 36 }))),
    check: ({ doc }) => expect(shownSize(clip<TextClip>(doc, "credits")!)).toBeLessThan(48),
  },
  {
    id: "tx-red",
    category: "text",
    prompt: "Make the title red.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "title", color: "#FF0000" }))),
    check: ({ doc }) => {
      const hex = clip<TextClip>(doc, "title")!.color.replace("#", "").toLowerCase();
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
      expect(r).toBeGreaterThan(150);
      expect(g).toBeLessThan(100);
      expect(b).toBeLessThan(100);
    },
  },
  {
    id: "tx-bold",
    category: "text",
    prompt: "Make the credits bold.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "credits", fontWeight: 700 }))),
    check: ({ doc }) => expect(Number(clip<TextClip>(doc, "credits")!.fontWeight ?? 400)).toBeGreaterThanOrEqual(600),
  },
  {
    id: "tx-center-screen",
    category: "text",
    prompt: "Move the title to the middle of the screen.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "title", transform: { x: 0.5, y: 0.5 } }))),
    check: ({ doc }) => {
      const t = clip(doc, "title")!.transform;
      expect(Math.abs(t.x - 0.5)).toBeLessThan(0.08);
      expect(Math.abs(t.y - 0.5)).toBeLessThan(0.08);
    },
  },
  {
    id: "tx-to-bottom",
    category: "text",
    prompt: "Put the title near the bottom of the frame.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "title", transform: { y: 0.85 } }))),
    check: ({ doc }) => expect(clip(doc, "title")!.transform.y).toBeGreaterThan(0.65),
  },
  {
    id: "tx-move-time",
    category: "text",
    prompt: "Start the title at 2 seconds instead.",
    solution: plan(apply(cmd("clip/move", { clipId: "title", startUs: 2 * S }))),
    check: ({ doc }) => near(clip(doc, "title")!.startUs, 2),
  },
  {
    id: "tx-longer",
    category: "text",
    prompt: "Keep the title on screen for 8 seconds.",
    solution: plan(apply(cmd("clip/trim", { clipId: "title", durationUs: 8 * S }))),
    check: ({ doc }) => near(clip(doc, "title")!.durationUs, 8, 0.2),
  },
  {
    id: "tx-delete-credits",
    category: "text",
    prompt: "Delete the 'Thanks for watching' text.",
    solution: plan(apply(cmd("clip/remove", { clipId: "credits" }))),
    check: ({ doc }) => {
      expect(clip(doc, "credits")).toBeUndefined();
      expect(clip(doc, "title")).toBeDefined();
    },
  },
  {
    id: "tx-lower-third",
    category: "text",
    prompt: 'Add a lower third "Directed by Sacha Goedegebure" from 10 to 14 seconds.',
    solution: plan(apply(cmd("clip/add", { kind: "text", id: "lower-third", trackId: "titles", startUs: 10 * S, durationUs: 4 * S, text: "Directed by Sacha Goedegebure", fontSizePx: 40, transform: { x: 0.3, y: 0.82 } }))),
    check: ({ doc }) => {
      const t = textWith(doc, /directed by/i)!;
      expect(t).toBeDefined();
      near(t.startUs, 10, 0.3);
      near(t.startUs + t.durationUs, 14, 0.3);
      expect(t.transform.y).toBeGreaterThan(0.6);
    },
  },
  {
    id: "tx-uppercase",
    category: "text",
    prompt: "Write the credits in all caps.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "credits", text: "THANKS FOR WATCHING" }))),
    check: ({ doc }) => expect(clip<TextClip>(doc, "credits")!.text).toBe("THANKS FOR WATCHING"),
  },
  {
    id: "tx-typo-fix",
    category: "text",
    prompt: 'Fix the credits so they read "Thanks for watching!" with an exclamation mark.',
    solution: plan(apply(cmd("clip/set-property", { clipId: "credits", text: "Thanks for watching!" }))),
    check: ({ doc }) => expect(clip<TextClip>(doc, "credits")!.text).toBe("Thanks for watching!"),
  },
  {
    id: "tx-align-center",
    category: "text",
    prompt: "Center-align the title text.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "title", textAlign: "center" }))),
    check: ({ doc }) => expect(clip<TextClip>(doc, "title")!.textAlign).toBe("center"),
  },
  {
    id: "tx-font",
    category: "text",
    prompt: "Use Georgia as the title font.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "title", fontFamily: "Georgia" }))),
    check: ({ doc }) => expect(clip<TextClip>(doc, "title")!.fontFamily).toMatch(/georgia/i),
  },
  {
    id: "tx-transparent",
    category: "text",
    prompt: "Make the credits half transparent.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "credits", transform: { opacity: 0.5 } }))),
    check: ({ doc }) => expect(Math.abs(clip(doc, "credits")!.transform.opacity - 0.5)).toBeLessThan(0.11),
  },
  {
    id: "tx-two-texts",
    category: "text",
    prompt: 'Add "Part 1" at 10s and "Part 2" at 20s, 3 seconds each.',
    solution: plan(
      apply(
        cmd("clip/add", { kind: "text", id: "part1", trackId: "titles", startUs: 10 * S, durationUs: 3 * S, text: "Part 1" }),
        cmd("clip/add", { kind: "text", id: "part2", trackId: "overlay", startUs: 20 * S, durationUs: 3 * S, text: "Part 2" }),
      ),
    ),
    check: ({ doc }) => {
      const p1 = textWith(doc, /^part 1$/i)!;
      const p2 = textWith(doc, /^part 2$/i)!;
      near(p1.startUs, 10, 0.3);
      near(p2.startUs, 20, 0.3);
      near(p1.durationUs, 3, 0.3);
      near(p2.durationUs, 3, 0.3);
    },
  },
  {
    id: "tx-rotate",
    category: "text",
    prompt: "Tilt the title a little, about 10 degrees.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "title", transform: { rotation: -10 } }))),
    check: ({ doc }) => expect(Math.abs(Math.abs(clip(doc, "title")!.transform.rotation) - 10)).toBeLessThan(3),
  },
  {
    id: "tx-selected-edit",
    category: "text",
    prompt: 'Change this to "The End".',
    select: ["credits"],
    context: 'Selected: credits (text, 22.0–27.0s). "This clip" / "it" means the selection.',
    solution: plan(apply(cmd("clip/set-property", { clipId: "credits", text: "The End" }))),
    check: ({ doc }) => {
      expect(clip<TextClip>(doc, "credits")!.text).toBe("The End");
      expect(clip<TextClip>(doc, "title")!.text).toBe(BUNNY);
    },
  },
  {
    id: "tx-duplicate",
    category: "text",
    prompt: "Show the title again at 12 seconds.",
    solution: plan(apply(cmd("clip/duplicate", { clipId: "title", newClipId: "title-2", startUs: 12 * S }))),
    check: ({ doc }) => {
      const copies = textClips(doc).filter((t) => t.text === BUNNY);
      expect(copies).toHaveLength(2);
      expect(copies.some((t) => Math.abs(t.startUs - 12 * S) <= 0.3 * S)).toBe(true);
    },
  },
];

/* ======================================================================
 * Clip editing (timeline)
 * ==================================================================== */

const clipCases: EvalCase[] = [
  {
    id: "cl-split-v1",
    category: "clips",
    prompt: "Split the first clip at 5 seconds.",
    solution: plan(apply(cmd("clip/split", { clipId: "v1", atUs: 5 * S }))),
    check: ({ doc }) => {
      const v = clipsOn(doc, "video");
      expect(v).toHaveLength(5);
      expect(v.some((c) => c.startUs === 5 * S || Math.abs(c.startUs - 5 * S) < 0.05 * S)).toBe(true);
    },
  },
  {
    id: "cl-delete-v3",
    category: "clips",
    prompt: "Delete the third video clip.",
    solution: plan(apply(cmd("clip/remove", { clipId: "v3" }))),
    check: ({ doc }) => {
      expect(clip(doc, "v3")).toBeUndefined();
      expect(clipsOn(doc, "video")).toHaveLength(3);
    },
  },
  {
    id: "cl-shorten-v1",
    category: "clips",
    prompt: "Shorten the first clip to 8 seconds.",
    solution: plan(apply(cmd("clip/trim", { clipId: "v1", durationUs: 8 * S }))),
    check: ({ doc }) => near(clip(doc, "v1")!.durationUs, 8, 0.1),
  },
  {
    id: "cl-tighten-gaps",
    category: "clips",
    prompt: "Close the gaps between the video clips.",
    setup: (p) => {
      p.dispatch({ type: "clip/move", payload: { clipId: "v2", startUs: 11 * S } });
      p.dispatch({ type: "clip/move", payload: { clipId: "v3", startUs: 17 * S } });
      p.dispatch({ type: "clip/move", payload: { clipId: "v4", startUs: 23 * S } });
    },
    solution: plan(call("close_gaps", { trackId: "video" })),
    check: ({ doc }) => {
      const v = clipsOn(doc, "video");
      for (let i = 1; i < v.length; i++) expect(v[i]!.startUs).toBe(v[i - 1]!.startUs + v[i - 1]!.durationUs);
    },
  },
  {
    id: "cl-mute-video",
    category: "clips",
    prompt: "Mute the original sound of all the video clips.",
    solution: plan(apply(...["v1", "v2", "v3", "v4"].map((id) => cmd("clip/set-property", { clipId: id, volume: 0 })))),
    check: ({ doc }) => {
      const muted = (doc.tracks.video?.muted ?? false) || videoClips(doc).every((c) => c.volume === 0);
      expect(muted).toBe(true);
      expect(clip<AudioClip>(doc, "m1")!.volume).toBe(0.8);
    },
  },
  {
    id: "cl-half-volume-v2",
    category: "clips",
    prompt: "Turn down the second clip's volume to half.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "v2", volume: 0.5 }))),
    check: ({ doc }) => expect(clip<VideoClip>(doc, "v2")!.volume).toBeCloseTo(0.5, 2),
  },
  {
    id: "cl-move-v4-track",
    category: "clips",
    prompt: "Move the last video clip so it starts at 25 seconds.",
    solution: plan(apply(cmd("clip/move", { clipId: "v4", startUs: 25 * S }))),
    check: ({ doc }) => near(clip(doc, "v4")!.startUs, 25),
  },
  {
    id: "cl-duplicate-v2",
    category: "clips",
    prompt: "Repeat the second clip at the end of the video.",
    solution: plan(apply(cmd("clip/duplicate", { clipId: "v2", newClipId: "v2-again", startUs: 28 * S }))),
    check: ({ doc }) => {
      const v = clipsOn(doc, "video");
      expect(v).toHaveLength(5);
      const last = v.at(-1) as VideoClip;
      expect(last.trimStartUs).toBe(11 * S);
      expect(last.startUs).toBeGreaterThanOrEqual(27.9 * S);
    },
  },
  {
    id: "cl-opacity",
    category: "clips",
    prompt: "Make the logo 50% transparent.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "logo1", transform: { opacity: 0.5 } }))),
    check: ({ doc }) => expect(Math.abs(clip(doc, "logo1")!.transform.opacity - 0.5)).toBeLessThan(0.11),
  },
  {
    id: "cl-logo-bigger",
    category: "clips",
    prompt: "Make the logo twice as big.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "logo1", transform: { scale: 0.6 } }))),
    check: ({ doc }) => near(clip(doc, "logo1")!.transform.scale * S, 0.6, 0.06),
  },
  {
    id: "cl-logo-left",
    category: "clips",
    prompt: "Move the logo to the top-left corner.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "logo1", transform: { x: 0.1, y: 0.12 } }))),
    check: ({ doc }) => {
      const t = clip(doc, "logo1")!.transform;
      expect(t.x).toBeLessThan(0.3);
      expect(t.y).toBeLessThan(0.3);
    },
  },
  {
    id: "cl-logo-longer",
    category: "clips",
    prompt: "Keep the logo on screen for the whole video.",
    solution: plan(call("trim_clip", { clipId: "logo1", startSeconds: 0, endSeconds: 28 })),
    check: ({ doc }) => {
      const l = clip(doc, "logo1")!;
      expect(l.startUs).toBeLessThanOrEqual(0.2 * S);
      expect(l.startUs + l.durationUs).toBeGreaterThanOrEqual(27.8 * S);
    },
  },
  {
    id: "cl-delete-logo",
    category: "clips",
    prompt: "Get rid of the logo.",
    solution: plan(apply(cmd("clip/remove", { clipId: "logo1" }))),
    check: ({ doc }) => expect(Object.values(doc.clips).some((c) => c.kind === "image")).toBe(false),
  },
  {
    id: "cl-flip-rotate",
    category: "clips",
    prompt: "Rotate the logo by 45 degrees.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "logo1", transform: { rotation: 45 } }))),
    check: ({ doc }) => expect(Math.abs(Math.abs(clip(doc, "logo1")!.transform.rotation) - 45)).toBeLessThan(2),
  },
  {
    id: "cl-trim-start-v4",
    category: "clips",
    prompt: "Cut the first 2 seconds off the last clip, keeping it where it ends.",
    solution: plan(call("trim_clip", { clipId: "v4", removeFromStart: 2 })),
    check: ({ doc }) => {
      const v4 = clip<VideoClip>(doc, "v4")!;
      near(v4.durationUs, 6, 0.1);
      near(v4.trimStartUs, 32, 0.1);
      near(v4.startUs + v4.durationUs, 28, 0.1);
    },
  },
  {
    id: "cl-split-playhead",
    category: "clips",
    prompt: "Split the video here.",
    playheadS: 12,
    context: "Playhead: 12.0s.",
    solution: plan(apply(cmd("clip/split", { clipId: "v2", atUs: 12 * S }))),
    check: ({ doc }) => {
      const v = clipsOn(doc, "video");
      expect(v).toHaveLength(5);
      expect(v.some((c) => Math.abs(c.startUs - 12 * S) < 0.05 * S)).toBe(true);
    },
  },
  {
    id: "cl-remove-middle-gap",
    category: "clips",
    prompt: "Remove the third clip and close the gap it leaves.",
    solution: plan(apply(cmd("clip/remove", { clipId: "v3" })), call("close_gaps", { trackId: "video" })),
    check: ({ doc }) => {
      expect(clip(doc, "v3")).toBeUndefined();
      near(clip(doc, "v4")!.startUs, 15, 0.05);
    },
  },
  {
    id: "cl-speed-not-supported",
    noEdit: true,
    category: "clips",
    prompt: "Play the second clip at double speed.",
    solution: answer("Playback speed isn't something this editor can change yet. I can shorten the clip instead if that helps."),
    check: (c) => {
      expect(clip<VideoClip>(c.doc, "v2")!.trimStartUs).toBe(11 * S);
      expect(c.turn.reply.length).toBeGreaterThan(0);
    },
  },
  {
    id: "cl-shorten-ripple",
    category: "clips",
    prompt: "Shorten the second clip by 2 seconds and pull the rest of the video up so there's no gap.",
    solution: plan(call("trim_clip", { clipId: "v2", removeFromEnd: 2, ripple: true })),
    check: ({ doc }) => {
      near(clip(doc, "v2")!.durationUs, 3, 0.1);
      near(clip(doc, "v3")!.startUs, 13, 0.1);
      near(clip(doc, "v4")!.startUs, 18, 0.1);
    },
  },
  {
    id: "cl-logo-smaller",
    category: "clips",
    prompt: "Make the logo a bit smaller.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "logo1", transform: { scale: 0.22 } }))),
    check: ({ doc }) => {
      const scale = clip(doc, "logo1")!.transform.scale;
      expect(scale).toBeLessThan(0.3);
      expect(scale).toBeGreaterThan(0.1);
    },
  },
  {
    id: "cl-trim-end-v1",
    category: "clips",
    prompt: "Cut the last second off the first clip, but leave the rest of the timeline alone.",
    solution: plan(call("trim_clip", { clipId: "v1", removeFromEnd: 1 })),
    check: ({ doc }) => {
      near(clip(doc, "v1")!.durationUs, 9, 0.1);
      near(clip(doc, "v2")!.startUs, 10, 0.05);
    },
  },
  {
    id: "cl-swap-order",
    category: "clips",
    prompt: "Swap the order of the second and third clips.",
    solution: plan(apply(cmd("clip/move", { clipId: "v3", startUs: 10 * S }), cmd("clip/move", { clipId: "v2", startUs: 15 * S }))),
    check: ({ doc }) => {
      near(clip(doc, "v3")!.startUs, 10, 0.05);
      near(clip(doc, "v2")!.startUs, 15, 0.05);
    },
  },
];

/* ======================================================================
 * Tracks
 * ==================================================================== */

const trackCases: EvalCase[] = [
  {
    id: "tk-hide-titles",
    category: "tracks",
    prompt: "Hide the titles track.",
    solution: plan(apply(cmd("track/set-property", { trackId: "titles", hidden: true }))),
    check: ({ doc }) => expect(doc.tracks.titles!.hidden).toBe(true),
  },
  {
    id: "tk-mute-music",
    category: "tracks",
    prompt: "Mute the music track.",
    solution: plan(apply(cmd("track/set-property", { trackId: "music", muted: true }))),
    check: ({ doc }) => {
      const muted = doc.tracks.music!.muted || clip<AudioClip>(doc, "m1")!.volume === 0;
      expect(muted).toBe(true);
    },
  },
  {
    id: "tk-lock-video",
    category: "tracks",
    prompt: "Lock the video track so I don't move it by accident.",
    solution: plan(apply(cmd("track/set-property", { trackId: "video", locked: true }))),
    check: ({ doc }) => expect(doc.tracks.video!.locked).toBe(true),
  },
  {
    id: "tk-rename",
    category: "tracks",
    prompt: 'Rename the overlay track to "Branding".',
    solution: plan(apply(cmd("track/rename", { trackId: "overlay", name: "Branding" }))),
    check: ({ doc }) => expect(doc.tracks.overlay!.name).toBe("Branding"),
  },
  {
    id: "tk-add-audio-track",
    category: "tracks",
    prompt: "Add a new audio track for voiceover.",
    solution: plan(apply(cmd("track/add", { id: "voiceover", kind: "audio", name: "Voiceover" }))),
    check: ({ doc, before }) => {
      const added = Object.values(doc.tracks).filter((t) => !before.tracks[t.id]);
      expect(added).toHaveLength(1);
      expect(added[0]!.kind).toBe("audio");
    },
  },
  {
    id: "tk-delete-overlay",
    category: "tracks",
    prompt: "Delete the overlay track.",
    solution: plan(apply(cmd("track/remove", { id: "overlay" }))),
    check: ({ doc }) => {
      expect(doc.tracks.overlay).toBeUndefined();
      expect(clip(doc, "logo1")).toBeUndefined();
    },
  },
  {
    id: "tk-solo-music",
    category: "tracks",
    prompt: "Solo the music so I can hear it alone.",
    solution: plan(apply(cmd("track/set-property", { trackId: "music", solo: true }))),
    check: ({ doc }) => expect(doc.tracks.music!.solo).toBe(true),
  },
  {
    id: "tk-titles-under",
    category: "tracks",
    prompt: "Put the logo layer above the titles.",
    solution: plan(apply(cmd("track/reorder", { trackId: "overlay", index: 3 }))),
    check: ({ doc }) => expect(doc.trackOrder.indexOf("overlay")).toBeGreaterThan(doc.trackOrder.indexOf("titles")),
  },
  {
    id: "tk-show-hidden",
    category: "tracks",
    prompt: "Show the titles again.",
    setup: (p) => p.dispatch({ type: "track/set-property", payload: { trackId: "titles", hidden: true } }),
    solution: plan(apply(cmd("track/set-property", { trackId: "titles", hidden: false }))),
    check: ({ doc }) => expect(doc.tracks.titles!.hidden ?? false).toBe(false),
  },
];

/* ======================================================================
 * Effects
 * ==================================================================== */

const effectCases: EvalCase[] = [
  {
    id: "fx-bw-v2",
    category: "effects",
    prompt: "Make the second clip black and white.",
    solution: plan(call("add_effect", { clipIds: ["v2"], kind: "mono" })),
    check: ({ doc }) => {
      const kinds = (clip(doc, "v2")!.effects ?? []).map((e) => e.kind);
      const desaturated = kinds.includes("mono") || kinds.includes("noir") || (clip(doc, "v2")!.effects ?? []).some((e) => e.kind === "colorAdjust" && Number(e.params.saturation) <= -0.9);
      expect(desaturated).toBe(true);
    },
  },
  {
    id: "fx-blur-v3",
    category: "effects",
    prompt: "Blur the third clip.",
    solution: plan(apply(cmd("effect/add", { clipId: "v3", kind: "blur" }))),
    check: ({ doc }) => hasEffect(doc, "v3", "blur"),
  },
  {
    id: "fx-sepia-all",
    category: "effects",
    prompt: "Give all the video clips a sepia look.",
    solution: plan(apply(...["v1", "v2", "v3", "v4"].map((id) => cmd("effect/add", { clipId: id, kind: "sepia" })))),
    check: ({ doc }) => {
      for (const id of ["v1", "v2", "v3", "v4"]) hasEffect(doc, id, "sepia");
    },
  },
  {
    id: "fx-brighter",
    category: "effects",
    prompt: "Brighten the first clip a bit.",
    solution: plan(apply(cmd("effect/add", { clipId: "v1", kind: "colorAdjust", params: { brightness: 0.15 } }))),
    check: ({ doc }) => {
      const fx = clip(doc, "v1")!.effects ?? [];
      const brighter = fx.some((e) => (e.kind === "colorAdjust" && Number(e.params.brightness) > 0) || (e.kind === "exposure" && Number(e.params.stops) > 0) || e.kind === "gamma");
      expect(brighter).toBe(true);
    },
  },
  {
    id: "fx-vignette",
    category: "effects",
    prompt: "Add a vignette to the last clip.",
    solution: plan(apply(cmd("effect/add", { clipId: "v4", kind: "vignette" }))),
    check: ({ doc }) => hasEffect(doc, "v4", "vignette"),
  },
  {
    id: "fx-vintage-selected",
    category: "effects",
    prompt: "Make this look vintage.",
    select: ["v2"],
    context: 'Selected: v2 (video, 10.0–15.0s). "This clip" / "it" means the selection.',
    solution: plan(apply(cmd("effect/add", { clipId: "v2", kind: "vintage" }))),
    check: ({ doc }) => {
      const kinds = (clip(doc, "v2")!.effects ?? []).map((e) => e.kind);
      expect(kinds.some((k) => ["vintage", "sepia", "faded", "polaroid", "kodachrome", "lomo", "grain"].includes(k))).toBe(true);
      expect(clip(doc, "v1")!.effects ?? []).toHaveLength(0);
    },
  },
  {
    id: "fx-remove",
    category: "effects",
    prompt: "Remove the effects from the first clip.",
    setup: (p) => p.dispatch({ type: "effect/add", payload: { clipId: "v1", kind: "blur", effectId: "fx-blur" } }),
    solution: plan(call("remove_effects", { clipIds: ["v1"] })),
    check: ({ doc }) => expect(clip(doc, "v1")!.effects ?? []).toHaveLength(0),
  },
  {
    id: "fx-grain",
    category: "effects",
    prompt: "Add film grain to the first clip.",
    solution: plan(call("add_effect", { clipIds: ["v1"], kind: "grain" })),
    check: ({ doc }) => hasEffect(doc, "v1", "grain"),
  },
  {
    id: "fx-teal-orange",
    category: "effects",
    prompt: "Give the clips a cinematic teal and orange grade.",
    solution: plan(call("add_effect", { clipIds: ["v1", "v2", "v3", "v4"], kind: "tealOrange" })),
    check: ({ doc }) => {
      const graded = videoClips(doc).filter((c) => (c.effects ?? []).some((e) => e.kind === "tealOrange"));
      expect(graded.length).toBeGreaterThanOrEqual(4);
    },
  },
  {
    id: "fx-desaturate",
    category: "effects",
    prompt: "Desaturate the third clip a little.",
    solution: plan(apply(cmd("effect/add", { clipId: "v3", kind: "colorAdjust", params: { saturation: -0.4 } }))),
    check: ({ doc }) => {
      const fx = clip(doc, "v3")!.effects ?? [];
      expect(fx.some((e) => (e.kind === "colorAdjust" && Number(e.params.saturation) < 0) || e.kind === "faded" || e.kind === "mono")).toBe(true);
    },
  },
  {
    id: "fx-remove-one-kind",
    category: "effects",
    prompt: "Take the blur off the first clip but keep its other effects.",
    setup: (p) => {
      p.dispatch({ type: "effect/add", payload: { clipId: "v1", kind: "blur", effectId: "fx-blur" } });
      p.dispatch({ type: "effect/add", payload: { clipId: "v1", kind: "sepia", effectId: "fx-sepia" } });
    },
    solution: plan(call("remove_effects", { clipIds: ["v1"], kind: "blur" })),
    check: ({ doc }) => expect((clip(doc, "v1")!.effects ?? []).map((e) => e.kind)).toEqual(["sepia"]),
  },
  {
    id: "fx-contrast",
    category: "effects",
    prompt: "Add more contrast to the last clip.",
    solution: plan(call("add_effect", { clipIds: ["v4"], kind: "colorAdjust", params: { contrast: 0.25 } })),
    check: ({ doc }) => {
      const fx = clip(doc, "v4")!.effects ?? [];
      expect(fx.some((e) => (e.kind === "colorAdjust" && Number(e.params.contrast) > 0) || e.kind === "contrastCurve")).toBe(true);
    },
  },
  {
    id: "fx-pixelate-logo",
    category: "effects",
    prompt: "Pixelate the logo.",
    solution: plan(apply(cmd("effect/add", { clipId: "logo1", kind: "pixelate" }))),
    check: ({ doc }) => hasEffect(doc, "logo1", "pixelate"),
  },
];

/* ======================================================================
 * Audio
 * ==================================================================== */

const audioCases: EvalCase[] = [
  {
    id: "au-music-volume",
    category: "audio",
    prompt: "Lower the music to 30%.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "m1", volume: 0.3 }))),
    check: ({ doc }) => expect(clip<AudioClip>(doc, "m1")!.volume).toBeCloseTo(0.3, 2),
  },
  {
    id: "au-music-fade-out",
    category: "audio",
    prompt: "Fade the music out over the last 3 seconds.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "m1", fadeOutUs: 3 * S }))),
    check: ({ doc }) => {
      const m = clip<AudioClip>(doc, "m1")!;
      const fadeKf = (m.animations?.volume ?? []).length > 0;
      if (!fadeKf) near(m.fadeOutUs ?? 0, 3, 0.2);
    },
  },
  {
    id: "au-music-fade-in",
    category: "audio",
    prompt: "Fade the music in at the start.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "m1", fadeInUs: 2 * S }))),
    check: ({ doc }) => {
      const m = clip<AudioClip>(doc, "m1")!;
      expect((m.fadeInUs ?? 0) > 0 || (m.animations?.volume ?? []).length > 0).toBe(true);
    },
  },
  {
    id: "au-remove-music",
    category: "audio",
    prompt: "Remove the background music.",
    solution: plan(apply(cmd("clip/remove", { clipId: "m1" }))),
    check: ({ doc }) => expect(audioClips(doc)).toHaveLength(0),
  },
  {
    id: "au-add-whoosh",
    category: "audio",
    prompt: "Add a whoosh sound effect at 10 seconds.",
    solution: [
      { toolCalls: [call("search_audio", { query: "whoosh", kind: "sfx" })] },
      { toolCalls: [call("add_audio", { provider: "demo", id: "sfx-whoosh", atSeconds: 10 })] },
      "Added a whoosh at 10s.",
    ],
    check: ({ doc, before }) => {
      const added = audioClips(doc).filter((c) => !before.clips[c.id]);
      expect(added).toHaveLength(1);
      near(added[0]!.startUs, 10, 0.6);
    },
  },
  {
    id: "au-calm-music",
    category: "audio",
    prompt: "Replace the music with something calm.",
    solution: [
      { toolCalls: [call("search_audio", { query: "calm", kind: "music" })] },
      { toolCalls: [call("add_audio", { provider: "demo", id: "calm-drift", replaceClipId: "m1" })] },
      "Swapped in Calm Drift.",
    ],
    check: ({ doc }) => {
      expect(clip(doc, "m1")).toBeUndefined();
      const music = audioClips(doc);
      expect(music).toHaveLength(1);
      expect(doc.assets[music[0]!.assetId]!.name).toMatch(/calm/i);
    },
  },
  {
    id: "au-ding-end",
    category: "audio",
    prompt: "Put a ding sound right when the credits appear.",
    solution: [
      { toolCalls: [call("search_audio", { query: "ding", kind: "sfx" })] },
      { toolCalls: [call("add_audio", { provider: "demo", id: "sfx-ding", atSeconds: 22 })] },
      "Done.",
    ],
    check: ({ doc, before }) => {
      const added = audioClips(doc).filter((c) => !before.clips[c.id]);
      expect(added).toHaveLength(1);
      near(added[0]!.startUs, 22, 0.6);
    },
  },
  {
    id: "au-whoosh-each-cut",
    category: "audio",
    prompt: "Add a whoosh at each cut.",
    solution: [
      { toolCalls: [call("search_audio", { query: "whoosh", kind: "sfx" })] },
      { toolCalls: [10, 15, 20].map((s) => call("add_audio", { provider: "demo", id: "sfx-whoosh", atSeconds: s - 0.4 })) },
      "Added three whooshes.",
    ],
    check: ({ doc, before }) => {
      const added = audioClips(doc).filter((c) => !before.clips[c.id]).sort((a, b) => a.startUs - b.startUs);
      expect(added).toHaveLength(3);
      [10, 15, 20].forEach((s, i) => near(added[i]!.startUs, s, 0.8));
    },
  },
  {
    id: "au-generate-sfx",
    category: "audio",
    prompt: "Generate a short laser zap sound at 5 seconds.",
    solution: plan(call("generate_audio", { kind: "sfx", prompt: "short laser zap", durationSeconds: 1, atSeconds: 5 })),
    check: ({ doc, before }) => {
      const added = audioClips(doc).filter((c) => !before.clips[c.id]);
      expect(added).toHaveLength(1);
      near(added[0]!.startUs, 5, 0.6);
      expect(doc.assets[added[0]!.assetId]!.source?.provider).toBe("tone");
    },
  },
  {
    id: "au-music-quieter-under-title",
    category: "audio",
    prompt: "Make the music quieter, it's too loud.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "m1", volume: 0.4 }))),
    check: ({ doc }) => {
      const m = clip<AudioClip>(doc, "m1")!;
      expect(m.volume < 0.8 || (m.animations?.volume ?? []).length > 0).toBe(true);
      expect(m.volume).toBeGreaterThan(0);
    },
  },
  {
    id: "au-music-shorter",
    category: "audio",
    prompt: "End the music at 20 seconds.",
    solution: plan(apply(cmd("clip/trim", { clipId: "m1", durationUs: 20 * S }))),
    check: ({ doc }) => {
      const m = clip<AudioClip>(doc, "m1")!;
      near(m.startUs + m.durationUs, 20, 0.2);
    },
  },
  {
    id: "au-louder-video",
    category: "audio",
    prompt: "Boost the first clip's audio a little.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "v1", volume: 1.3 }))),
    check: ({ doc }) => expect(clip<VideoClip>(doc, "v1")!.volume).toBeGreaterThan(1),
  },
];

/* ======================================================================
 * Captions
 * ==================================================================== */

const captionCases: EvalCase[] = [
  {
    id: "cp-add-words",
    category: "captions",
    prompt: 'Add a caption at 1 second that says "Meet the bunny".',
    solution: plan(
      apply(
        cmd("clip/add", {
          kind: "caption",
          id: "cap1",
          trackId: "captions",
          startUs: 1 * S,
          durationUs: 1.5 * S,
          words: ["Meet", "the", "bunny"].map((text, i) => ({ text, startUs: i * 500_000, durationUs: 500_000 })),
        }),
      ),
    ),
    setup: (p) => p.dispatch({ type: "track/add", payload: { id: "captions", kind: "video", name: "Captions" } }),
    check: ({ doc }) => {
      const c = captions(doc);
      expect(c).toHaveLength(1);
      expect(c[0]!.words.map((w) => w.text).join(" ").toLowerCase()).toBe("meet the bunny");
      near(c[0]!.startUs, 1, 0.3);
    },
  },
  {
    id: "cp-edit-words",
    category: "captions",
    prompt: 'Change the caption to "Hello world".',
    setup: (p) => {
      p.dispatch({ type: "track/add", payload: { id: "captions", kind: "video", name: "Captions" } });
      p.dispatch({ type: "clip/add", payload: { kind: "caption", id: "cap1", trackId: "captions", startUs: 6 * S, durationUs: 2 * S, words: [{ text: "Old", startUs: 0, durationUs: S }, { text: "text", startUs: S, durationUs: S }] } });
    },
    solution: plan(apply(cmd("clip/set-property", { clipId: "cap1", words: [{ text: "Hello", startUs: 0, durationUs: S }, { text: "world", startUs: S, durationUs: S }] }))),
    check: ({ doc }) => expect(captions(doc)[0]!.words.map((w) => w.text).join(" ")).toBe("Hello world"),
  },
  {
    id: "cp-karaoke",
    category: "captions",
    prompt: "Make the caption highlight words karaoke style.",
    setup: (p) => {
      p.dispatch({ type: "track/add", payload: { id: "captions", kind: "video", name: "Captions" } });
      p.dispatch({ type: "clip/add", payload: { kind: "caption", id: "cap1", trackId: "captions", startUs: 6 * S, durationUs: 2 * S, words: [{ text: "Sing", startUs: 0, durationUs: S }, { text: "along", startUs: S, durationUs: S }] } });
    },
    solution: plan(apply(cmd("clip/set-property", { clipId: "cap1", style: { preset: "karaoke" } }))),
    check: ({ doc }) => expect(captions(doc)[0]!.style.preset).toBe("karaoke"),
  },
  {
    id: "cp-remove",
    category: "captions",
    prompt: "Delete the caption.",
    setup: (p) => {
      p.dispatch({ type: "track/add", payload: { id: "captions", kind: "video", name: "Captions" } });
      p.dispatch({ type: "clip/add", payload: { kind: "caption", id: "cap1", trackId: "captions", startUs: 6 * S, durationUs: 2 * S, words: [{ text: "Bye", startUs: 0, durationUs: 2 * S }] } });
    },
    solution: plan(apply(cmd("clip/remove", { clipId: "cap1" }))),
    check: ({ doc }) => expect(captions(doc)).toHaveLength(0),
  },
  {
    id: "cp-no-asr",
    noEdit: true,
    category: "captions",
    prompt: "Transcribe the dialogue into captions.",
    solution: answer("I can't hear the audio, so I can't transcribe it here. Paste the lines (or import an SRT file in the Subtitles panel) and I'll time them as captions."),
    check: (c) => {
      expect(captions(c.doc)).toHaveLength(0);
      expect(c.turn.reply.length).toBeGreaterThan(0);
    },
  },
  {
    id: "cp-caption-color",
    category: "captions",
    prompt: "Make the caption's highlighted word yellow.",
    setup: (p) => {
      p.dispatch({ type: "track/add", payload: { id: "captions", kind: "video", name: "Captions" } });
      p.dispatch({ type: "clip/add", payload: { kind: "caption", id: "cap1", trackId: "captions", startUs: 6 * S, durationUs: 2 * S, words: [{ text: "Look", startUs: 0, durationUs: S }, { text: "here", startUs: S, durationUs: S }], style: { preset: "highlight", highlightColor: "#22D3EE" } } });
    },
    solution: plan(apply(cmd("clip/set-property", { clipId: "cap1", style: { highlightColor: "#FFD400" } }))),
    check: ({ doc }) => {
      const hex = captions(doc)[0]!.style.highlightColor.replace("#", "").toLowerCase();
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
      expect(r).toBeGreaterThan(180);
      expect(g).toBeGreaterThan(150);
      expect(b).toBeLessThan(120);
    },
  },
];

/* ======================================================================
 * Project
 * ==================================================================== */

const projectCases: EvalCase[] = [
  {
    id: "pj-vertical",
    category: "project",
    prompt: "Make this a vertical video for Reels (9:16).",
    solution: plan(apply(cmd("project/set-settings", { width: 1080, height: 1920 }))),
    check: ({ doc }) => {
      expect(doc.settings.height).toBeGreaterThan(doc.settings.width);
      expect(doc.settings.width / doc.settings.height).toBeCloseTo(9 / 16, 2);
    },
  },
  {
    id: "pj-square",
    category: "project",
    prompt: "Switch to a square format.",
    solution: plan(apply(cmd("project/set-settings", { width: 1080, height: 1080 }))),
    check: ({ doc }) => expect(doc.settings.width).toBe(doc.settings.height),
  },
  {
    id: "pj-fps",
    category: "project",
    prompt: "Set the frame rate to 24 fps.",
    solution: plan(apply(cmd("project/set-settings", { fps: 24 }))),
    check: ({ doc }) => expect(doc.settings.fps).toBe(24),
  },
  {
    id: "pj-rename",
    category: "project",
    prompt: 'Rename the project to "Spring Teaser".',
    solution: plan(apply(cmd("project/set-settings", { name: "Spring Teaser" }))),
    check: ({ doc }) => expect(doc.settings.name).toBe("Spring Teaser"),
  },
  {
    id: "pj-4k",
    category: "project",
    prompt: "Make the project 4K.",
    solution: plan(apply(cmd("project/set-settings", { width: 3840, height: 2160 }))),
    check: ({ doc }) => expect([doc.settings.width, doc.settings.height]).toEqual([3840, 2160]),
  },
];

/* ======================================================================
 * Questions (no edits expected)
 * ==================================================================== */

const questionCases: EvalCase[] = ([
  {
    id: "q-length",
    category: "questions",
    prompt: "How long is the video?",
    solution: answer("It runs 28 seconds."),
    check: (c) => {
      unchanged(c);
      expect(c.turn.reply).toMatch(/28/);
    },
  },
  {
    id: "q-count-clips",
    category: "questions",
    prompt: "How many video clips are there?",
    solution: answer("There are 4 video clips on the Video track."),
    check: (c) => {
      unchanged(c);
      expect(c.turn.reply).toMatch(/\b(4|four)\b/i);
    },
  },
  {
    id: "q-music-name",
    category: "questions",
    prompt: "What's the background music called?",
    solution: answer('The music is "Sunny Steps".'),
    check: (c) => {
      unchanged(c);
      expect(c.turn.reply).toMatch(/sunny steps/i);
    },
  },
  {
    id: "q-title-when",
    category: "questions",
    prompt: "When does the title appear?",
    solution: answer("The title shows from 0.5s to 4.5s."),
    check: (c) => {
      unchanged(c);
      expect(c.turn.reply).toMatch(/0[.,]5/);
    },
  },
  {
    id: "q-transitions",
    category: "questions",
    prompt: "Are there any transitions yet?",
    solution: answer("Not yet: all three cuts (10s, 15s, 20s) are hard cuts."),
    check: (c) => {
      unchanged(c);
      expect(c.turn.reply).toMatch(/\b(no|not|none|hard)\b/i);
    },
  },
  {
    id: "q-resolution",
    category: "questions",
    prompt: "What resolution is the project?",
    solution: answer("1920×1080 at 30 fps."),
    check: (c) => {
      unchanged(c);
      expect(c.turn.reply).toMatch(/1920/);
    },
  },
  {
    id: "q-greeting",
    category: "questions",
    prompt: "Hi! What can you do?",
    solution: answer("I can edit this video for you: transitions, animations, text, effects, audio and more. Just ask."),
    check: (c) => {
      unchanged(c);
      expect(c.turn.reply.length).toBeGreaterThan(10);
    },
  },
  {
    id: "q-ambiguous",
    category: "questions",
    prompt: "Make it better.",
    solution: answer("Happy to — what would you like improved: pacing, transitions, titles, color or audio?"),
    check: (c) => expect(c.turn.reply.length).toBeGreaterThan(0),
  },
] as EvalCase[]).map((c) => ({ ...c, noEdit: true as const }));

/* ======================================================================
 * Compound requests
 * ==================================================================== */

const compoundCases: EvalCase[] = [
  {
    id: "mx-polish",
    category: "compound",
    prompt: "Smooth all the cuts with dissolves and make the title pop in.",
    solution: plan(call("add_transition", { kind: "crossDissolve", allCuts: true }), call("animate_clip", { clipId: "title", in: "pop" })),
    check: ({ doc }) => {
      expect(transitions(doc)).toHaveLength(3);
      expect(recipe(doc, "title").recipe.in?.preset).toBe("in:pop");
    },
  },
  {
    id: "mx-intro-outro",
    category: "compound",
    prompt: "Fade the video in from black at the start and out to black at the end.",
    solution: plan(call("animate_clip", { clipId: "v1", in: "fade" }), call("animate_clip", { clipId: "v4", out: "fade" })),
    check: ({ doc }) => {
      expect(recipe(doc, "v1").recipe.in?.preset).toBe("in:fade");
      expect(recipe(doc, "v4").recipe.out?.preset).toBe("out:fade");
    },
  },
  {
    id: "mx-title-restyle",
    category: "compound",
    prompt: "Make the title yellow, bold, and move it to the center.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "title", color: "#FFD400", fontWeight: 800, transform: { x: 0.5, y: 0.5 } }))),
    check: ({ doc }) => {
      const t = clip<TextClip>(doc, "title")!;
      const hex = t.color.replace("#", "").toLowerCase();
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
      expect(r! > 180 && g! > 150 && b! < 120).toBe(true);
      expect(Number(t.fontWeight ?? 400)).toBeGreaterThanOrEqual(600);
      expect(Math.abs(t.transform.y - 0.5)).toBeLessThan(0.1);
    },
  },
  {
    id: "mx-music-duck",
    category: "compound",
    prompt: "Lower the music to 25% and fade it out at the end.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "m1", volume: 0.25, fadeOutUs: 2 * S }))),
    check: ({ doc }) => {
      const m = clip<AudioClip>(doc, "m1")!;
      expect(m.volume).toBeCloseTo(0.25, 2);
      expect((m.fadeOutUs ?? 0) > 0 || (m.animations?.volume ?? []).length > 0).toBe(true);
    },
  },
  {
    id: "mx-cut-and-dissolve",
    category: "compound",
    prompt: "Split the first clip at 5 seconds and put a dissolve on the new cut.",
    solution: [
      { toolCalls: [apply(cmd("clip/split", { clipId: "v1", atUs: 5 * S, newClipId: "v1b" }))] },
      { toolCalls: [call("add_transition", { kind: "crossDissolve", nearSeconds: 5 })] },
      "Done.",
    ],
    check: ({ doc }) => {
      expect(clipsOn(doc, "video")).toHaveLength(5);
      expect(transitions(doc).some((t) => Math.abs(doc.clips[t.toClipId]!.startUs - 5 * S) < 0.1 * S)).toBe(true);
    },
  },
  {
    id: "mx-new-title-animated",
    category: "compound",
    prompt: 'Add a title "The End" over the last 3 seconds and fade it in.',
    solution: [
      { toolCalls: [apply(cmd("clip/add", { kind: "text", id: "the-end", trackId: "overlay", startUs: 25 * S, durationUs: 3 * S, text: "The End", fontSizePx: 96, transform: { x: 0.5, y: 0.5 } }))] },
      { toolCalls: [call("animate_clip", { clipId: "the-end", in: "fade" })] },
      "Done.",
    ],
    check: ({ doc }) => {
      const t = textWith(doc, /the end/i)!;
      expect(t).toBeDefined();
      expect(overlap(t, 25, 28)).toBe(true);
      expect(readAnimation(t).recipe.in?.preset).toBe("in:fade");
    },
  },
  {
    id: "mx-bw-and-blur",
    category: "compound",
    prompt: "Make the last clip black and white with a light blur.",
    solution: plan(apply(cmd("effect/add", { clipId: "v4", kind: "mono" }), cmd("effect/add", { clipId: "v4", kind: "blur", params: { amount: 0.01 } }))),
    check: ({ doc }) => {
      const kinds = (clip(doc, "v4")!.effects ?? []).map((e) => e.kind);
      expect(kinds).toContain("blur");
      expect(kinds.some((k) => k === "mono" || k === "noir" || k === "colorAdjust")).toBe(true);
    },
  },
  {
    id: "mx-reel",
    category: "compound",
    prompt: "Turn this into a vertical reel and move the title to the top third.",
    solution: plan(apply(cmd("project/set-settings", { width: 1080, height: 1920 }), cmd("clip/set-property", { clipId: "title", transform: { y: 0.25 } }))),
    check: ({ doc }) => {
      expect(doc.settings.height).toBeGreaterThan(doc.settings.width);
      expect(clip(doc, "title")!.transform.y).toBeLessThan(0.4);
    },
  },
  {
    id: "mx-whoosh-and-wipe",
    category: "compound",
    prompt: "Add a wipe at 15 seconds with a whoosh sound on it.",
    solution: [
      { toolCalls: [call("add_transition", { kind: "wipe", nearSeconds: 15 }), call("search_audio", { query: "whoosh", kind: "sfx" })] },
      { toolCalls: [call("add_audio", { provider: "demo", id: "sfx-whoosh", atSeconds: 14.6 })] },
      "Done.",
    ],
    check: ({ doc, before }) => {
      expect(transitions(doc)).toMatchObject([{ kind: "wipe", toClipId: "v3" }]);
      const added = audioClips(doc).filter((c) => !before.clips[c.id]);
      expect(added).toHaveLength(1);
      near(added[0]!.startUs, 15, 0.8);
    },
  },
  {
    id: "mx-everything-text",
    category: "compound",
    prompt: "Make all the text white, 64px, and fade each one in.",
    setup: (p) => p.dispatch({ type: "clip/set-property", payload: { clipId: "credits", color: "#FF0000" } }),
    solution: plan(
      apply(cmd("clip/set-property", { clipId: "title", color: "#FFFFFF", fontSizePx: 64 }), cmd("clip/set-property", { clipId: "credits", color: "#FFFFFF", fontSizePx: 64 })),
      call("animate_clip", { clipId: "title", in: "fade" }),
      call("animate_clip", { clipId: "credits", in: "fade" }),
    ),
    check: ({ doc }) => {
      for (const t of textClips(doc)) {
        expect(t.color.toLowerCase()).toMatch(/^#(fff|ffffff)$/);
        expect(t.fontSizePx).toBe(64);
        expect(readAnimation(t).recipe.in?.preset).toBe("in:fade");
      }
    },
  },
];

/* ======================================================================
 * Robustness (the loop, not the model)
 * ==================================================================== */

const robustnessCases: EvalCase[] = [
  {
    id: "rb-recover-bad-command",
    category: "robustness",
    prompt: "Move the title to 3 seconds.",
    solution: [
      { toolCalls: [apply(cmd("clip/move", { clipId: "Title", startUs: 3 * S }))] },
      { toolCalls: [apply(cmd("clip/move", { clipId: "title", startUs: 3 * S }))] },
      "Moved the title to 3s.",
    ],
    check: ({ doc }) => near(clip(doc, "title")!.startUs, 3, 0.1),
  },
  {
    id: "rb-recover-bad-payload",
    category: "robustness",
    prompt: "Make the title 120px.",
    solution: [
      { toolCalls: [apply(cmd("clip/set-property", { clipId: "title", fontSizePx: "120px" }))] },
      { toolCalls: [apply(cmd("clip/set-property", { clipId: "title", fontSizePx: 120 }))] },
      "Done.",
    ],
    check: ({ doc }) => expect(clip<TextClip>(doc, "title")!.fontSizePx).toBe(120),
  },
  {
    id: "rb-batch-all-or-nothing",
    category: "robustness",
    prompt: "Delete the logo and the credits.",
    solution: [
      { toolCalls: [apply(cmd("clip/remove", { clipId: "logo1" }), cmd("clip/remove", { clipId: "credit" }))] },
      { toolCalls: [apply(cmd("clip/remove", { clipId: "logo1" }), cmd("clip/remove", { clipId: "credits" }))] },
      "Removed both.",
    ],
    check: ({ doc }) => {
      expect(clip(doc, "logo1")).toBeUndefined();
      expect(clip(doc, "credits")).toBeUndefined();
    },
  },
  {
    id: "rb-schema-lookup",
    category: "robustness",
    prompt: "Add a 1 second fade-in to the music.",
    solution: [
      { toolCalls: [call("get_command_schema", { type: "clip/set-property" })] },
      { toolCalls: [apply(cmd("clip/set-property", { clipId: "m1", fadeInUs: S }))] },
      "Done.",
    ],
    check: ({ doc }) => {
      const m = clip<AudioClip>(doc, "m1")!;
      expect((m.fadeInUs ?? 0) > 0 || (m.animations?.volume ?? []).length > 0).toBe(true);
    },
  },
  {
    id: "rb-state-reread",
    category: "robustness",
    prompt: "Split the first clip at 4 seconds, then delete the second half.",
    solution: [
      { toolCalls: [apply(cmd("clip/split", { clipId: "v1", atUs: 4 * S, newClipId: "v1-right" }))] },
      { toolCalls: [call("get_state")] },
      { toolCalls: [apply(cmd("clip/remove", { clipId: "v1-right" }))] },
      "Done.",
    ],
    check: ({ doc }) => {
      const first = clipsOn(doc, "video")[0]!;
      near(first.durationUs, 4, 0.1);
      expect(Object.values(doc.clips).some((c) => c.trackId === "video" && c.startUs >= 3.9 * S && c.startUs < 10 * S)).toBe(false);
    },
  },
  {
    id: "rb-unknown-tool",
    category: "robustness",
    prompt: "Make the title pop in.",
    solution: [
      { toolCalls: [call("animate", { clipId: "title", in: "pop" })] },
      { toolCalls: [call("animate_clip", { clipId: "title", in: "pop" })] },
      "Done.",
    ],
    check: ({ doc }) => expect(recipe(doc, "title").recipe.in?.preset).toBe("in:pop"),
  },
];


/* ======================================================================
 * Coverage: colors, backgrounds, size & position, typography
 * ==================================================================== */

const rgb = (hex: string) => {
  const h = hex.replace("#", "").toLowerCase();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
};
const htmlClips = (doc: ProjectDocument) => Object.values(doc.clips).filter((c) => c.kind === "html") as (Clip & { template: string; params: Record<string, unknown> })[];
const kf = (doc: ProjectDocument, id: string, prop: string) => (clip(doc, id)?.animations as Record<string, { timeUs: number; value: number; anchor?: string }[]> | undefined)?.[prop] ?? [];
/** A full-frame colored html clip, the editor's way to make a solid background. */
const BG_TEMPLATE = '<div style="width:100%;height:100%;background:{{color}}"></div>';
const withBackground = (p: Project) => {
  p.dispatch({ type: "track/add", payload: { id: "bg", kind: "video", name: "Background", index: 1 } });
  p.dispatch({ type: "clip/add", payload: { kind: "html", id: "bg1", trackId: "bg", startUs: 0, durationUs: 28 * S, template: BG_TEMPLATE, params: { color: "#1E3A8A" } } });
};
const withTransitions = (p: Project) => {
  for (const c of findCuts(p.getState().doc)) p.dispatch({ type: "transition/add", payload: { id: `t-${c.toClipId}`, kind: "wipe", fromClipId: c.fromClipId, toClipId: c.toClipId, durationUs: 500_000, params: { direction: "left" } } });
};

const lookCases: EvalCase[] = [
  {
    id: "co-title-hex",
    category: "colors",
    prompt: "Set the title color to #3366FF.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "title", color: "#3366FF" }))),
    check: ({ doc }) => expect(clip<TextClip>(doc, "title")!.color.toLowerCase()).toBe("#3366ff"),
  },
  {
    id: "co-match-colors",
    category: "colors",
    prompt: "Make the credits the same color as the title.",
    setup: (p) => p.dispatch({ type: "clip/set-property", payload: { clipId: "title", color: "#F97316" } }),
    solution: plan(apply(cmd("clip/set-property", { clipId: "credits", color: "#F97316" }))),
    check: ({ doc }) => expect(clip<TextClip>(doc, "credits")!.color.toLowerCase()).toBe(clip<TextClip>(doc, "title")!.color.toLowerCase()),
  },
  {
    id: "co-all-text-black",
    category: "colors",
    prompt: "Change all text to black.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "title", color: "#000000" }), cmd("clip/set-property", { clipId: "credits", color: "#000000" }))),
    check: ({ doc }) => {
      for (const t of textClips(doc)) expect(Math.max(...rgb(t.color))).toBeLessThan(40);
    },
  },
  {
    id: "co-caption-text-color",
    category: "colors",
    prompt: "Make the caption text light blue.",
    setup: (p) => {
      p.dispatch({ type: "track/add", payload: { id: "captions", kind: "video", name: "Captions" } });
      p.dispatch({ type: "clip/add", payload: { kind: "caption", id: "cap1", trackId: "captions", startUs: 6 * S, durationUs: 2 * S, words: [{ text: "Blue", startUs: 0, durationUs: S }, { text: "sky", startUs: S, durationUs: S }] } });
    },
    solution: plan(apply(cmd("clip/set-property", { clipId: "cap1", style: { color: "#7DD3FC" } }))),
    check: ({ doc }) => {
      const [r, g, b] = rgb(captions(doc)[0]!.style.color);
      expect(b).toBeGreaterThan(180);
      expect(b).toBeGreaterThan(r);
      expect(g).toBeGreaterThan(120);
    },
  },
  {
    id: "bg-add-solid",
    category: "background",
    prompt: "Put a solid dark blue background behind everything for the whole video.",
    solution: plan(call("set_background", { color: "#1E3A8A" })),
    check: ({ doc }) => {
      const bg = htmlClips(doc)[0]!;
      expect(bg).toBeDefined();
      expect(bg.startUs).toBeLessThanOrEqual(0.2 * S);
      expect(bg.startUs + bg.durationUs).toBeGreaterThanOrEqual(27.8 * S);
      // Behind the footage: its track is below the video track.
      expect(doc.trackOrder.indexOf(bg.trackId)).toBeLessThan(doc.trackOrder.indexOf("video"));
      expect(`${bg.template} ${JSON.stringify(bg.params)}`.toLowerCase()).toMatch(/#1e3a8a|#0|navy|blue|rgb\(/);
    },
  },
  {
    id: "bg-recolor",
    category: "background",
    prompt: "Change the background color to deep red.",
    setup: withBackground,
    solution: plan(apply(cmd("clip/set-property", { clipId: "bg1", params: { color: "#991B1B" } }))),
    check: ({ doc }) => {
      const bg = htmlClips(doc)[0]!;
      const color = String(bg.params.color ?? "");
      const [r, g, b] = rgb(color.startsWith("#") ? color : "#000000");
      expect(r).toBeGreaterThan(100);
      expect(g + b).toBeLessThan(r);
    },
  },
  {
    id: "bg-remove",
    category: "background",
    prompt: "Remove the background.",
    setup: withBackground,
    solution: plan(apply(cmd("clip/remove", { clipId: "bg1" }))),
    check: ({ doc }) => {
      expect(htmlClips(doc)).toHaveLength(0);
      expect(clipsOn(doc, "video")).toHaveLength(4);
    },
  },
  {
    id: "bg-caption-box",
    category: "background",
    prompt: "Put a black box behind the caption so it's easier to read.",
    setup: (p) => {
      p.dispatch({ type: "track/add", payload: { id: "captions", kind: "video", name: "Captions" } });
      p.dispatch({ type: "clip/add", payload: { kind: "caption", id: "cap1", trackId: "captions", startUs: 6 * S, durationUs: 2 * S, words: [{ text: "Read", startUs: 0, durationUs: S }, { text: "me", startUs: S, durationUs: S }] } });
    },
    solution: plan(apply(cmd("clip/set-property", { clipId: "cap1", style: { backgroundColor: "#000000B3" } }))),
    check: ({ doc }) => {
      const bg = captions(doc)[0]!.style.backgroundColor;
      expect(bg).toBeDefined();
      expect(Math.max(...rgb(bg!))).toBeLessThan(60);
    },
  },
  {
    id: "ps-logo-bottom-right",
    category: "position",
    prompt: "Move the logo to the bottom-right corner.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "logo1", transform: { x: 0.9, y: 0.88 } }))),
    check: ({ doc }) => {
      const t = clip(doc, "logo1")!.transform;
      expect(t.x).toBeGreaterThan(0.7);
      expect(t.y).toBeGreaterThan(0.7);
    },
  },
  {
    id: "ps-title-up-a-bit",
    category: "position",
    prompt: "Move the title up a little.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "title", transform: { y: 0.15 } }))),
    check: ({ doc }) => {
      const y = clip(doc, "title")!.transform.y;
      expect(y).toBeLessThan(0.2);
      expect(y).toBeGreaterThan(0.02);
      expect(clip(doc, "title")!.transform.x).toBe(0.5);
    },
  },
  {
    id: "ps-center-logo",
    category: "position",
    prompt: "Center the logo on screen.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "logo1", transform: { x: 0.5, y: 0.5 } }))),
    check: ({ doc }) => {
      const t = clip(doc, "logo1")!.transform;
      expect(Math.abs(t.x - 0.5)).toBeLessThan(0.05);
      expect(Math.abs(t.y - 0.5)).toBeLessThan(0.05);
    },
  },
  {
    id: "sz-pip",
    category: "size",
    prompt: "Make the second clip a small picture-in-picture in the top-right corner.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "v2", transform: { scale: 0.35, x: 0.78, y: 0.22 } }))),
    check: ({ doc }) => {
      const t = clip(doc, "v2")!.transform;
      expect(t.scale).toBeLessThan(0.6);
      expect(t.x).toBeGreaterThan(0.6);
      expect(t.y).toBeLessThan(0.4);
    },
  },
  {
    id: "sz-same-as-credits",
    category: "size",
    prompt: "Make the title the same size as the credits.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "title", fontSizePx: 48 }))),
    check: ({ doc }) => expect(shownSize(clip<TextClip>(doc, "title")!)).toBeCloseTo(shownSize(clip<TextClip>(doc, "credits")!), 0),
  },
  {
    id: "sz-zoom-crop",
    category: "size",
    prompt: "Zoom into the first clip by 20% to crop the edges.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "v1", transform: { scale: 1.2 } }))),
    check: ({ doc }) => expect(clip(doc, "v1")!.transform.scale).toBeCloseTo(1.2, 1),
  },
  {
    id: "ty-italic",
    category: "typography",
    prompt: "Make the credits italic.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "credits", fontStyle: "italic" }))),
    check: ({ doc }) => expect((clip(doc, "credits") as TextClip & { fontStyle?: string }).fontStyle).toBe("italic"),
  },
  {
    id: "ty-letter-spacing",
    category: "typography",
    prompt: "Space out the letters of the title a bit more.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "title", letterSpacing: 0.1 }))),
    check: ({ doc }) => expect(Number((clip(doc, "title") as TextClip & { letterSpacing?: number }).letterSpacing ?? 0)).toBeGreaterThan(0),
  },
  {
    id: "ty-light-weight",
    category: "typography",
    prompt: "Use a light font weight for the title.",
    solution: plan(apply(cmd("clip/set-property", { clipId: "title", fontWeight: 300 }))),
    check: ({ doc }) => expect(Number(clip<TextClip>(doc, "title")!.fontWeight ?? 400)).toBeLessThan(400),
  },
  {
    id: "ty-two-lines",
    category: "typography",
    prompt: 'Put the title on two lines: "Big Buck" and "Bunny", centered, with tighter line spacing.',
    solution: plan(apply(cmd("clip/set-property", { clipId: "title", text: "Big Buck\nBunny", textAlign: "center", lineHeight: 1 }))),
    check: ({ doc }) => {
      const t = clip(doc, "title") as TextClip & { lineHeight?: number };
      expect(t.text).toMatch(/Big Buck\s*\n\s*Bunny/);
      expect(t.textAlign).toBe("center");
      expect(Number(t.lineHeight ?? 1.2)).toBeLessThan(1.2);
    },
  },
  {
    id: "ty-caption-uppercase-outline",
    category: "typography",
    prompt: "Make the caption all caps with a black outline.",
    setup: (p) => {
      p.dispatch({ type: "track/add", payload: { id: "captions", kind: "video", name: "Captions" } });
      p.dispatch({ type: "clip/add", payload: { kind: "caption", id: "cap1", trackId: "captions", startUs: 6 * S, durationUs: 2 * S, words: [{ text: "Loud", startUs: 0, durationUs: S }, { text: "words", startUs: S, durationUs: S }] } });
    },
    solution: plan(apply(cmd("clip/set-property", { clipId: "cap1", style: { textTransform: "uppercase", strokeColor: "#000000" } }))),
    check: ({ doc }) => {
      const st = captions(doc)[0]!.style;
      const caps = st.textTransform === "uppercase" || captions(doc)[0]!.words.every((w) => w.text === w.text.toUpperCase());
      expect(caps).toBe(true);
      expect(Math.max(...rgb(st.strokeColor ?? "#ffffff"))).toBeLessThan(60);
    },
  },
];

/* ======================================================================
 * Coverage: assets
 * ==================================================================== */

const assetCases: EvalCase[] = [
  {
    id: "as-logo-again",
    category: "assets",
    prompt: "Show the logo again from 20 to 24 seconds.",
    solution: plan(apply(cmd("clip/add", { kind: "image", id: "logo2", trackId: "overlay", assetId: "logo", startUs: 20 * S, durationUs: 4 * S, transform: { x: 0.9, y: 0.12, scale: 0.3 } }))),
    check: ({ doc }) => {
      const logos = Object.values(doc.clips).filter((c) => "assetId" in c && c.assetId === "logo");
      expect(logos).toHaveLength(2);
      const second = logos.find((c) => c.id !== "logo1")!;
      near(second.startUs, 20, 0.3);
      near(second.startUs + second.durationUs, 24, 0.3);
      expect(Object.keys(doc.assets)).toHaveLength(3); // reused, not re-imported
    },
  },
  {
    id: "as-more-footage",
    category: "assets",
    prompt: "Add 5 more seconds of the film at the end, starting from 40 seconds into the source.",
    solution: plan(apply(cmd("clip/add", { kind: "video", id: "v5", trackId: "video", assetId: "film", startUs: 28 * S, durationUs: 5 * S, trimStartUs: 40 * S }))),
    check: ({ doc }) => {
      const v = clipsOn(doc, "video").at(-1) as VideoClip;
      expect(clipsOn(doc, "video")).toHaveLength(5);
      near(v.startUs, 28, 0.2);
      near(v.durationUs, 5, 0.2);
      near(v.trimStartUs, 40, 0.2);
    },
  },
  {
    id: "as-rename",
    category: "assets",
    prompt: 'Rename the music file to "Theme Song".',
    solution: plan(apply(cmd("asset/set-property", { id: "song", name: "Theme Song" }))),
    check: ({ doc }) => expect(doc.assets.song!.name).toBe("Theme Song"),
  },
  {
    id: "as-remove-unused",
    category: "assets",
    prompt: "Clean up any media that isn't used in the timeline.",
    setup: (p) => p.dispatch({ type: "asset/add", payload: { id: "outtake", kind: "video", src: "/media/outtake.mp4", durationUs: 20 * S, name: "Outtake" } }),
    solution: plan(apply(cmd("asset/remove", { id: "outtake" }))),
    check: ({ doc }) => {
      expect(doc.assets.outtake).toBeUndefined();
      expect(Object.keys(doc.assets).sort()).toEqual(["film", "logo", "song"]);
    },
  },
  {
    id: "as-credit",
    category: "assets",
    prompt: 'Record the music\'s credit as "Sunny Steps by Miraiclip, CC0".',
    solution: plan(apply(cmd("asset/set-property", { id: "song", attribution: "Sunny Steps by Miraiclip, CC0" }))),
    check: ({ doc }) => expect(doc.assets.song!.attribution).toMatch(/sunny steps/i),
  },
  {
    id: "as-license-question",
    category: "assets",
    noEdit: true,
    prompt: "Can I use the music commercially?",
    setup: (p) => p.dispatch({ type: "asset/set-property", payload: { id: "song", license: { id: "CC-BY-NC-4.0", commercial: false, attributionRequired: true } } }),
    solution: answer("No: the music is CC BY-NC 4.0, which doesn't allow commercial use. You'd need a different track or a commercial license."),
    check: (c) => {
      unchanged(c);
      expect(c.turn.reply).toMatch(/\b(no|not|non-commercial|noncommercial)\b/i);
    },
  },
];

/* ======================================================================
 * Coverage: more clip and track operations
 * ==================================================================== */

const moreClipCases: EvalCase[] = [
  {
    id: "cl-title-to-overlay",
    category: "clips",
    prompt: "Move the title onto the overlay track.",
    solution: plan(apply(cmd("clip/move", { clipId: "title", trackId: "overlay" }))),
    check: ({ doc }) => {
      expect(clip(doc, "title")!.trackId).toBe("overlay");
      near(clip(doc, "title")!.startUs, 0.5, 0.05);
    },
  },
  {
    id: "cl-delete-all-text",
    category: "clips",
    prompt: "Delete all the text.",
    solution: plan(apply(cmd("clip/remove", { clipId: "title" }), cmd("clip/remove", { clipId: "credits" }))),
    check: ({ doc }) => {
      expect(textClips(doc)).toHaveLength(0);
      expect(videoClips(doc)).toHaveLength(4);
    },
  },
  {
    id: "cl-split-title",
    category: "clips",
    prompt: "Split the title at 2.5 seconds.",
    solution: plan(apply(cmd("clip/split", { clipId: "title", atUs: 2.5 * S }))),
    check: ({ doc }) => {
      const parts = textClips(doc).filter((t) => t.text === BUNNY);
      expect(parts).toHaveLength(2);
      expect(parts.some((t) => Math.abs(t.startUs - 2.5 * S) < 0.05 * S)).toBe(true);
    },
  },
  {
    id: "cl-duplicate-logo-end",
    category: "clips",
    prompt: "Copy the logo so it also appears over the last clip.",
    solution: plan(apply(cmd("clip/duplicate", { clipId: "logo1", newClipId: "logo-end", startUs: 20 * S }))),
    check: ({ doc }) => {
      const logos = Object.values(doc.clips).filter((c) => c.kind === "image");
      expect(logos).toHaveLength(2);
      expect(logos.some((c) => overlap(c, 20, 28))).toBe(true);
    },
  },
  {
    id: "tk-new-top-track",
    category: "tracks",
    prompt: 'Add a new video track on top called "Stickers".',
    solution: plan(apply(cmd("track/add", { id: "stickers", kind: "video", name: "Stickers" }))),
    check: ({ doc }) => {
      const top = doc.tracks[doc.trackOrder.at(-1)!]!;
      expect(top.name).toBe("Stickers");
      expect(top.kind).toBe("video");
    },
  },
  {
    id: "tk-unlock",
    category: "tracks",
    prompt: "Unlock the video track.",
    setup: (p) => p.dispatch({ type: "track/set-property", payload: { trackId: "video", locked: true } }),
    solution: plan(apply(cmd("track/set-property", { trackId: "video", locked: false }))),
    check: ({ doc }) => expect(doc.tracks.video!.locked).toBe(false),
  },
];

/* ======================================================================
 * Coverage: keyframes (custom motion, beyond presets)
 * ==================================================================== */

const keyframeCases: EvalCase[] = [
  {
    id: "kf-logo-across",
    category: "keyframes",
    prompt: "Move the logo from the left edge to the right edge over the time it's on screen.",
    solution: plan(
      apply(
        cmd("keyframe/set", { clipId: "logo1", property: "x", timeUs: 0, value: 0.1 }),
        cmd("keyframe/set", { clipId: "logo1", property: "x", timeUs: 4 * S, value: 0.9 }),
      ),
    ),
    check: ({ doc }) => {
      const xs = [...kf(doc, "logo1", "x")].sort((a, b) => a.timeUs - b.timeUs);
      expect(xs.length).toBeGreaterThanOrEqual(2);
      expect(xs[0]!.value).toBeLessThan(0.35);
      expect(xs.at(-1)!.value).toBeGreaterThan(0.65);
    },
  },
  {
    id: "kf-title-grow",
    category: "keyframes",
    prompt: "Have the title slowly grow from normal size to 1.5× over its duration.",
    solution: plan(
      apply(
        cmd("keyframe/set", { clipId: "title", property: "scale", timeUs: 0, value: 1 }),
        cmd("keyframe/set", { clipId: "title", property: "scale", timeUs: 4 * S, value: 1.5 }),
      ),
    ),
    check: ({ doc }) => {
      const k = [...kf(doc, "title", "scale")].sort((a, b) => a.timeUs - b.timeUs);
      expect(k[0]!.value).toBeCloseTo(1, 1);
      expect(k.at(-1)!.value).toBeCloseTo(1.5, 1);
    },
  },
  {
    id: "kf-logo-full-turn",
    category: "keyframes",
    prompt: "Rotate the logo one full turn while it's visible.",
    solution: plan(call("set_keyframes", { clipId: "logo1", property: "rotation", points: [{ atSeconds: 5, value: 0 }, { atSeconds: 9, value: 360 }] })),
    check: ({ doc }) => {
      const k = kf(doc, "logo1", "rotation").map((x) => x.value);
      expect(Math.max(...k) - Math.min(...k)).toBeGreaterThanOrEqual(350);
    },
  },
  {
    id: "kf-duck-music",
    category: "keyframes",
    prompt: "Duck the music to 20% between 10 and 15 seconds, then bring it back.",
    solution: plan(
      call("set_keyframes", {
        clipId: "m1",
        property: "volume",
        points: [{ atSeconds: 9.5, value: 0.8 }, { atSeconds: 10, value: 0.2 }, { atSeconds: 15, value: 0.2 }, { atSeconds: 15.5, value: 0.8 }],
      }),
    ),
    check: ({ doc }) => {
      const k = [...kf(doc, "m1", "volume")].sort((a, b) => a.timeUs - b.timeUs);
      const at = (s: number) => {
        // value of the keyframe in effect at clip time s (step approximation is enough here)
        let v = clip<AudioClip>(doc, "m1")!.volume;
        for (const x of k) if (x.timeUs <= s * S + 1) v = x.value;
        return v;
      };
      expect(at(12.5)).toBeLessThan(0.35);
      expect(at(5)).toBeGreaterThan(0.5);
      expect(at(20)).toBeGreaterThan(0.5);
    },
  },
  {
    id: "kf-music-out-at-20",
    category: "keyframes",
    prompt: "Fade the music down to silence between 18 and 20 seconds.",
    solution: plan(
      apply(
        cmd("keyframe/set", { clipId: "m1", property: "volume", timeUs: 18 * S, value: 0.8 }),
        cmd("keyframe/set", { clipId: "m1", property: "volume", timeUs: 20 * S, value: 0 }),
      ),
    ),
    check: ({ doc }) => {
      const m = clip<AudioClip>(doc, "m1")!;
      const end = m.startUs + m.durationUs;
      // Either keyframes (volume as heard at each time) or a trim to 20 s with a fade-out.
      const at = (s: number) => evaluateKeyframes(m.animations?.volume ?? [], s * S - m.startUs, m.volume, m.durationUs);
      const trimmed = end <= 20.2 * S && end >= 19.5 * S && (m.fadeOutUs ?? 0) >= 1.5 * S;
      const keyed = at(17.5) > 0.5 && at(19) > 0.05 && at(19) < at(17.5) && at(20.3) < 0.02 && at(25) < 0.02;
      expect(trimmed || keyed).toBe(true);
    },
  },
  {
    id: "kf-remove-opacity",
    category: "keyframes",
    prompt: "Remove the opacity animation from the title but keep its scale animation.",
    setup: (p) => {
      for (const [prop, t, v] of [["opacity", 0, 0], ["opacity", 500_000, 1], ["scale", 0, 0.8], ["scale", 500_000, 1]] as const)
        p.dispatch({ type: "keyframe/set", payload: { clipId: "title", property: prop, timeUs: t, value: v } });
    },
    solution: plan(apply(cmd("keyframe/clear", { clipId: "title", property: "opacity" }))),
    check: ({ doc }) => {
      expect(kf(doc, "title", "opacity")).toHaveLength(0);
      expect(kf(doc, "title", "scale")).toHaveLength(2);
    },
  },
  {
    id: "kf-remove-one",
    category: "keyframes",
    prompt: "Delete the logo's x keyframe at 2 seconds.",
    setup: (p) => {
      for (const [t, v] of [[0, 0.1], [2 * S, 0.5], [4 * S, 0.9]] as const) p.dispatch({ type: "keyframe/set", payload: { clipId: "logo1", property: "x", timeUs: t, value: v } });
    },
    solution: plan(apply(cmd("keyframe/remove", { clipId: "logo1", property: "x", timeUs: 2 * S }))),
    check: ({ doc }) => expect(kf(doc, "logo1", "x").map((k) => k.timeUs)).toEqual([0, 4 * S]),
  },
  {
    id: "kf-blink",
    category: "keyframes",
    prompt: "Make the credits blink: fully visible, invisible, visible again, once per second.",
    solution: plan(apply(...[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((t, i) => cmd("keyframe/set", { clipId: "credits", property: "opacity", timeUs: Math.round(t * S), value: i % 2 ? 0 : 1, easing: "hold" })))),
    check: ({ doc }) => {
      const k = kf(doc, "credits", "opacity");
      expect(k.filter((x) => x.value < 0.2).length).toBeGreaterThanOrEqual(2);
      expect(k.filter((x) => x.value > 0.8).length).toBeGreaterThanOrEqual(2);
    },
  },
];

/* ======================================================================
 * Coverage: effect editing, transition editing, remaining presets
 * ==================================================================== */

const editingCases: EvalCase[] = [
  {
    id: "fx-stronger-blur",
    category: "effects",
    prompt: "Make the blur on the first clip stronger.",
    setup: (p) => p.dispatch({ type: "effect/add", payload: { clipId: "v1", kind: "blur", effectId: "fx-blur", params: { amount: 0.02 } } }),
    solution: plan(apply(cmd("effect/update", { clipId: "v1", effectId: "fx-blur", params: { amount: 0.05 } }))),
    check: ({ doc }) => {
      const blur = (clip(doc, "v1")!.effects ?? []).filter((e) => e.kind === "blur");
      expect(blur.length).toBeGreaterThanOrEqual(1);
      expect(Math.max(...blur.map((e) => Number(e.params.amount)))).toBeGreaterThan(0.02);
    },
  },
  {
    id: "fx-disable",
    category: "effects",
    prompt: "Turn off the sepia on the second clip for now, but don't delete it.",
    setup: (p) => p.dispatch({ type: "effect/add", payload: { clipId: "v2", kind: "sepia", effectId: "fx-sepia" } }),
    solution: plan(call("set_effects_enabled", { clipIds: ["v2"], kind: "sepia", enabled: false })),
    check: ({ doc }) => expect(clip(doc, "v2")!.effects).toMatchObject([{ kind: "sepia", enabled: false }]),
  },
  {
    id: "fx-reorder",
    category: "effects",
    prompt: "On the first clip, apply the black and white before the vignette.",
    setup: (p) => {
      p.dispatch({ type: "effect/add", payload: { clipId: "v1", kind: "vignette", effectId: "fx-vig" } });
      p.dispatch({ type: "effect/add", payload: { clipId: "v1", kind: "mono", effectId: "fx-mono" } });
    },
    solution: plan(apply(cmd("effect/reorder", { clipId: "v1", effectId: "fx-mono", index: 0 }))),
    check: ({ doc }) => expect((clip(doc, "v1")!.effects ?? []).map((e) => e.kind)).toEqual(["mono", "vignette"]),
  },
  {
    id: "fx-green-screen",
    category: "effects",
    prompt: "The last clip was shot on a green screen; key out the green.",
    solution: plan(call("add_effect", { clipIds: ["v4"], kind: "chromaKey" })),
    check: ({ doc }) => hasEffect(doc, "v4", "chromaKey"),
  },
  {
    id: "fx-warm",
    category: "effects",
    prompt: "Warm up the colors of the first two clips.",
    solution: plan(call("add_effect", { clipIds: ["v1", "v2"], kind: "warm" })),
    check: ({ doc }) => {
      for (const id of ["v1", "v2"]) {
        const fx = clip(doc, id)!.effects ?? [];
        expect(fx.some((e) => ["warm", "goldenHour", "tealOrange"].includes(e.kind) || (e.kind === "colorAdjust" && Number(e.params.hue) !== 0))).toBe(true);
      }
    },
  },
  {
    id: "tr-change-one-duration",
    category: "transitions",
    prompt: "Make the transition at 15 seconds last a full second; leave the others.",
    setup: withTransitions,
    solution: plan(apply(cmd("transition/update", { transitionId: "t-v3", durationUs: S }))),
    check: ({ doc }) => {
      near(doc.transitions["t-v3"]?.durationUs ?? transitions(doc).find((t) => t.toClipId === "v3")!.durationUs, 1, 0.1);
      expect(transitions(doc).filter((t) => t.toClipId !== "v3").every((t) => t.durationUs === 500_000)).toBe(true);
    },
  },
  {
    id: "tr-change-direction",
    category: "transitions",
    prompt: "Make the wipes go right instead of left.",
    setup: withTransitions,
    solution: plan(call("add_transition", { kind: "wipe", allCuts: true, direction: "right", durationSeconds: 0.5 })),
    check: ({ doc }) => {
      expect(transitions(doc)).toHaveLength(3);
      for (const t of transitions(doc)) expect(t).toMatchObject({ kind: "wipe", params: { direction: "right" } });
    },
  },
  ...(
    [
      ["an-out-spin", "Spin the logo out at the end.", "logo1", "out", "spin"],
      ["an-out-pop", "Pop the title out when it leaves.", "title", "out", "pop"],
      ["an-in-right", "Slide the credits in moving to the right.", "credits", "in", "right"],
      ["an-out-left", "Slide the title out to the left.", "title", "out", "left"],
      ["an-in-down", "Drop the title in from above.", "title", "in", "down"],
      ["an-out-up", "Have the credits float up and away at the end.", "credits", "out", "up"],
      ["an-out-right", "Slide the logo off to the right at the end.", "logo1", "out", "right"],
    ] as const
  ).map(
    ([id, prompt, clipId, slot, preset]): EvalCase => ({
      id,
      category: "animation",
      prompt,
      solution: plan(call("animate_clip", { clipId, [slot]: preset })),
      check: ({ doc }) => expect(recipe(doc, clipId).recipe[slot]?.preset).toBe(`${slot}:${preset}`),
    }),
  ),
];

export const CASES: EvalCase[] = [
  ...transitionCases,
  ...animationCases,
  ...textCases,
  ...clipCases,
  ...trackCases,
  ...effectCases,
  ...audioCases,
  ...captionCases,
  ...projectCases,
  ...questionCases,
  ...compoundCases,
  ...lookCases,
  ...assetCases,
  ...moreClipCases,
  ...keyframeCases,
  ...editingCases,
  ...robustnessCases,
];

/** Live evals skip robustness: those script deliberate model mistakes. */
export const LIVE_CASES = CASES.filter((c) => c.category !== "robustness");
