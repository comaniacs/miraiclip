/**
 * The AI command interface: the pieces that turn the command catalog into a
 * working LLM integration.
 *
 * - `toToolDefinitions` — the catalog's JSON Schemas as ready-to-send tool
 *   definitions (Anthropic tool_use or OpenAI function-calling shapes; one
 *   tool per command, or a single dispatch tool for tool-count-constrained
 *   hosts such as MCP servers).
 * - `tryDispatch` / `applyCommands` — dispatch with MACHINE-READABLE failures
 *   (which command, which field, what would be valid), so an agent can
 *   correct itself instead of parsing an exception string. `applyCommands`
 *   applies a batch as one transaction: all-or-nothing, with the failing
 *   index reported.
 * - `describeProject` — a compact, deterministic, token-efficient summary of
 *   the document for prompts; raw `toJSON()` wastes an agent's context.
 *
 * Everything here is pure plumbing over the existing engine — same commands,
 * same validation, same history.
 */
import type { Command } from "./commands/schemas.js";
import {
  CommandRejectedError,
  CommandValidationError,
  UnknownCommandError,
} from "./errors.js";
import type { Project } from "./engine.js";
import type { Clip, ProjectDocument } from "./types.js";

// ---------------------------------------------------------------------------
// Tool naming: command types use "/" (clip/add), which LLM tool-name rules
// (^[a-zA-Z0-9_-]+$ for both Anthropic and OpenAI) forbid.
// ---------------------------------------------------------------------------

/** "clip/add" → "clip_add" — the sanitized name used in tool definitions. */
export function toolNameForCommand(type: string): string {
  return type.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/** Reverse of `toolNameForCommand`, resolved against the known types. */
export function commandTypeForTool(
  toolName: string,
  commandTypes: Iterable<string>,
): string | undefined {
  for (const type of commandTypes) {
    if (toolNameForCommand(type) === toolName) return type;
  }
  return undefined;
}

const BUILTIN_DESCRIPTIONS: Record<string, string> = {
  "asset/add": "Register a media asset (video, audio, image, font) by id and src. Metadata only — nothing is decoded.",
  "asset/remove": "Remove an asset. Fails while any clip still references it.",
  "clip/add": "Add a clip (video, text, caption, …) to a track at a timeline position. Times are microseconds.",
  "clip/duplicate": "Duplicate an existing clip to a new id, optionally at a new position.",
  "clip/move": "Move a clip to a new timeline start (and optionally another track).",
  "clip/remove": "Remove a clip. Transitions attached to it are dropped.",
  "clip/set-property": "Set a clip property (transform fields, volume, text content, …) as a static value.",
  "clip/split": "Split a clip in two at a timeline position; the right half gets newClipId.",
  "clip/trim": "Change a clip's in-point (trimStartUs) and/or duration without moving other clips.",
  "effect/add": "Add an effect (colorAdjust, blur, chromaKey, or a registered custom kind) to a clip's effect stack.",
  "effect/remove": "Remove one effect from a clip by index.",
  "effect/reorder": "Move an effect to a new index in the clip's stack (stack order = application order).",
  "effect/update": "Update an effect's params (and/or enabled flag) in place.",
  "keyframe/clear": "Remove ALL keyframes for one property of a clip.",
  "keyframe/remove": "Remove the keyframe at an exact time for one property of a clip.",
  "keyframe/set": "Set a keyframe (time is relative to the clip's visible start) for an animatable property, with optional easing.",
  "project/set-settings": "Change composition settings (width, height, fps).",
  "track/add": "Add a track. Track order defines layering: later tracks render on top.",
  "track/remove": "Remove a track and every clip on it.",
  "track/rename": "Rename a track.",
  "track/reorder": "Move a track to a new index in the render order (0 = bottom layer).",
  "track/set-property": "Set a track property (e.g. muted, locked).",
  "transition/add": "Add a transition (crossDissolve, dipToBlack, dipToWhite, wipe, slide) across the cut between two adjacent clips.",
  "transition/remove": "Remove a transition.",
  "transition/update": "Update a transition's duration, kind, or params.",
};

export interface ToToolDefinitionsOptions {
  /**
   * Wire shape: "anthropic" (default) → `{ name, description, input_schema }`;
   * "openai" → `{ type: "function", function: { name, description, parameters } }`.
   */
  style?: "anthropic" | "openai";
  /**
   * "per-command" (default): one tool per command type — best when the host
   * allows ~25+ tools. "dispatch": ONE `miraiclip_dispatch` tool taking
   * `{ type, payload }` — for tool-count-constrained hosts (MCP servers);
   * pair it with handing the agent the catalog for payload schemas.
   */
  mode?: "per-command" | "dispatch";
  /** Extra or overriding descriptions, keyed by command type (custom commands). */
  descriptions?: Record<string, string>;
}

/**
 * The command catalog as ready-to-send LLM tool definitions. Pass the result
 * of `project.commandCatalog()` so registered custom commands are included.
 */
export function toToolDefinitions(
  catalog: Record<string, unknown>,
  options: ToToolDefinitionsOptions = {},
): unknown[] {
  const style = options.style ?? "anthropic";
  const wrap = (name: string, description: string, schema: unknown): unknown =>
    style === "openai"
      ? { type: "function", function: { name, description, parameters: schema } }
      : { name, description, input_schema: schema };
  const describe = (type: string): string =>
    options.descriptions?.[type] ??
    BUILTIN_DESCRIPTIONS[type] ??
    `Dispatch the "${type}" command. See the command catalog for its payload schema.`;

  if (options.mode === "dispatch") {
    const types = Object.keys(catalog).sort();
    return [
      wrap(
        "miraiclip_dispatch",
        "Dispatch one Miraiclip editing command against the project. `type` selects the command; `payload` must match that command's schema from the command catalog. All times are microseconds (1 second = 1000000).",
        {
          type: "object",
          properties: {
            type: { type: "string", enum: types, description: "The command type." },
            payload: {
              type: "object",
              description: "The command's payload. The schema depends on `type` — consult the command catalog.",
            },
          },
          required: ["type", "payload"],
          additionalProperties: false,
        },
      ),
    ];
  }

  return Object.entries(catalog)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, schema]) => wrap(toolNameForCommand(type), describe(type), schema));
}

