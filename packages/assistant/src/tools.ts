import {
  ANIMATION_EASINGS,
  ANIMATION_PRESETS,
  animationCommands,
  applyCommands,
  commandCatalog,
  builtinTransitionParamSchemas,
  describeAnimation,
  describeProject,
  findCuts,
  fitAnimation,
  readAnimation,
  toToolDefinitions,
  type AnimationEasing,
  type AnimationRecipe,
  type AnimationSlot,
  type Command,
  type Cut,
  type Project,
} from "@miraiclip/core";
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
const seconds = (us: number) => `${Math.round(us / 100_000) / 10}s`;
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
      description: `The project as it is now (after your edits so far): settings, assets, tracks with clips (ids, kinds, time ranges), transitions. ${US_NOTE}`,
      inputSchema: {
        type: "object",
        properties: { includeJson: { type: "boolean", description: "Also return the full document JSON (verbose; only for exact field values)." } },
        additionalProperties: false,
      },
      run(input, { project }) {
        const summary = describeProject(project.toJSON());
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
        const result = applyCommands(project, commands);
        if (!result.ok) return { ok: false, error: result };
        return { ok: true, result: { applied: result.applied }, changes: describeCommands(commands) };
      },
    }),

    defineTool({
      name: "add_transition",
      description:
        "Add (or replace, or remove) a transition on cuts — where one clip ends exactly where the next starts on the same video track. Pick the cut by its two clip ids, by a time near it, or all cuts. " +
        "A transition overlaps both clips around the cut, so its length is capped by the spare footage there; cuts with none are skipped and reported.",
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
        } else {
          const at = toUs(input.nearSeconds) ?? project.getState().playheadUs;
          targets = [cuts.reduce((a, b) => (Math.abs(b.atUs - at) < Math.abs(a.atUs - at) ? b : a))];
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
        `In/out presets: ${presetIds("in").join(", ")}. Loops: ${presetIds("loop").join(", ")}. Exits stay on the clip's end through trims.`,
      inputSchema: {
        type: "object",
        properties: {
          clipId: { type: "string" },
          in: { type: "string", enum: [...presetIds("in"), "none"] },
          loop: { type: "string", enum: [...presetIds("loop"), "none"] },
          out: { type: "string", enum: [...presetIds("out"), "none"] },
          inSeconds: { type: "number", minimum: 0.2, maximum: 3, description: "Default 0.6." },
          outSeconds: { type: "number", minimum: 0.2, maximum: 3, description: "Default 0.6." },
          easing: { type: "string", enum: ANIMATION_EASINGS.map((e) => e.id), description: "Default smooth." },
          reset: { type: "boolean" },
        },
        required: ["clipId"],
        additionalProperties: false,
      },
      run(input, { project }) {
        const clip = project.getState().doc.clips[String(input.clipId)];
        if (!clip) return { ok: false, error: `no clip "${input.clipId}"` };
        if (clip.kind === "audio") return { ok: false, error: "audio clips have no picture to animate (use volume or fades)" };
        const current = input.reset === true ? {} : readAnimation(clip).recipe;
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
        return { ok: true, result: { clipId: clip.id, animation: summary }, changes: [`${clip.id}: ${summary}`] };
      },
    }),
  ];
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
