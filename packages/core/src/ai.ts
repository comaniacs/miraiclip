/**
 * The AI command interface: the pieces that turn the command catalog into a
 * working LLM integration.
 *
 * - `toToolDefinitions` — the catalog's JSON Schemas as ready-to-send tool
 *   definitions (Anthropic tool_use, OpenAI function-calling or Gemini
 *   function-declaration shapes; one
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
import { listMarkers } from "./markers.js";
import type { Command } from "./commands/schemas.js";
import {
  CommandRejectedError,
  CommandValidationError,
  UnknownCommandError,
} from "./errors.js";
import type { Project } from "./engine.js";
import { EFFECT_CATALOG } from "./effect-catalog.js";
import type { CaptionClip, Clip, ProjectDocument, TextAlign, TextClip, Typography } from "./types.js";
import { formatFrameRate, projectFrameRate } from "./timeline.js";

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
  "asset/set-property": "Set or clear an asset's name and provenance (source, license, attribution). `null` clears a field.",
  "clip/add": "Add a clip (video, text, caption, …) to a track at a timeline position. Times are microseconds.",
  "clip/duplicate": "Duplicate an existing clip to a new id, optionally at a new position.",
  "clip/move": "Move a clip to a new timeline start (and optionally another track).",
  "clip/remove": "Remove a clip. Transitions attached to it are dropped.",
  "clip/set-property": "Set a clip property (transform fields, volume, audio fades, text content, custom-kind props, …) as a static value.",
  "clip/replace-asset": "Point a video, audio or image clip at another asset of the same kind, keeping its place, transform, keyframes, effects and transitions. New footage starts at its beginning (or trimStartUs); a source too short for the clip shortens it. crop: \"reset\" drops the crop.",
  "clip/set-speed": "Change a video/audio clip's playback speed (0.0625–16; 0 freezes a video clip). By default the clip keeps the same footage, so its length changes; keepDuration keeps the length; ripple shifts later clips on the track.",
  "clip/freeze": "Hold one frame of a video clip for durationUs at a timeline position (freeze frame). Splits the clip there and, by default, pushes the rest of the track back.",
  "clip/split": "Split a clip in two at a timeline position; the right half gets newClipId.",
  "clip/trim": "Change a clip's in-point (trimStartUs) and/or duration without moving other clips.",
  "effect/add": `Add an effect to a clip's effect stack (omitted params take defaults; optional region limits it to part of the clip, invert applies it outside). Built-in kinds: ${EFFECT_CATALOG.map((e) => e.kind).join(", ")}; or a registered custom kind.`,
  "effect/remove": "Remove one effect from a clip by index.",
  "effect/reorder": "Move an effect to a new index in the clip's stack (stack order = application order).",
  "effect/update": "Update an effect's params, enabled flag, or region in place (region null = whole clip again).",
  "effect/set-region-keyframe": "Keyframe one coordinate (x, y, width, height — fractions of the clip's frame) of an effect's region, e.g. to make a blur follow a moving field.",
  "effect/clear-region-keyframes": "Remove an effect region's keyframes (one coordinate, or all).",
  "keyframe/clear": "Remove ALL keyframes for one property of a clip.",
  "keyframe/remove": "Remove the keyframe at an exact time (and anchor) for one property of a clip.",
  "keyframe/set": "Set a keyframe for an animatable property, with optional easing. Time is relative to the clip's visible start, or with anchor \"end\" measured back from its end (use that for exit animations so they follow trims).",
  "marker/add": "Add a timeline marker (a chapter, tutorial step or note) at timeUs with a label, optional durationUs span and free-form data.",
  "marker/update": "Move, rename or change a marker's span/data (`null` clears durationUs or data).",
  "marker/remove": "Remove a marker.",
  "plugin/add": "Declare a plugin (name, version, module url, optional SRI integrity) whose custom clip/effect/transition kinds this document uses, so every renderer loads it.",
  "plugin/remove": "Remove a plugin from the document's manifest.",
  "project/set-settings": "Change composition settings (width, height, fps; NTSC rates like 29.97 are stored exactly as 30000/1001, or pass frameRate {num, den}).",
  "track/add": "Add a track. Track order defines layering: later tracks render on top.",
  "track/remove": "Remove a track and every clip on it.",
  "track/rename": "Rename a track.",
  "track/reorder": "Move a track to a new index in the render order (0 = bottom layer).",
  "track/set-property": "Set a track property: muted, solo, locked, or hidden (hidden tracks aren't drawn; audio follows muted).",
  "transition/add": "Add a transition (crossDissolve, dipToBlack, dipToWhite, wipe, slide, zoomThrough) across the cut between two adjacent clips. zoomThrough zooms into a rect of the outgoing frame until the incoming clip fills the screen and needs no spare footage.",
  "transition/remove": "Remove a transition.",
  "transition/update": "Update a transition's duration, kind, or params.",
};

/** The tool-definition shapes the three big vendor APIs take. */
export type ToolStyle = "anthropic" | "openai" | "gemini";

