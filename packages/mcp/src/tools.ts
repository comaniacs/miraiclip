import {
  applyCommands,
  commandTypeForTool,
  describeProject,
  toToolDefinitions,
  tryDispatch,
} from "@miraiclip/core";
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
      name: "export",
      description:
        "Export the project to a video file (streams to disk; headless Chrome). MP4 needs a real Chrome install — WebM works everywhere. Relative `out` paths land next to the project file.",
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
      return text({ ok: true });
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
      return text(result);
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
