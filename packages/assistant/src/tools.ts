import {
  ANIMATION_EASINGS,
  ANIMATION_PRESETS,
  animationCommands,
  applyCommands,
  commandCatalog,
  builtinTransitionParamSchemas,
  describeAnimation,
  EFFECT_CATALOG,
  findCuts,
  fitAnimation,
  readAnimation,
  toToolDefinitions,
  tryDispatch,
  type AnimationEasing,
  type AnimationRecipe,
  type AnimationSlot,
  type Command,
  type Cut,
  type Project,
} from "@miraiclip/core";
import { describeForAssistant, describeKeyframes, htmlPlaceholders, readClipAnimation } from "./state.js";
import { unknownFields } from "./strict.js";
import type { ToolSpec } from "./types.js";

/** What a tool's `run` gets. `project` is the turn's working copy. */
export interface ToolContext {
  project: Project;
  signal?: AbortSignal;
}

/** A tool's answer. `changes` are human-readable lines for the app's "what changed" list. */
export type ToolOutput =
  | { ok: true; result?: unknown; changes?: string[] }
  | { ok: false; error: unknown };

export interface AssistantTool extends ToolSpec {
  run(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> | ToolOutput;
}

export function defineTool(tool: AssistantTool): AssistantTool {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name)) throw new Error(`Tool name must match ^[a-zA-Z0-9_-]{1,64}$ (got "${tool.name}")`);
  return tool;
}

/**
 * Adopt tools that come as definitions plus one runner — e.g.
 * `@miraiclip/audio-sources`' `audioToolDefinitions` + `runAudioTool`.
 * Accepts `{ name, description, input_schema }` or OpenAI function tools.
 */
export function toolsFromDefinitions(
  definitions: readonly unknown[],
  run: (name: string, input: Record<string, unknown>, ctx: ToolContext) => Promise<{ ok: boolean; result?: unknown; error?: unknown }>,
  options: { changes?: (name: string, input: Record<string, unknown>, result: unknown) => string[] | undefined } = {},
): AssistantTool[] {
  return definitions.map((d) => {
    const def = d as { name?: string; description?: string; input_schema?: Record<string, unknown>; function?: { name: string; description?: string; parameters?: Record<string, unknown> } };
    const name = def.function?.name ?? def.name!;
    return defineTool({
      name,
      description: def.function?.description ?? def.description ?? "",
      inputSchema: def.function?.parameters ?? def.input_schema ?? { type: "object", properties: {} },
      async run(input, ctx) {
        const out = await run(name, input, ctx);
        if (!out.ok) return { ok: false, error: out.error ?? "failed" };
        const changes = options.changes?.(name, input, out.result);
        return { ok: true, result: out.result, ...(changes?.length ? { changes } : {}) };
      },
    });
  });
}

const S = 1_000_000;
/** Slide presets are named by motion; models do better naming the edge, so these map edges to presets. */
const SLIDE_IN: Record<string, string> = { "from-right": "left", "from-left": "right", "from-bottom": "up", "from-top": "down" };
const SLIDE_OUT: Record<string, string> = { "to-left": "left", "to-right": "right", "to-top": "up", "to-bottom": "down" };
function slideAliases(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof input.in === "string" && SLIDE_IN[input.in]) out.in = SLIDE_IN[input.in];
  if (typeof input.out === "string" && SLIDE_OUT[input.out]) out.out = SLIDE_OUT[input.out];
  return out;
}
/** The html template set_background uses: one `{{color}}` fill. */
export const BACKGROUND_TEMPLATE = '<div style="width:100%;height:100%;background:{{color}}"></div>';
const seconds = (us: number) => `${Math.round(us / 100_000) / 10}s`;
const n3 = (v: number) => Number(v.toFixed(3));
const toUs = (s: unknown) => (typeof s === "number" && Number.isFinite(s) ? Math.round(s * S) : undefined);

/* ---------- describing commands for people ---------- */

const PHRASES: Record<string, (p: Record<string, unknown>) => string> = {
  "clip/add": (p) =>
    p.kind === "text" ? `Added text "${String(p.text ?? "").slice(0, 40)}" at ${seconds(Number(p.startUs))}` : `Added a ${p.kind} clip at ${seconds(Number(p.startUs))}`,
  "clip/remove": (p) => `Removed clip ${p.clipId}`,
  "clip/move": (p) => `Moved clip ${p.clipId}${p.startUs !== undefined ? ` to ${seconds(Number(p.startUs))}` : ""}`,
  "clip/trim": (p) => `Trimmed clip ${p.clipId}`,
  "clip/split": (p) => `Split clip ${p.clipId} at ${seconds(Number(p.atUs))}`,
  "clip/duplicate": (p) => `Duplicated clip ${p.clipId}`,
  "clip/set-property": (p) => `Changed ${Object.keys(p).filter((k) => k !== "clipId").join(", ")} of clip ${p.clipId}`,
  "track/add": (p) => `Added a ${p.kind} track`,
  "track/remove": (p) => `Removed track ${p.id}`,
  "track/set-property": (p) => `Changed track ${p.trackId}: ${Object.keys(p).filter((k) => k !== "trackId").join(", ")}`,
  "effect/add": (p) => `Added ${p.kind} to clip ${p.clipId}`,
  "effect/update": (p) => `Adjusted an effect on clip ${p.clipId}`,
  "effect/remove": (p) => `Removed an effect from clip ${p.clipId}`,
  "transition/add": (p) => `Added a ${p.kind} transition`,
  "transition/remove": () => "Removed a transition",
  "project/set-settings": () => "Changed the project settings",
};