// ---------------------------------------------------------------------------
// Machine-readable dispatch results
// ---------------------------------------------------------------------------

export interface CommandFailure {
  /** What went wrong, as a category an agent can branch on. */
  kind: "unknown-command" | "invalid-payload" | "rejected";
  commandType: string;
  /** Human-readable summary (same text the thrown error carries). */
  message: string;
  /** `rejected` only: the engine's rejection code (e.g. "unknown-clip"). */
  code?: string;
  /** `invalid-payload` only: one entry per schema violation. */
  issues?: { path: string; message: string }[];
  /** `unknown-command` only: every type the project accepts. */
  validTypes?: string[];
}

export type CommandResult = { ok: true } | { ok: false; error: CommandFailure };

function toFailure(error: unknown, project: Project): CommandFailure | null {
  if (error instanceof UnknownCommandError) {
    return {
      kind: "unknown-command",
      commandType: error.commandType,
      message: error.message,
      validTypes: Object.keys(project.commandCatalog()).sort(),
    };
  }
  if (error instanceof CommandValidationError) {
    return {
      kind: "invalid-payload",
      commandType: error.commandType,
      message: error.message,
      issues: error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    };
  }
  if (error instanceof CommandRejectedError) {
    return {
      kind: "rejected",
      commandType: error.commandType,
      code: error.code,
      message: error.message,
    };
  }
  return null; // not a command failure — a real bug; let it propagate
}

/**
 * Dispatch one command, returning a structured result instead of throwing on
 * command failures. Non-command errors (bugs) still throw.
 */
export function tryDispatch(project: Project, command: Command): CommandResult {
  try {
    project.dispatch(command);
    return { ok: true };
  } catch (error) {
    const failure = toFailure(error, project);
    if (!failure) throw error;
    return { ok: false, error: failure };
  }
}

export type ApplyCommandsResult =
  | { ok: true; applied: number }
  | { ok: false; applied: 0; failedIndex: number; error: CommandFailure };

/**
 * Apply a batch of commands as ONE transaction: all-or-nothing (a failure
 * rolls back every command already applied — the engine's transaction
 * rollback), one undo step on success, and the failing index reported so an
 * agent can fix exactly the command that broke.
 */
