import { describe, expect, it } from "vitest";
import {
  applyCommands,
  commandTypeForTool,
  describeProject,
  toolNameForCommand,
  toToolDefinitions,
  tryDispatch,
} from "../src/ai.js";
import { createProject } from "../src/engine.js";
import type { Project } from "../src/engine.js";

function projectWithClip(): Project {
  const project = createProject({ width: 1920, height: 1080, fps: 30 });
  project.dispatch({
    type: "asset/add",
    payload: { id: "intro", kind: "video", src: "/media/intro.mp4", durationUs: 12_000_000 },
  });
  project.dispatch({ type: "track/add", payload: { id: "video-1", kind: "video" } });
  project.dispatch({
    type: "clip/add",
    payload: {
      kind: "video",
      id: "clip-1",
      trackId: "video-1",
      assetId: "intro",
      startUs: 0,
      durationUs: 5_000_000,
    },
  });
  return project;
}

describe("toolNameForCommand / commandTypeForTool", () => {
  it("sanitizes the slash and round-trips against the catalog", () => {
    expect(toolNameForCommand("clip/add")).toBe("clip_add");
    expect(toolNameForCommand("clip/set-property")).toBe("clip_set-property");

    const project = createProject({ width: 1280, height: 720, fps: 30 });
    const types = Object.keys(project.commandCatalog());
    for (const type of types) {
      expect(commandTypeForTool(toolNameForCommand(type), types)).toBe(type);
    }
    expect(commandTypeForTool("no_such_tool", types)).toBeUndefined();
  });
});