/** One line per command, for a "what changed" list (keyframe edits fold into one line per clip). */
export function describeCommands(commands: readonly Command[]): string[] {
  const lines: string[] = [];
  const keyframed = new Set<string>();
  for (const c of commands) {
    const p = (c.payload ?? {}) as Record<string, unknown>;
    if (c.type.startsWith("keyframe/")) {
      const id = String(p.clipId);
      if (!keyframed.has(id)) lines.push(`Changed the animation of clip ${id}`);
      keyframed.add(id);
      continue;
    }
    const phrase = PHRASES[c.type];
    lines.push(phrase ? phrase(p) : `${c.type}`);
  }
  return lines;
}

/* ---------- the editor tools ---------- */

const US_NOTE = "Times in commands are integer MICROSECONDS (1 s = 1000000).";

export interface EditorToolsOptions {
  /** Transition kinds to offer (default: the built-ins). Add your registered custom kinds. */
  transitionKinds?: string[];
  /** The command catalog to offer in apply_commands (default: the built-ins). Pass `project.commandCatalog()` when you register custom commands. */
  commandCatalog?: Record<string, unknown>;
}

/**
 * The tools that edit a Miraiclip project: read state, look up a command's
 * schema, apply command batches, and two high-level tools (transitions,
 * animation presets) that use the same logic as the editor's panels.
 */