/** One tool definition in a vendor's shape. */
export function toolDefinition(style: ToolStyle, name: string, description: string, schema: unknown): unknown {
  if (style === "openai") return { type: "function", function: { name, description, parameters: schema } };
  if (style === "gemini") return { name, description, parametersJsonSchema: schema };
  return { name, description, input_schema: schema };
}

export interface ToToolDefinitionsOptions {
  /**
   * Wire shape: "anthropic" (default) → `{ name, description, input_schema }`;
   * "openai" → `{ type: "function", function: { name, description, parameters } }`;
   * "gemini" → `{ name, description, parametersJsonSchema }` (a function
   * declaration: wrap the list in `[{ functionDeclarations }]`).
   */
  style?: ToolStyle;
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
  const wrap = (name: string, description: string, schema: unknown): unknown => toolDefinition(style, name, description, schema);
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

/** Only fields that were set — defaults stay invisible, keeping the summary compact. */
function typographySummary(t: Typography & { textAlign?: TextAlign }): string {
  const parts: string[] = [];
  if (t.fontWeight !== undefined) parts.push(`weight ${t.fontWeight}`);
  if (t.fontStyle !== undefined) parts.push(t.fontStyle);
  if (t.lineHeight !== undefined) parts.push(`lineHeight ${t.lineHeight}`);
  if (t.letterSpacing !== undefined) parts.push(`letterSpacing ${t.letterSpacing}em`);
  if (t.textAlign !== undefined) parts.push(`align ${t.textAlign}`);
  return parts.join(", ");
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
  if ("volume" in clip) {
    const c = clip as { volume: number; fadeInUs?: number; fadeOutUs?: number };
    if (c.volume !== 1) extra += ` vol ${c.volume}`;
    if (c.fadeInUs) extra += ` fade-in ${formatUs(c.fadeInUs)}`;
    if (c.fadeOutUs) extra += ` fade-out ${formatUs(c.fadeOutUs)}`;
    const speed = (clip as { speed?: number }).speed;
    if (speed === 0) extra += " freeze";
    else if (speed !== undefined && speed !== 1) extra += ` speed ${speed}x`;
  }
  const typography =
    clip.kind === "text" ? typographySummary(clip as TextClip)
    : clip.kind === "caption" && "style" in clip ? typographySummary((clip as CaptionClip).style)
    : "";
  if (typography) extra += ` {${typography}}`;
  const effects = clip.effects?.length ? ` [${clip.effects.length} effect${clip.effects.length > 1 ? "s" : ""}]` : "";
  const animated = clip.animations
    ? Object.entries(clip.animations)
        .filter(([, list]) => list && list.length)
        .map(([prop, list]) => (list!.some((k) => k.anchor === "end") ? `${prop} (some from end)` : prop))
    : [];
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
    `Miraiclip project — ${settings.width}x${settings.height} @ ${formatFrameRate(projectFrameRate(settings))}fps. ` +
      `Composition length: ${formatUs(endUs)} (${(endUs / 1_000_000).toFixed(2)}s). ` +
      `All command times are MICROSECONDS (1 second = 1000000us).`,
  );

  const assets = Object.values(doc.assets).sort((a, b) => a.id.localeCompare(b.id));
  lines.push(assets.length === 0 ? "assets: (none)" : "assets:");
  for (const asset of assets) {
    const duration = asset.durationUs !== undefined ? `, ${formatUs(asset.durationUs)}` : "";
    const name = asset.name ? ` "${asset.name}"` : "";
    const license = asset.license ? `, license ${asset.license.id}${asset.license.commercial ? "" : " (non-commercial)"}` : "";
    lines.push(`- ${asset.id}${name}: ${asset.kind}${duration}${license}, src ${JSON.stringify(asset.src)}`);
  }

  lines.push("tracks (bottom to top):");
  for (const trackId of doc.trackOrder) {
    const track = doc.tracks[trackId];
    if (!track) continue;
    const clips = Object.values(doc.clips)
      .filter((clip) => clip.trackId === trackId)
      .sort((a, b) => a.startUs - b.startUs || a.id.localeCompare(b.id));
    const flags = [track.muted && "muted", track.solo && "solo", track.locked && "locked", track.hidden && "hidden"].filter(Boolean);
    lines.push(`- ${trackId} (${track.kind}${flags.length ? `, ${flags.join(", ")}` : ""}), ${clips.length} clip${clips.length === 1 ? "" : "s"}:`);
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

  const markers = listMarkers(doc);
  if (markers.length > 0) {
    lines.push("markers:");
    for (const marker of markers) {
      const span = marker.durationUs ? `..${formatUs(marker.timeUs + marker.durationUs)}` : "";
      lines.push(`- ${marker.id}: ${JSON.stringify(marker.label)} at ${formatUs(marker.timeUs)}${span}`);
    }
  }

  return lines.join("\n");
}
