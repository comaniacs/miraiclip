import {
  applyBeatGrid,
  applyCommands,
  planSoundFromEvents,
  commandTypeForTool,
  describeProject,
  toToolDefinitions,
  tryDispatch,
} from "@miraiclip/core";
import type { AudioClip, HtmlClip } from "@miraiclip/core";
import type { ProjectSession } from "./session.js";

/** The MCP tool-result shape (structured content list + error flag). */
export interface ToolResult {
  // The SDK's ServerResult union expects an open shape.
  [key: string]: unknown;
  content: ({ type: "text"; text: string } | { type: "image"; data: string; mimeType: string })[];
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const US_NOTE = "All times are integer MICROSECONDS (1 second = 1000000).";

function text(value: unknown): ToolResult {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  };
}

function failure(value: unknown): ToolResult {
  return { ...text(value), isError: true };
}

/**
 * The dispatch/apply payload contract comes from core's own dispatch-mode
 * tool definition, so the `type` enum always matches the live catalog
 * (registered custom commands included).
 */
function dispatchSchema(session: ProjectSession): Record<string, unknown> {
  const [tool] = toToolDefinitions(session.project.commandCatalog(), { mode: "dispatch" }) as {
    input_schema: Record<string, unknown>;
  }[];
  return tool!.input_schema;
}