export function editorTools(options: EditorToolsOptions = {}): AssistantTool[] {
  const transitionKinds = options.transitionKinds ?? Object.keys(builtinTransitionParamSchemas);
  const presetIds = (slot: AnimationSlot) => ANIMATION_PRESETS.filter((p) => p.slot === slot).map((p) => p.id.split(":")[1]!);

  return [
    defineTool({
      name: "get_state",
      description: `The project as it is now (after your edits so far): settings, assets, tracks with clips (ids, kinds, time ranges), transitions, and each clip's position, size, opacity, text style, volume, effects and animation. ${US_NOTE}`,
      inputSchema: {
        type: "object",
        properties: { includeJson: { type: "boolean", description: "Also return the full document JSON (verbose; only for exact field values)." } },
        additionalProperties: false,
      },
      run(input, { project }) {
        const summary = describeForAssistant(project.toJSON());
        return { ok: true, result: input.includeJson ? { summary, document: project.toJSON() } : summary };
      },
    }),

    defineTool({
      name: "get_command_schema",
      description: "The JSON Schema of one editing command's payload. Look it up before using a command in apply_commands for the first time.",
      inputSchema: {
        type: "object",
        properties: { type: { type: "string", description: 'Command type, e.g. "clip/add".' } },
        required: ["type"],
        additionalProperties: false,
      },
      run(input, { project }) {
        const catalog = project.commandCatalog();
        const schema = catalog[String(input.type)];
        return schema ? { ok: true, result: schema } : { ok: false, error: { error: `unknown command "${input.type}"`, validTypes: Object.keys(catalog).sort() } };
      },
    }),

    defineTool({
      name: "apply_commands",
      description:
        "Apply editing commands as one all-or-nothing batch. On failure nothing changes and the error names the failing index and why (invalid payload issues, or the engine's rejection reason) — fix it and retry. " +
        `Give new clips, tracks and assets your own readable ids. ${US_NOTE}`,
      inputSchema: applyCommandsSchema(options.commandCatalog ?? commandCatalog()),
      run(input, { project }) {
        const commands = input.commands as Command[] | undefined;
        if (!Array.isArray(commands) || commands.length === 0) return { ok: false, error: "commands must be a non-empty array of { type, payload }" };
        return applyChecked(project, commands);
      },
    }),

    defineTool({
      name: "add_transition",
      description:
        "Add (or replace, or remove) a transition on cuts — where one clip ends exactly where the next starts on the same video track. Pick the cut by its two clip ids, by a time near it, or all cuts. " +
        "A transition overlaps both clips around the cut, so its length is capped by the spare footage there; cuts with none are skipped and reported. " +
        'When a video clip directly follows another on its track, "fade into / dissolve to / slide in / wipe to" that clip means a transition on the cut before it, not an animation. ' +
        'Slide / wipe direction is the direction of motion: "from the left" = right.',
      inputSchema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: [...transitionKinds, "none"], description: '"none" removes the transition.' },
          fromClipId: { type: "string", description: "The clip ending at the cut." },
          toClipId: { type: "string", description: "The clip starting at the cut." },
          nearSeconds: { type: "number", description: "Pick the cut closest to this time instead." },
          allCuts: { type: "boolean", description: "Apply to every cut." },
          durationSeconds: { type: "number", minimum: 0.1, maximum: 3, description: "Default 0.6." },
          direction: { type: "string", enum: ["left", "right", "up", "down"], description: "wipe / slide only." },
        },
        required: ["kind"],
        additionalProperties: false,
      },
      run(input, { project }) {
        const cuts = findCuts(project.getState().doc);
        if (cuts.length === 0) return { ok: false, error: "There are no cuts: transitions need two clips touching on the same video track." };
        let targets: Cut[];
        if (input.allCuts === true) targets = cuts;
        else if (typeof input.fromClipId === "string" || typeof input.toClipId === "string") {
          targets = cuts.filter((c) => (!input.fromClipId || c.fromClipId === input.fromClipId) && (!input.toClipId || c.toClipId === input.toClipId));
          if (targets.length === 0) return { ok: false, error: { error: noCutReason(project, input.fromClipId, input.toClipId), cuts: cuts.map(cutInfo) } };
        } else {
          const at = toUs(input.nearSeconds) ?? project.getState().playheadUs;
          const nearest = cuts.reduce((a, b) => (Math.abs(b.atUs - at) < Math.abs(a.atUs - at) ? b : a));
          if (input.nearSeconds !== undefined && Math.abs(nearest.atUs - at) > 1.5 * S) {
            return {
              ok: false,
              error: { error: `There is no cut near ${seconds(at)} (the nearest is at ${seconds(nearest.atUs)}). Transitions only go on cuts; nothing was added. Use one of these cuts, or tell the user there isn't one there.`, cuts: cuts.map(cutInfo) },
            };
          }
          targets = [nearest];
        }
        if (targets.length === 0) return { ok: false, error: { error: "no cut matches", cuts: cuts.map(cutInfo) } };
        const kind = String(input.kind);
        const wanted = toUs(input.durationSeconds) ?? 600_000;
        const commands: Command[] = [];
        const changes: string[] = [];
        const skipped: unknown[] = [];
        for (const cut of targets) {
          if (cut.transition) commands.push({ type: "transition/remove", payload: { transitionId: cut.transition.id } });
          if (kind === "none") {
            if (cut.transition) changes.push(`Removed the transition at ${seconds(cut.atUs)}`);
            continue;
          }
          const durationUs = Math.min(wanted, cut.maxTransitionUs);
          if (durationUs < 100_000) {
            skipped.push({ ...cutInfo(cut), reason: `no spare footage (${cut.short === "from" ? "the first clip ends where its media ends" : cut.short === "to" ? "the second clip starts at its media's start" : "both clips use all their media"})` });
            if (cut.transition) commands.pop();
            continue;
          }
          const params = input.direction && (kind === "wipe" || kind === "slide") ? { direction: input.direction } : undefined;
          commands.push({ type: "transition/add", payload: { kind, fromClipId: cut.fromClipId, toClipId: cut.toClipId, durationUs, ...(params ? { params } : {}) } });
          changes.push(`${cut.transition ? "Replaced the transition with" : "Added"} ${kind} at ${seconds(cut.atUs)} (${seconds(durationUs)})`);
        }
        if (commands.length) {
          const result = applyCommands(project, commands);
          if (!result.ok) return { ok: false, error: result };
        }
        return { ok: true, result: { changed: changes.length, skipped }, changes };
      },
    }),

    defineTool({
      name: "animate_clip",
      description:
        "Give a visual clip (video, image, text) an entrance (in), a loop while on screen, and/or an exit (out), as keyframes. Slots you leave out keep their current animation; \"none\" removes one; reset:true removes all. " +
        `In/out presets: ${presetIds("in").join(", ")}. Loops: ${presetIds("loop").join(", ")}. Exits stay on the clip's end through trims. ` +
        'Slides: give the edge, in: "from-right" (enters from the right edge, moving left), "from-left", "from-top", "from-bottom"; out: "to-left", "to-right", "to-top", "to-bottom". ' +
        "For text, logos and overlays; between two video clips prefer add_transition. The clip's current animation is in get_state; pass only the slots to change. " +
        "Fading the whole VIDEO in at the start and out at the end is two calls: in on the FIRST clip of the main video track, out on the LAST one (an out on the first clip would fade to black at its cut).",
      inputSchema: {
        type: "object",
        properties: {
          clipId: { type: "string" },
          in: { type: "string", enum: [...presetIds("in"), ...Object.keys(SLIDE_IN), "none"], description: 'For slides, prefer "from-left" / "from-right" / "from-top" / "from-bottom": the edge the clip enters from.' },
          loop: { type: "string", enum: [...presetIds("loop"), "none"] },
          out: { type: "string", enum: [...presetIds("out"), ...Object.keys(SLIDE_OUT), "none"], description: 'For slides, prefer "to-left" / "to-right" / "to-top" / "to-bottom": the edge the clip leaves by.' },
          inSeconds: { type: "number", minimum: 0.2, maximum: 3, description: "Default 0.6." },
          outSeconds: { type: "number", minimum: 0.2, maximum: 3, description: "Default 0.6." },
          easing: { type: "string", enum: ANIMATION_EASINGS.map((e) => e.id), description: "Default smooth." },
          reset: { type: "boolean" },
        },
        required: ["clipId"],
        additionalProperties: false,
      },
      run(input, { project }) {
        input = { ...input, ...slideAliases(input) };
        const clip = project.getState().doc.clips[String(input.clipId)];
        if (!clip) return { ok: false, error: `no clip "${input.clipId}"` };
        if (clip.kind === "audio") return { ok: false, error: "audio clips have no picture to animate (use volume or fades)" };
        const reading = readClipAnimation(clip);
        if (reading.custom && input.reset !== true) {
          return {
            ok: false,
            error: `${clip.id} has its own keyframes (${describeKeyframes(clip)}), not presets; presets would overwrite them. To remove one property's animation, apply_commands keyframe/clear { clipId, property }. To edit them, use set_keyframes. To replace them all with presets, pass reset: true. Nothing was changed.`,
          };
        }
        const current = input.reset === true ? {} : reading.recipe;
        const next: AnimationRecipe = { ...current };
        const easing = (typeof input.easing === "string" ? input.easing : "smooth") as AnimationEasing;
        for (const slot of ["in", "loop", "out"] as const) {
          const name = input[slot];
          if (name === undefined) continue;
          if (name === "none") {
            delete next[slot];
            continue;
          }
          const durationUs = slot === "loop" ? 0 : toUs(input[slot === "in" ? "inSeconds" : "outSeconds"]) ?? current[slot]?.durationUs ?? 600_000;
          next[slot] = { preset: `${slot}:${name}`, durationUs, easing: slot === "loop" ? "linear" : easing };
        }
        const recipe = fitAnimation(next, clip.durationUs);
        const result = applyCommands(project, animationCommands(clip, recipe));
        if (!result.ok) return { ok: false, error: result };
        const summary = describeAnimation(recipe) || "no animation";
        const atCut = input.in && input.in !== "none" && clip.kind === "video" ? findCuts(project.getState().doc).find((c) => c.toClipId === clip.id) : undefined;
        return {
          ok: true,
          result: {
            clipId: clip.id,
            animation: summary,
            ...(atCut ? { note: `${clip.id} starts at a cut right after ${atCut.fromClipId}. If the user meant going from ${atCut.fromClipId} into ${clip.id} ("fade into", "slide in", "dissolve to"), that is add_transition on this cut: undo this entrance with in:"none" and add the transition.` } : {}),
          },
          changes: [`${clip.id}: ${summary}`],
        };
      },
    }),

    defineTool({
      name: "add_effect",
      description:
        "Add a visual effect to one or more clips (video, image, text). Kinds, with their params (min–max, default): " +
        EFFECT_CATALOG.map((e) => `${e.kind} (${e.label}${e.params.length ? `: ${e.params.map((p) => (p.type === "number" ? `${p.key} ${p.min}–${p.max}, ${p.default}` : `${p.key} color`)).join("; ")}` : ""})`).join(", ") +
        ". Omitted params take their defaults. Black & white is mono; brightness, contrast, saturation and hue are colorAdjust params (-1–1, 0 = unchanged).",
      inputSchema: {
        type: "object",
        properties: {
          clipIds: { type: "array", items: { type: "string" }, minItems: 1 },
          kind: { type: "string", enum: EFFECT_CATALOG.map((e) => e.kind) },
          params: { type: "object", description: "Effect params by key; see the list above." },
        },
        required: ["clipIds", "kind"],
        additionalProperties: false,
      },
      run(input, { project }) {
        const ids = (input.clipIds as string[]) ?? [];
        const doc = project.getState().doc;
        const missing = ids.filter((id) => !doc.clips[id]);
        if (missing.length) return { ok: false, error: `no clip ${missing.map((m) => `"${m}"`).join(", ")}` };
        const audio = ids.filter((id) => doc.clips[id]!.kind === "audio");
        if (audio.length) return { ok: false, error: `audio clips have no picture: ${audio.join(", ")}` };
        const params = input.params && typeof input.params === "object" ? (input.params as Record<string, unknown>) : undefined;
        const out = applyChecked(project, ids.map((clipId) => ({ type: "effect/add", payload: { clipId, kind: input.kind, ...(params ? { params } : {}) } })));
        if (!out.ok) return out;
        const label = EFFECT_CATALOG.find((e) => e.kind === input.kind)?.label ?? String(input.kind);
        return { ...out, changes: [`Added ${label} to ${ids.join(", ")}`] };
      },
    }),

    defineTool({
      name: "remove_effects",
      description: "Delete effects from clips: one kind, or every effect when kind is omitted. To turn effects off but keep them, use set_effects_enabled.",
      inputSchema: {
        type: "object",
        properties: {
          clipIds: { type: "array", items: { type: "string" }, minItems: 1 },
          kind: { type: "string", description: "Only effects of this kind (default: all)." },
        },
        required: ["clipIds"],
        additionalProperties: false,
      },
      run(input, { project }) {
        const doc = project.getState().doc;
        const commands: Command[] = [];
        for (const id of (input.clipIds as string[]) ?? []) {
          const clip = doc.clips[id];
          if (!clip) return { ok: false, error: `no clip "${id}"` };
          for (const e of clip.effects ?? []) if (!input.kind || e.kind === input.kind) commands.push({ type: "effect/remove", payload: { clipId: id, effectId: e.id } });
        }
        if (!commands.length) return { ok: true, result: { removed: 0, note: "those clips had no matching effects" } };
        const out = applyChecked(project, commands);
        return out.ok ? { ...out, result: { removed: commands.length }, changes: [`Removed ${commands.length} effect${commands.length > 1 ? "s" : ""}`] } : out;
      },
    }),

    defineTool({
      name: "trim_clip",
      description:
        "Trim a clip like an editor's edge drag, in seconds. removeFromStart cuts that much off the beginning (the clip's end stays put; for video/audio the source moves on too). " +
        "removeFromEnd cuts off the end. setDuration sets the length, keeping the start. startSeconds / endSeconds put the clip's edges at those timeline times (e.g. 0 and the composition length to cover the whole video; a video/audio clip's source shifts with its start edge). " +
        "ripple:true shifts later clips on the same track to close (or open) the gap.",
      inputSchema: {
        type: "object",
        properties: {
          clipId: { type: "string" },
          removeFromStart: { type: "number", exclusiveMinimum: 0 },
          removeFromEnd: { type: "number", exclusiveMinimum: 0 },
          setDuration: { type: "number", exclusiveMinimum: 0 },
          startSeconds: { type: "number", minimum: 0, description: "Timeline time for the clip's start edge." },
          endSeconds: { type: "number", exclusiveMinimum: 0, description: "Timeline time for the clip's end edge." },
          ripple: { type: "boolean" },
        },
        required: ["clipId"],
        additionalProperties: false,
      },
      run(input, { project }) {
        const doc = project.getState().doc;
        const clip = doc.clips[String(input.clipId)];
        if (!clip) return { ok: false, error: `no clip "${input.clipId}"` };
        const head = toUs(input.removeFromStart) ?? 0;
        const tail = toUs(input.removeFromEnd) ?? 0;
        const ripple = input.ripple === true;
        const startAt = toUs(input.startSeconds);
        const endAt = toUs(input.endSeconds);
        if ((startAt !== undefined || endAt !== undefined) && (head || tail)) return { ok: false, error: "use either startSeconds / endSeconds or removeFromStart / removeFromEnd, not both" };
        let duration = clip.durationUs - head - tail;
        const set = toUs(input.setDuration);
        if (set) duration = set;
        // Without ripple, cutting the head keeps the clip's end in place; with ripple the clip keeps its start and later clips move up.
        let start = ripple ? clip.startUs : clip.startUs + head;
        let sourceShift = head;
        if (startAt !== undefined) {
          start = startAt;
          sourceShift = startAt - clip.startUs;
          if (endAt === undefined && !set) duration = clip.startUs + clip.durationUs - startAt;
        }
        if (endAt !== undefined) duration = endAt - start;
        if (duration <= 0) return { ok: false, error: `that leaves the clip ${seconds(duration)} long; it is ${seconds(clip.durationUs)} (${seconds(clip.startUs)}–${seconds(clip.startUs + clip.durationUs)})` };
        const trimmable = "trimStartUs" in clip;
        if (trimmable && (clip as { trimStartUs: number }).trimStartUs + sourceShift < 0) {
          return { ok: false, error: `${clip.id}'s media has only ${seconds((clip as { trimStartUs: number }).trimStartUs)} before its current start, so its start edge can move back at most that far` };
        }
        const commands: Command[] = [
          {
            type: "clip/trim",
            payload: {
              clipId: clip.id,
              startUs: start,
              durationUs: duration,
              ...(trimmable && sourceShift ? { trimStartUs: (clip as { trimStartUs: number }).trimStartUs + sourceShift } : {}),
            },
          },
        ];
        if (ripple) {
          const oldEnd = clip.startUs + clip.durationUs;
          const delta = start + duration - oldEnd;
          const later = Object.values(doc.clips)
            .filter((c) => c.trackId === clip.trackId && c.id !== clip.id && c.startUs >= oldEnd)
            .sort((x, y) => (delta < 0 ? x.startUs - y.startUs : y.startUs - x.startUs));
          for (const c of later) commands.push({ type: "clip/move", payload: { clipId: c.id, startUs: Math.max(0, c.startUs + delta) } });
        }
        const out = applyChecked(project, commands);
        if (!out.ok) return out;
        const after = project.getState().doc.clips[clip.id]!;
        return { ...out, changes: [`Trimmed ${clip.id} to ${seconds(after.startUs)}–${seconds(after.startUs + after.durationUs)}`] };
      },
    }),

    defineTool({
      name: "set_effects_enabled",
      description: "Turn effects off (or back on) without deleting them, keeping their settings: one kind, or every effect when kind is omitted. To delete effects use remove_effects.",
      inputSchema: {
        type: "object",
        properties: {
          clipIds: { type: "array", items: { type: "string" }, minItems: 1 },
          kind: { type: "string", description: "Only effects of this kind (default: all)." },
          enabled: { type: "boolean" },
        },
        required: ["clipIds", "enabled"],
        additionalProperties: false,
      },
      run(input, { project }) {
        const doc = project.getState().doc;
        const enabled = input.enabled === true;
        const commands: Command[] = [];
        for (const id of (input.clipIds as string[]) ?? []) {
          const clip = doc.clips[id];
          if (!clip) return { ok: false, error: `no clip "${id}"` };
          for (const e of clip.effects ?? []) {
            if ((!input.kind || e.kind === input.kind) && e.enabled !== enabled) commands.push({ type: "effect/update", payload: { clipId: id, effectId: e.id, enabled } });
          }
        }
        if (!commands.length) return { ok: true, result: { changed: 0, note: `no matching effects that are ${enabled ? "off" : "on"}` } };
        const out = applyChecked(project, commands);
        return out.ok ? { ...out, result: { changed: commands.length }, changes: [`Turned ${enabled ? "on" : "off"} ${commands.length} effect${commands.length > 1 ? "s" : ""}`] } : out;
      },
    }),

    defineTool({
      name: "set_keyframes",
      description:
        "Animate one property of a clip so it CHANGES over time, with keyframes at TIMELINE seconds (the same times as get_state). Replaces that property's existing keyframes (including a preset's) unless keep:true. Between points the value moves smoothly; before the first and after the last it holds. " +
        "Properties: x, y (0–1, 0.5 = center), scale (1 = full size), rotation (degrees; 360 = one full turn, so a static 360 looks like 0), opacity (0–1), volume (0–1, audio/video). " +
        "Not for constant values (\"rotate 45°\", \"music at 30%\", \"louder\": set those with clip/set-property) or for removing an animation (keyframe/clear). Use it for motion and timed changes the presets don't cover: a spin (rotation 0 → 360 over the clip), a pan, ducking music (volume: normal → low just before a range, low → normal just after), or fading audio between two times.",
      inputSchema: {
        type: "object",
        properties: {
          clipId: { type: "string" },
          property: { type: "string", enum: ["x", "y", "scale", "rotation", "opacity", "volume"] },
          points: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: { atSeconds: { type: "number", minimum: 0 }, value: { type: "number" } },
              required: ["atSeconds", "value"],
              additionalProperties: false,
            },
          },
          easing: { type: "string", enum: ["linear", "easeIn", "easeOut", "easeInOut", "hold"], description: "Curve between points (default linear)." },
          keep: { type: "boolean", description: "Keep the property's other keyframes (default false: replace them)." },
        },
        required: ["clipId", "property", "points"],
        additionalProperties: false,
      },
      run(input, { project }) {
        const clip = project.getState().doc.clips[String(input.clipId)];
        if (!clip) return { ok: false, error: `no clip "${input.clipId}"` };
        const property = String(input.property);
        if (property === "volume" && !("volume" in clip)) return { ok: false, error: `${clip.id} is a ${clip.kind} clip and has no volume` };
        if (property !== "volume" && clip.kind === "audio") return { ok: false, error: "audio clips only animate volume" };
        const end = clip.startUs + clip.durationUs;
        const points = (input.points as { atSeconds: number; value: number }[]).map((p) => ({ atUs: toUs(p.atSeconds)!, value: p.value }));
        const outside = points.filter((p) => p.atUs < clip.startUs - 1000 || p.atUs > end + 1000);
        if (outside.length) return { ok: false, error: `${clip.id} runs ${seconds(clip.startUs)}–${seconds(end)}; points must be inside that range (got ${outside.map((p) => seconds(p.atUs)).join(", ")})` };
        if (input.keep !== true && new Set(points.map((p) => p.value)).size < 2) {
          const how = property === "volume" ? "clip/set-property { volume }" : `clip/set-property { transform: { ${property} } }`;
          return {
            ok: false,
            error: `Keyframes are for a value that CHANGES over time; ${points.length === 1 ? "one point" : "these points"} hold${points.length === 1 ? "s" : ""} a single value. For a constant ${property}, set it directly with apply_commands ${how}. To remove an animation, apply keyframe/clear { clipId, property }. Nothing was changed.`,
          };
        }
        const commands: Command[] = [];
        if (input.keep !== true && (clip.animations?.[property as "x"]?.length ?? 0) > 0) commands.push({ type: "keyframe/clear", payload: { clipId: clip.id, property } });
        const easing = typeof input.easing === "string" ? input.easing : "linear";
        for (const p of points) {
          commands.push({ type: "keyframe/set", payload: { clipId: clip.id, property, timeUs: Math.min(clip.durationUs, Math.max(0, p.atUs - clip.startUs)), value: p.value, easing } });
        }
        const out = applyChecked(project, commands);
        if (!out.ok) return out;
        const list = points.map((p) => `${seconds(p.atUs)} ${n3(p.value)}`).join(" → ");
        return { ...out, changes: [`${clip.id}: ${property} ${list}`] };
      },
    }),

    defineTool({
      name: "set_background",
      description:
        "A solid color background behind everything (an html clip on a Background track at the very bottom). Adds one, recolors or re-times the existing one, or removes it with color \"none\". " +
        "Covers the whole video unless fromSeconds / toSeconds say otherwise. Only visible where nothing opaque is on top (behind scaled-down, faded or transparent clips, or where there's no footage).",
      inputSchema: {
        type: "object",
        properties: {
          color: { type: "string", description: 'CSS color, e.g. "#1E3A8A", or "none" to remove the background.' },
          fromSeconds: { type: "number", minimum: 0 },
          toSeconds: { type: "number", exclusiveMinimum: 0 },
        },
        required: ["color"],
        additionalProperties: false,
      },
      run(input, { project }) {
        const doc = project.getState().doc;
        const color = String(input.color).trim();
        const existing = Object.values(doc.clips).find(
          (c) => c.kind === "html" && ((c as { template?: string }).template === BACKGROUND_TEMPLATE || doc.tracks[c.trackId]?.name === "Background"),
        );
        if (color.toLowerCase() === "none") {
          if (!existing) return { ok: true, result: { note: "there is no background to remove" } };
          const commands: Command[] = [{ type: "clip/remove", payload: { clipId: existing.id } }];
          if (!Object.values(doc.clips).some((c) => c.trackId === existing.trackId && c.id !== existing.id)) commands.push({ type: "track/remove", payload: { id: existing.trackId } });
          const out = applyChecked(project, commands);
          return out.ok ? { ...out, changes: ["Removed the background"] } : out;
        }
        let endUs = 0;
        for (const c of Object.values(doc.clips)) if (c.id !== existing?.id) endUs = Math.max(endUs, c.startUs + c.durationUs);
        const startUs = toUs(input.fromSeconds) ?? (existing && input.toSeconds === undefined ? existing.startUs : 0);
        const stopUs = toUs(input.toSeconds) ?? (existing && input.fromSeconds === undefined ? existing.startUs + existing.durationUs : endUs || 10 * S);
        if (stopUs <= startUs) return { ok: false, error: `toSeconds must be after fromSeconds (got ${seconds(startUs)}–${seconds(stopUs)})` };
        const commands: Command[] = [];
        if (existing) {
          const params = existing as { template: string; params: Record<string, unknown> };
          const key = htmlPlaceholders(params.template).find((k) => /colou?r|background|bg/i.test(k)) ?? "color";
          if (params.params[key] !== color) commands.push({ type: "clip/set-property", payload: { clipId: existing.id, params: { [key]: color } } });
          if (existing.startUs !== startUs || existing.durationUs !== stopUs - startUs) commands.push({ type: "clip/trim", payload: { clipId: existing.id, startUs, durationUs: stopUs - startUs } });
          if (!commands.length) return { ok: true, result: { note: "the background already looks like that" } };
        } else {
          const trackId = doc.tracks.background ? `background-${Object.keys(doc.tracks).length}` : "background";
          commands.push({ type: "track/add", payload: { id: trackId, kind: "video", name: "Background", index: 0 } });
          commands.push({ type: "clip/add", payload: { kind: "html", id: `${trackId}-clip`, trackId, startUs, durationUs: stopUs - startUs, template: BACKGROUND_TEMPLATE, params: { color } } });
        }
        const out = applyChecked(project, commands);
        if (!out.ok) return out;
        return { ...out, changes: [`${existing ? "Changed the background to" : "Added a background:"} ${color}, ${seconds(startUs)}–${seconds(stopUs)}`] };
      },
    }),

    defineTool({
      name: "close_gaps",
      description: "Close the empty gaps on a track so its clips run back to back, keeping their order (the first clip stays where it is, or starts at 0 with fromZero).",
      inputSchema: {
        type: "object",
        properties: { trackId: { type: "string" }, fromZero: { type: "boolean" } },
        required: ["trackId"],
        additionalProperties: false,
      },
      run(input, { project }) {
        const doc = project.getState().doc;
        if (!doc.tracks[String(input.trackId)]) return { ok: false, error: `no track "${input.trackId}"` };
        const clips = Object.values(doc.clips)
          .filter((c) => c.trackId === input.trackId)
          .sort((a, b) => a.startUs - b.startUs);
        let cursor = input.fromZero === true ? 0 : clips[0]?.startUs ?? 0;
        const commands: Command[] = [];
        for (const c of clips) {
          if (c.startUs !== cursor) commands.push({ type: "clip/move", payload: { clipId: c.id, startUs: cursor } });
          cursor += c.durationUs;
        }
        if (!commands.length) return { ok: true, result: { moved: 0, note: "no gaps on that track" } };
        const out = applyChecked(project, commands);
        return out.ok ? { ...out, changes: [`Closed ${commands.length} gap${commands.length > 1 ? "s" : ""} on ${input.trackId}`] } : out;
      },
    }),
  ];
}