export function applyCommands(
  project: Project,
  commands: readonly Command[],
  options: { label?: string } = {},
): ApplyCommandsResult {
  let failedIndex = -1;
  let failure: CommandFailure | null = null;
  try {
    project.transaction(() => {
      commands.forEach((command, index) => {
        try {
          project.dispatch(command);
        } catch (error) {
          failedIndex = index;
          failure = toFailure(error, project);
          throw error;
        }
      });
    }, options.label);
    return { ok: true, applied: commands.length };
  } catch (error) {
    if (failure !== null) return { ok: false, applied: 0, failedIndex, error: failure };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Compact state summary for prompts
// ---------------------------------------------------------------------------

export interface DescribeProjectOptions {
  /** Elide the middle of very long tracks (default 50 clips per track). */
  maxClipsPerTrack?: number;
}

function formatUs(us: number): string {
  return `${us}us`;
}

function clipLine(clip: Clip): string {
  const endUs = clip.startUs + clip.durationUs;
  let extra = "";
  if ("assetId" in clip && typeof clip.assetId === "string") extra += `[${clip.assetId}]`;
  if ("trimStartUs" in clip && typeof clip.trimStartUs === "number" && clip.trimStartUs > 0) {
    extra += ` trim ${formatUs(clip.trimStartUs)}`;
  }
  if ("text" in clip && typeof clip.text === "string") {
    const text = clip.text.length > 24 ? `${clip.text.slice(0, 24)}…` : clip.text;
    extra += ` ${JSON.stringify(text)}`;
  }
  if ("words" in clip && Array.isArray(clip.words)) extra += ` (${clip.words.length} words)`;
  const effects = clip.effects?.length ? ` [${clip.effects.length} effect${clip.effects.length > 1 ? "s" : ""}]` : "";
  const animated = clip.animations ? Object.keys(clip.animations) : [];
  const keyframes = animated.length ? ` [keyframes: ${animated.sort().join(", ")}]` : "";
  return `${clip.id}: ${clip.kind}${extra} at ${formatUs(clip.startUs)}..${formatUs(endUs)}${effects}${keyframes}`;
}

/**
 * A compact, deterministic summary of the document, written for LLM prompts:
 * everything an agent needs to place commands (ids, kinds, time ranges in the
 * same microsecond unit commands take), nothing it doesn't.
 */
export function describeProject(
  doc: ProjectDocument,
  options: DescribeProjectOptions = {},
): string {
  const maxClips = options.maxClipsPerTrack ?? 50;
  const { settings } = doc;
  let endUs = 0;
  for (const clip of Object.values(doc.clips)) endUs = Math.max(endUs, clip.startUs + clip.durationUs);

  const lines: string[] = [];
  lines.push(
    `Miraiclip project — ${settings.width}x${settings.height} @ ${settings.fps}fps. ` +
      `Composition length: ${formatUs(endUs)} (${(endUs / 1_000_000).toFixed(2)}s). ` +
      `All command times are MICROSECONDS (1 second = 1000000us).`,
  );

  const assets = Object.values(doc.assets).sort((a, b) => a.id.localeCompare(b.id));
  lines.push(assets.length === 0 ? "assets: (none)" : "assets:");
  for (const asset of assets) {
    const duration = asset.durationUs !== undefined ? `, ${formatUs(asset.durationUs)}` : "";
    lines.push(`- ${asset.id}: ${asset.kind}${duration}, src ${JSON.stringify(asset.src)}`);
  }

  lines.push("tracks (bottom to top):");
  for (const trackId of doc.trackOrder) {
    const track = doc.tracks[trackId];
    if (!track) continue;
    const clips = Object.values(doc.clips)
      .filter((clip) => clip.trackId === trackId)
      .sort((a, b) => a.startUs - b.startUs || a.id.localeCompare(b.id));
    lines.push(`- ${trackId} (${track.kind}), ${clips.length} clip${clips.length === 1 ? "" : "s"}:`);
    const shown =
      clips.length > maxClips
        ? [...clips.slice(0, Math.ceil(maxClips / 2)), null, ...clips.slice(-Math.floor(maxClips / 2))]
        : clips;
    for (const clip of shown) {
      lines.push(clip === null ? `  … (${clips.length - maxClips} more clips elided)` : `  - ${clipLine(clip)}`);
    }
  }

  const transitions = Object.values(doc.transitions).sort((a, b) => a.id.localeCompare(b.id));
  if (transitions.length > 0) {
    lines.push("transitions:");
    for (const transition of transitions) {
      lines.push(
        `- ${transition.id}: ${transition.kind} between ${transition.fromClipId} -> ${transition.toClipId}, ${formatUs(transition.durationUs)}`,
      );
    }
  }

  return lines.join("\n");
}