export function listTools(session: ProjectSession): ToolDefinition[] {
  const command = dispatchSchema(session);
  return [
    {
      name: "get_state",
      description:
        "The current project state as a compact summary: composition settings, assets, tracks with their clips (ids, kinds, time ranges), and transitions. Read this before editing — commands reference the ids it shows. " +
        US_NOTE,
      inputSchema: {
        type: "object",
        properties: {
          include_json: {
            type: "boolean",
            description: "Also include the full project document as JSON (verbose — only when exact field values are needed).",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "list_commands",
      description:
        "Every editing command the project accepts, with a one-line description each. Use get_command_schema for a command's payload schema.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "get_command_schema",
      description: "The JSON Schema for one command type's payload.",
      inputSchema: {
        type: "object",
        properties: { type: { type: "string", description: 'The command type, e.g. "clip/add".' } },
        required: ["type"],
        additionalProperties: false,
      },
    },
    {
      name: "dispatch",
      description:
        "Apply ONE editing command to the project. On success the project autosaves. On failure nothing changes and the error says exactly what to fix: unknown-command lists the valid types, invalid-payload lists per-field issues, rejected carries the engine's reason code. " +
        US_NOTE,
      inputSchema: command,
    },
    {
      name: "apply_commands",
      description:
        "Apply a BATCH of commands as one transaction: all-or-nothing (a failure rolls back everything and reports which index broke), and the whole batch undoes as a single step. Prefer this over many dispatch calls for a multi-command plan. " +
        US_NOTE,
      inputSchema: {
        type: "object",
        properties: {
          commands: { type: "array", items: command, minItems: 1 },
          label: { type: "string", description: "Optional history label for the batch." },
        },
        required: ["commands"],
        additionalProperties: false,
      },
    },
    {
      name: "undo",
      description: "Undo the last edit (one dispatch, or one whole apply_commands batch). Returns the resulting state summary.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "redo",
      description: "Redo the last undone edit. Returns the resulting state summary.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "preview_frame",
      description:
        "Render the composition at a timeline position and SEE the frame (PNG). Use it after edits to verify the result visually. Defaults to a preview-sized image; pass width/height for exact dimensions. " +
        US_NOTE,
      inputSchema: {
        type: "object",
        properties: {
          timeUs: { type: "integer", minimum: 0, description: "Composition time to render, in microseconds." },
          width: { type: "integer", minimum: 16 },
          height: { type: "integer", minimum: 16 },
        },
        required: ["timeUs"],
        additionalProperties: false,
      },
    },
    {
      name: "check_sequence",
      description:
        "Check a stage sequence (data-libs=\"stage\") as one continuous shot. Seeks it around every label and reports, per beat, what survives into the next one (carried / anchored / bare), subjects that leave the frame (data-keep-in-frame), beat spacing and stray hard cuts, as warnings with times and a hint for each. Nothing is rendered or exported; warnings never block an export. Run it after composing a sequence and fix the bare boundaries.",
      inputSchema: {
        type: "object",
        properties: {
          clipId: { type: "string", description: "Check only this html clip (default: every html clip)." },
          frames: { type: "boolean", description: "Also return a before/after frame pair (0.2 s either side) for up to 3 bare boundaries, so you can see what is replaced." },
        },
        additionalProperties: false,
      },
    },
    {
      name: "place_sfx_from_events",
      description:
        "Put sound effects on a continuous shot's hits. Reads the sound moments the sequence declared (tl.hit, plus presses, impacts, shakes and carry landings), adds one audio clip at each (the same sound for every hit of a kind, so the film keeps one material set), and optionally ducks a music clip under them. Add the sounds as audio assets first (search_audio / add_audio; prefer CC0 and keep to one material: all wood, or all glass). Audio clips have no pan yet, so where on screen a hit happened is reported but not applied. " +
        US_NOTE,
      inputSchema: {
        type: "object",
        properties: {
          clipId: { type: "string", description: "The html sequence clip." },
          sounds: { type: "object", description: 'Audio asset id per hit kind, e.g. { "impact": "thud", "click": "tick", "whoosh": "air" }. Kinds: impact, click, whoosh, land, shake.', additionalProperties: { type: "string" } },
          trackId: { type: "string", description: "Audio track for the effects (default: a track \"sfx\", created if missing)." },
          musicClipId: { type: "string", description: "A music audio clip to lower under the hits." },
          volume: { type: "number", minimum: 0, maximum: 4, description: "Effect level (default 0.8)." },
          duckTo: { type: "number", minimum: 0, maximum: 1, description: "Music level during a hit, as a fraction of its own (default 0.35)." },
        },
        required: ["clipId", "sounds"],
        additionalProperties: false,
      },
    },
    {
      name: "set_beat_grid",
      description:
        "Write a music beat grid onto a sequence so S.beat(n) and S.downbeat(n) land on the music. Pass the beats and downbeats in seconds from the start of the music (from `node mc.mjs beats <file>`), and the music clip so the offset between the music and the sequence is applied. Compose carries on S.beat / S.downbeat afterwards. " +
        US_NOTE,
      inputSchema: {
        type: "object",
        properties: {
          clipId: { type: "string", description: "The html sequence clip." },
          beats: { type: "array", items: { type: "number" }, description: "Beat times in seconds from the start of the music file." },
          downbeats: { type: "array", items: { type: "number" }, description: "First beat of each bar, in seconds." },
          musicClipId: { type: "string", description: "The music audio clip the grid belongs to (its start and trim set the offset)." },
          offsetSeconds: { type: "number", description: "Instead of musicClipId: how far into the music the sequence starts." },
        },
        required: ["clipId", "beats"],
        additionalProperties: false,
      },
    },
    {
      name: "export",
      description:
        "Export the project to a video file (streams to disk; headless Chrome). MP4 needs a real Chrome install — WebM works everywhere. Relative `out` paths land next to the project file. Add `motionBlur` ({} for the defaults) on FINAL exports only: fast motion smears like film instead of strobing, at the cost of render time; leave it off for drafts and previews.",
      inputSchema: {
        type: "object",
        properties: {
          out: { type: "string", description: "Output file path, e.g. final.webm" },
          format: { type: "string", enum: ["mp4", "webm"] },
          quality: { type: "string", enum: ["draft", "standard", "high"] },
          fps: { type: "number", exclusiveMinimum: 0 },
          width: { type: "integer", minimum: 16 },
          height: { type: "integer", minimum: 16 },
          rangeStartUs: { type: "integer", minimum: 0 },
          rangeEndUs: { type: "integer", minimum: 1 },
          motionBlur: {
            type: "object",
            description: "Shutter motion blur. {} takes the defaults.",
            properties: {
              shutterAngle: { type: "number", minimum: 0, maximum: 360, description: "Degrees the shutter is open (default 180)." },
              minSamples: { type: "integer", minimum: 2, maximum: 64, description: "Fewest sub-frames for a frame that moves (default 4)." },
              maxSamples: { type: "integer", minimum: 2, maximum: 64, description: "Most sub-frames per frame (default 32)." },
              gapPx: { type: "number", minimum: 0.5, maximum: 64, description: "Largest gap between sub-frames in output pixels (default 6)." },
            },
            additionalProperties: false,
          },
        },
        required: ["out", "format"],
        additionalProperties: false,
      },
    },
    {
      name: "get_project_json",
      description: "The full project document as JSON — exact field values, no elision. Verbose; prefer get_state.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ];
}

export async function callTool(
  session: ProjectSession,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const { project } = session;
  switch (name) {
    case "get_state": {
      const summary = describeProject(project.toJSON());
      return text(
        args["include_json"] === true
          ? `${summary}\n\nproject document:\n${JSON.stringify(project.toJSON(), null, 2)}`
          : summary,
      );
    }

    case "list_commands": {
      const catalog = project.commandCatalog();
      const types = Object.keys(catalog);
      const tools = toToolDefinitions(catalog) as { name: string; description: string }[];
      const lines = tools.map((tool) => {
        const type = commandTypeForTool(tool.name, types) ?? tool.name;
        return `${type} — ${tool.description}`;
      });
      return text(lines.join("\n"));
    }

    case "get_command_schema": {
      const type = String(args["type"] ?? "");
      const schema = project.commandCatalog()[type];
      if (schema === undefined) {
        return failure({
          error: `unknown command type "${type}"`,
          validTypes: Object.keys(project.commandCatalog()).sort(),
        });
      }
      return text(schema);
    }

    case "dispatch": {
      const result = tryDispatch(project, {
        type: String(args["type"] ?? ""),
        payload: args["payload"],
      });
      if (!result.ok) return failure(result.error);
      await session.save();
      return text(session.pluginProblems.length ? { ok: true, pluginProblems: session.pluginProblems } : { ok: true });
    }

    case "apply_commands": {
      const commands = (args["commands"] ?? []) as { type: string; payload: unknown }[];
      if (!Array.isArray(commands) || commands.length === 0) {
        return failure({ error: "commands must be a non-empty array of { type, payload }" });
      }
      const label = typeof args["label"] === "string" ? { label: args["label"] } : {};
      const result = applyCommands(project, commands, label);
      if (!result.ok) return failure(result);
      await session.save();
      return text(session.pluginProblems.length ? { ...result, pluginProblems: session.pluginProblems } : result);
    }

    case "undo": {
      const changed = project.undo();
      if (changed) await session.save();
      return text(
        `${changed ? "undone" : "nothing to undo"}\n\n${describeProject(project.toJSON())}`,
      );
    }

    case "redo": {
      const changed = project.redo();
      if (changed) await session.save();
      return text(
        `${changed ? "redone" : "nothing to redo"}\n\n${describeProject(project.toJSON())}`,
      );
    }

    case "preview_frame": {
      const timeUs = Number(args["timeUs"]);
      const settings = project.toJSON().settings;
      // Default to a preview-sized frame: images cost the agent context.
      const cap = 768;
      const scale = Math.min(1, cap / Math.max(settings.width, settings.height));
      const width = (args["width"] as number | undefined) ?? Math.round(settings.width * scale);
      const height = (args["height"] as number | undefined) ?? Math.round(settings.height * scale);
      const png = await session.preview({ timeUs, width, height });
      return {
        content: [
          { type: "image", data: Buffer.from(png).toString("base64"), mimeType: "image/png" },
          { type: "text", text: `frame at ${timeUs}us (${width}x${height})` },
        ],
      };
    }

    case "check_sequence": {
      const result = await session.checkSequence(args["clipId"] !== undefined ? { clipId: String(args["clipId"]) } : {});
      const out: ToolResult = text(result);
      if (args["frames"] === true) {
        const settings = project.toJSON().settings;
        const scale = Math.min(1, 512 / Math.max(settings.width, settings.height));
        const width = Math.round(settings.width * scale);
        const height = Math.round(settings.height * scale);
        const pairs = result.clips
          .flatMap((c) => (c.report?.boundaries ?? []).filter((b) => b.kind === "bare").map((b) => ({ label: b.label, at: c.startSec + b.t })))
          .slice(0, 3);
        for (const p of pairs) {
          for (const [name, dt] of [["before", -0.2], ["after", 0.2]] as const) {
            const png = await session.preview({ timeUs: Math.max(0, Math.round((p.at + dt) * 1_000_000)), width, height });
            out.content.push({ type: "image", data: Buffer.from(png).toString("base64"), mimeType: "image/png" });
            out.content.push({ type: "text", text: `${p.label} (${p.at.toFixed(2)} s), ${name}` });
          }
        }
      }
      return out;
    }

    case "place_sfx_from_events": {
      const doc = project.toJSON();
      const clipId = String(args["clipId"] ?? "");
      const seq = doc.clips[clipId];
      if (!seq || seq.kind !== "html") return failure({ error: `"${clipId}" is not an html clip` });
      const checked = await session.checkSequence({ clipId });
      const report = checked.clips.find((c) => c.clipId === clipId)?.report;
      if (!report) return failure({ error: checked.clips.find((c) => c.clipId === clipId)?.skipped ?? "the sequence could not be checked" });
      const named = (args["sounds"] ?? {}) as Record<string, string>;
      const sounds: Record<string, { assetId: string; durationUs: number }> = {};
      for (const [kind, assetId] of Object.entries(named)) {
        const asset = doc.assets[assetId];
        if (!asset || asset.kind !== "audio") return failure({ error: `sounds.${kind}: "${assetId}" is not an audio asset` });
        sounds[kind] = { assetId, durationUs: (asset as { durationUs?: number }).durationUs ?? 1_000_000 };
      }
      const music = args["musicClipId"] !== undefined ? doc.clips[String(args["musicClipId"])] : undefined;
      if (args["musicClipId"] !== undefined && (!music || music.kind !== "audio")) return failure({ error: `"${String(args["musicClipId"])}" is not an audio clip` });
      const trackId = args["trackId"] !== undefined ? String(args["trackId"]) : "sfx";
      const commands: { type: string; payload: unknown }[] = [];
      if (!doc.tracks[trackId]) commands.push({ type: "track/add", payload: { id: trackId, kind: "audio", name: "SFX" } });
      const plan = planSoundFromEvents({
        events: report.events,
        sequenceStartUs: seq.startUs,
        sounds,
        trackId,
        existingClipIds: Object.keys(doc.clips),
        ...(args["volume"] !== undefined ? { volume: Number(args["volume"]) } : {}),
        ...(args["duckTo"] !== undefined ? { duckTo: Number(args["duckTo"]) } : {}),
        ...(music ? { music: { clipId: music.id, startUs: music.startUs, durationUs: music.durationUs, volume: (music as AudioClip).volume } } : {}),
      });
      if (!plan.placements.length) return text({ ok: true, placed: 0, skipped: plan.skipped, events: report.events.length, note: "nothing placed: the sequence has no hits with a sound, add tl.hit calls or more kinds in sounds" });
      const result = applyCommands(project, [...commands, ...plan.commands] as never, { label: "sound from events" });
      if (!result.ok) return failure(result);
      await session.save();
      return text({ ok: true, placed: plan.placements.length, placements: plan.placements, skipped: plan.skipped, ducks: plan.ducks.length });
    }

    case "set_beat_grid": {
      const doc = project.toJSON();
      const clipId = String(args["clipId"] ?? "");
      const seq = doc.clips[clipId];
      if (!seq || seq.kind !== "html") return failure({ error: `"${clipId}" is not an html clip` });
      let offset = args["offsetSeconds"] !== undefined ? Number(args["offsetSeconds"]) : 0;
      if (args["musicClipId"] !== undefined) {
        const music = doc.clips[String(args["musicClipId"])];
        if (!music || music.kind !== "audio") return failure({ error: `"${String(args["musicClipId"])}" is not an audio clip` });
        offset = (seq.startUs - music.startUs + (music as AudioClip).trimStartUs) / 1_000_000;
      }
      const grid = applyBeatGrid((seq as HtmlClip).template, { beats: (args["beats"] ?? []) as number[], ...(Array.isArray(args["downbeats"]) ? { downbeats: args["downbeats"] as number[] } : {}) }, offset);
      if (!grid.found) return failure({ error: "the template has no stage root (data-libs=\"stage\")" });
      const result = applyCommands(project, [{ type: "clip/set-property", payload: { clipId, template: grid.template } }] as never, { label: "beat grid" });
      if (!result.ok) return failure(result);
      await session.save();
      return text({ ok: true, beats: grid.beats, downbeats: grid.downbeats, offsetSeconds: offset });
    }

    case "export": {
      const range =
        args["rangeStartUs"] !== undefined && args["rangeEndUs"] !== undefined
          ? { range: { startUs: Number(args["rangeStartUs"]), endUs: Number(args["rangeEndUs"]) } }
          : {};
      const result = await session.export({
        out: String(args["out"] ?? ""),
        format: args["format"] as "mp4" | "webm",
        ...(args["quality"] !== undefined ? { quality: args["quality"] as "draft" | "standard" | "high" } : {}),
        ...(args["fps"] !== undefined ? { fps: Number(args["fps"]) } : {}),
        ...(args["width"] !== undefined ? { width: Number(args["width"]) } : {}),
        ...(args["height"] !== undefined ? { height: Number(args["height"]) } : {}),
        ...(args["motionBlur"] !== undefined && typeof args["motionBlur"] === "object" && args["motionBlur"] !== null
          ? { motionBlur: args["motionBlur"] as NonNullable<Parameters<typeof session.export>[0]["motionBlur"]> }
          : {}),
        ...range,
      });
      return text({ ok: true, filePath: result.filePath, bytesWritten: result.bytesWritten });
    }

    case "get_project_json":
      return text(project.toJSON());

    default:
      return failure({ error: `unknown tool "${name}"` });
  }
}