/* ---------- apply_commands, checked ---------- */

class Abort extends Error {}

/**
 * Apply a batch as one all-or-nothing step, with two checks core doesn't do:
 * fields a command would silently ignore are errors, and commands that
 * changed nothing are reported, so the model never claims an edit that didn't
 * happen.
 */
export function applyChecked(project: Project, commands: Command[]): ToolOutput {
  const catalog = project.commandCatalog();
  const nothing = commands.length > 1 ? "Nothing in this batch was applied (not even the commands before it): resend the whole corrected batch." : "Nothing was applied.";
  const templates = new Map<string, string>();
  for (const [index, command] of commands.entries()) {
    if (!catalog[command?.type]) {
      const looksLikeTool = /^[a-z]+(_[a-z]+)+$/.test(String(command?.type));
      return {
        ok: false,
        error: {
          failedIndex: index,
          kind: "unknown-command",
          commandType: command?.type,
          error: `"${command?.type}" is not a command${looksLikeTool ? ": it is a tool. Call it as its own tool call, not inside apply_commands" : ""}. ${nothing}`,
          validTypes: Object.keys(catalog).sort(),
        },
      };
    }
    const htmlError = checkHtmlParams(project, command, templates);
    if (htmlError) return { ok: false, error: { failedIndex: index, commandType: command.type, error: `${htmlError} ${nothing}` } };
    const extra = unknownFields(catalog[command?.type], command?.payload);
    if (extra) {
      return {
        ok: false,
        error: {
          failedIndex: index,
          commandType: command.type,
          error: `unknown field${extra.unknown.length > 1 ? "s" : ""} ${extra.unknown.map((f) => `"${f}"`).join(", ")}: ${command.type} would ignore ${extra.unknown.length > 1 ? "them" : "it"}. Its fields are: ${extra.allowed.join(", ")}. ${nothing}`,
        },
      };
    }
  }
  const unchanged: number[] = [];
  let failure: unknown;
  try {
    project.transaction(() => {
      commands.forEach((command, index) => {
        const before = project.getState().doc;
        const result = tryDispatch(project, command);
        if (!result.ok) {
          const hint = rejectionHint(result.error as { code?: string; commandType?: string }, command);
          const skipped = commands.length > 1 ? { notApplied: describeCommands(commands.filter((_, i) => i !== index)) } : {};
          failure = { failedIndex: index, ...result.error, ...(hint ? { hint } : {}), note: nothing, ...skipped };
          throw new Abort();
        }
        if (project.getState().doc === before) unchanged.push(index);
      });
    });
  } catch (err) {
    if (err instanceof Abort) return { ok: false, error: failure };
    throw err;
  }
  const changed = commands.filter((_, i) => !unchanged.includes(i));
  return {
    ok: true,
    result: {
      applied: changed.length,
      ...(unchanged.length
        ? { unchanged: unchanged.map((i) => ({ index: i, type: commands[i]!.type, note: "changed nothing: the project already had these values. Check the field names and values." })) }
        : {}),
    },
    ...(changed.length ? { changes: describeCommands(changed) } : {}),
  };
}