describe("toToolDefinitions", () => {
  const project = createProject({ width: 1280, height: 720, fps: 30 });
  const catalog = project.commandCatalog();

  it("emits one Anthropic-shaped tool per command, sorted, with real descriptions", () => {
    const tools = toToolDefinitions(catalog) as {
      name: string;
      description: string;
      input_schema: unknown;
    }[];
    expect(tools.length).toBe(Object.keys(catalog).length);

    const names = tools.map((tool) => tool.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    // Every name satisfies the LLM tool-name rule.
    for (const name of names) expect(name).toMatch(/^[a-zA-Z0-9_-]+$/);

    const clipAdd = tools.find((tool) => tool.name === "clip_add");
    expect(clipAdd).toBeDefined();
    expect(clipAdd!.description).toContain("microseconds");
    expect(clipAdd!.input_schema).toEqual(catalog["clip/add"]);
  });

  it("emits OpenAI function-calling shape on request", () => {
    const tools = toToolDefinitions(catalog, { style: "openai" }) as {
      type: string;
      function: { name: string; description: string; parameters: unknown };
    }[];
    expect(tools[0]!.type).toBe("function");
    const clipAdd = tools.find((tool) => tool.function.name === "clip_add");
    expect(clipAdd!.function.parameters).toEqual(catalog["clip/add"]);
  });

  it("dispatch mode collapses the catalog into a single tool with a type enum", () => {
    const tools = toToolDefinitions(catalog, { mode: "dispatch" }) as {
      name: string;
      input_schema: {
        properties: { type: { enum: string[] } };
        required: string[];
        additionalProperties: boolean;
      };
    }[];
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("miraiclip_dispatch");
    const schema = tools[0]!.input_schema;
    expect(schema.properties.type.enum).toEqual(Object.keys(catalog).sort());
    expect(schema.required).toEqual(["type", "payload"]);
    expect(schema.additionalProperties).toBe(false);
  });

  it("honors caller-supplied descriptions (custom commands)", () => {
    const tools = toToolDefinitions(catalog, {
      descriptions: { "clip/add": "Custom text." },
    }) as { name: string; description: string }[];
    expect(tools.find((tool) => tool.name === "clip_add")!.description).toBe("Custom text.");
  });
});

describe("tryDispatch", () => {
  it("returns ok for a valid command", () => {
    const project = projectWithClip();
    const result = tryDispatch(project, {
      type: "clip/move",
      payload: { clipId: "clip-1", startUs: 1_000_000 },
    });
    expect(result).toEqual({ ok: true });
    expect(project.toJSON().clips["clip-1"]!.startUs).toBe(1_000_000);
  });

  it("reports unknown-command with the list of valid types", () => {
    const project = projectWithClip();
    const result = tryDispatch(project, { type: "clip/frobnicate", payload: {} });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("unknown-command");
    expect(result.error.commandType).toBe("clip/frobnicate");
    expect(result.error.validTypes).toContain("clip/add");
    expect(result.error.validTypes).toEqual([...result.error.validTypes!].sort());
  });

  it("reports invalid-payload with per-field issues", () => {
    const project = projectWithClip();
    const result = tryDispatch(project, {
      type: "clip/move",
      payload: { clipId: "clip-1", startUs: "soon" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid-payload");
    expect(result.error.commandType).toBe("clip/move");
    expect(result.error.issues!.length).toBeGreaterThan(0);
    expect(result.error.issues!.some((issue) => issue.path === "startUs")).toBe(true);
  });

  it("reports rejected with the engine's rejection code", () => {
    const project = projectWithClip();
    const result = tryDispatch(project, {
      type: "clip/remove",
      payload: { clipId: "no-such-clip" },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("rejected");
    expect(result.error.commandType).toBe("clip/remove");
    expect(typeof result.error.code).toBe("string");
    expect(result.error.code!.length).toBeGreaterThan(0);
  });
});

describe("applyCommands", () => {
  it("applies a batch as one undoable transaction", () => {
    const project = projectWithClip();
    const before = project.toJSON();
    const result = applyCommands(
      project,
      [
        { type: "clip/split", payload: { clipId: "clip-1", atUs: 2_000_000, newClipId: "clip-1b" } },
        { type: "clip/move", payload: { clipId: "clip-1", startUs: 1_000_000 } },
      ],
      { label: "agent edit" },
    );
    expect(result).toEqual({ ok: true, applied: 2 });
    expect(Object.keys(project.toJSON().clips)).toContain("clip-1b");

    // One undo step reverts the whole batch.
    project.undo();
    expect(project.toJSON()).toEqual(before);
  });

  it("rolls back everything when a mid-batch command fails, reporting the index", () => {
    const project = projectWithClip();
    const before = project.toJSON();
    const result = applyCommands(project, [
      { type: "clip/split", payload: { clipId: "clip-1", atUs: 2_000_000, newClipId: "clip-1b" } },
      { type: "clip/remove", payload: { clipId: "does-not-exist" } },
      { type: "clip/move", payload: { clipId: "clip-1", startUs: 1_000_000 } },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.applied).toBe(0);
    expect(result.failedIndex).toBe(1);
    expect(result.error.kind).toBe("rejected");
    // The split from index 0 was rolled back — document unchanged.
    expect(project.toJSON()).toEqual(before);
  });
});

describe("describeProject", () => {
  it("summarizes settings, assets, tracks, clips, and transitions deterministically", () => {
    const project = projectWithClip();
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "video",
        id: "clip-2",
        trackId: "video-1",
        assetId: "intro",
        startUs: 5_000_000,
        durationUs: 3_000_000,
        trimStartUs: 1_000_000,
      },
    });
    project.dispatch({
      type: "transition/add",
      payload: {
        id: "t1",
        trackId: "video-1",
        fromClipId: "clip-1",
        toClipId: "clip-2",
        kind: "crossDissolve",
        durationUs: 500_000,
      },
    });
    project.dispatch({
      type: "keyframe/set",
      payload: { clipId: "clip-1", property: "opacity", timeUs: 0, value: 1 },
    });

    const text = describeProject(project.toJSON());
    expect(text).toContain("1920x1080 @ 30fps");
    expect(text).toContain("Composition length: 8000000us (8.00s)");
    expect(text).toContain("MICROSECONDS");
    expect(text).toContain('- intro: video, 12000000us, src "/media/intro.mp4"');
    expect(text).toContain("- video-1 (video), 2 clips:");
    expect(text).toContain("clip-1: video[intro] at 0us..5000000us");
    expect(text).toContain("clip-2: video[intro] trim 1000000us at 5000000us..8000000us");
    expect(text).toContain("[keyframes: opacity]");
    expect(text).toContain("- t1: crossDissolve between clip-1 -> clip-2, 500000us");

    // Deterministic: same document, same string.
    expect(describeProject(project.toJSON())).toBe(text);
  });

  it("elides the middle of very long tracks", () => {
    const project = createProject({ width: 1280, height: 720, fps: 30 });
    project.dispatch({ type: "track/add", payload: { id: "text-1", kind: "video" } });
    for (let i = 0; i < 60; i++) {
      project.dispatch({
        type: "clip/add",
        payload: {
          kind: "text",
          id: `text-${String(i).padStart(2, "0")}`,
          trackId: "text-1",
          text: `Line ${i}`,
          startUs: i * 1_000_000,
          durationUs: 900_000,
        },
      });
    }
    const text = describeProject(project.toJSON());
    expect(text).toContain("60 clips:");
    expect(text).toContain("… (10 more clips elided)");
    expect(text).toContain("text-00:");
    expect(text).toContain("text-59:");
    expect(text).not.toContain("text-30:");

    // A higher cap shows everything.
    const full = describeProject(project.toJSON(), { maxClipsPerTrack: 100 });
    expect(full).not.toContain("elided");
    expect(full).toContain("text-30:");
  });
});