/** html clips substitute `{{name}}` placeholders: params with any other name change nothing on screen. */
function checkHtmlParams(project: Project, command: Command, templates: Map<string, string>): string | undefined {
  const p = (command.payload ?? {}) as Record<string, unknown>;
  let template: string | undefined;
  if (command.type === "clip/add" && p.kind === "html" && typeof p.template === "string") {
    template = p.template;
    if (typeof p.id === "string") templates.set(p.id, template);
  } else if (command.type === "clip/set-property" && p.params && typeof p.params === "object") {
    const clip = project.getState().doc.clips[String(p.clipId)] as { kind?: string; template?: string } | undefined;
    template = templates.get(String(p.clipId)) ?? (clip?.kind === "html" ? clip.template : undefined);
  }
  if (template === undefined || !p.params || typeof p.params !== "object") return undefined;
  const names = htmlPlaceholders(template);
  const unknown = Object.keys(p.params).filter((k) => !names.includes(k));
  if (!unknown.length) return undefined;
  return `html params ${unknown.map((k) => `"${k}"`).join(", ")} match no {{placeholder}} in the template, so they would change nothing. Its placeholders: ${names.join(", ") || "none"}.`;
}

/** What to do instead, for rejections models commonly hit. */
function rejectionHint(error: { code?: string }, _command: Command): string | undefined {
  switch (error.code) {
    case "no-audio":
      return "fadeInUs / fadeOutUs fade audio only. To fade a text, image or video picture in or out, call animate_clip (in / out: fade).";
    case "asset-not-found":
      return "Clips can only use assets already in the project (see get_state). Audio found with search_audio is added with add_audio, which imports it.";
    case "not-caption":
    case "not-html":
    case "not-text":
      return "That field belongs to another clip kind: text clips take color / font fields, caption clips take style, html clips take params (named by the template's {{placeholders}}, shown in get_state).";
    default:
      return undefined;
  }
}

/** Why two clips have no cut between them, so the model reports it instead of picking another cut. */
function noCutReason(project: Project, fromId: unknown, toId: unknown): string {
  const doc = project.getState().doc;
  const a = typeof fromId === "string" ? doc.clips[fromId] : undefined;
  const b = typeof toId === "string" ? doc.clips[toId] : undefined;
  const tail = "Nothing was added. Don't substitute a different cut: tell the user, and offer an animation (animate_clip) instead if that fits.";
  for (const [given, clip] of [[fromId, a], [toId, b]] as const) if (typeof given === "string" && !clip) return `There is no clip "${given}". ${tail}`;
  if (a && b && a.trackId !== b.trackId) return `${a.id} is on track ${a.trackId} and ${b.id} on track ${b.trackId}: a transition joins two clips that touch on the SAME track, so these two have no cut between them. ${tail}`;
  if (a && b) return `${a.id} and ${b.id} don't touch (${a.id} ends at ${seconds(a.startUs + a.durationUs)}, ${b.id} starts at ${seconds(b.startUs)}). ${tail}`;
  return `No cut ${a ? `starts after ${a.id}` : `leads into ${b!.id}`} (it isn't directly after/before another clip on its track). ${tail}`;
}

function cutInfo(c: Cut) {
  return { fromClipId: c.fromClipId, toClipId: c.toClipId, atSeconds: c.atUs / S, maxSeconds: c.maxTransitionUs / S, ...(c.transition ? { transition: c.transition.kind } : {}) };
}

/** apply_commands' input schema: `type` is an enum of the catalog's commands. */
export function applyCommandsSchema(catalog: Record<string, unknown>): Record<string, unknown> {
  const [dispatch] = toToolDefinitions(catalog, { mode: "dispatch" }) as { input_schema: Record<string, unknown> }[];
  return {
    type: "object",
    properties: {
      commands: { type: "array", minItems: 1, items: dispatch!.input_schema, description: "Commands applied in order, as one batch." },
    },
    required: ["commands"],
    additionalProperties: false,
  };
}
