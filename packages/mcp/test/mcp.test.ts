/**
 * The MCP server driven exactly the way a client drives it: a real SDK Client
 * over an in-memory transport — tool listing, edits with structured failures,
 * transactional batches, undo/redo, autosave. Rendering tools (preview_frame,
 * export) are integration-tested separately when a browser exists.
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { ProjectDocument } from "@miraiclip/core";
import { createMcpServer } from "../src/server.js";
import { ProjectSession } from "../src/session.js";

interface ContentItem {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
}

function textOf(result: { content: unknown }): string {
  const items = result.content as ContentItem[];
  return items
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");
}

async function connectedClient(session: ProjectSession): Promise<Client> {
  const server = createMcpServer(session);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

describe("miraiclip MCP server (edit tools)", () => {
  let dir: string;
  let projectPath: string;
  let session: ProjectSession;
  let client: Client;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "miraiclip-mcp-"));
    projectPath = path.join(dir, "project.json");
    session = await ProjectSession.open({
      projectPath,
      defaults: { width: 640, height: 360, fps: 30 },
    });
    client = await connectedClient(session);
  });

  afterAll(async () => {
    await client.close();
    await session.close();
  });

  it("creates the project file on open and lists every tool", async () => {
    expect(existsSync(projectPath)).toBe(true);

    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name).sort();
    expect(names).toEqual([
      "apply_commands",
      "dispatch",
      "export",
      "get_command_schema",
      "get_project_json",
      "get_state",
      "list_commands",
      "preview_frame",
      "redo",
      "undo",
    ]);

    // The dispatch tool's schema carries the live command-type enum.
    const dispatch = tools.find((tool) => tool.name === "dispatch")!;
    const typeSchema = (dispatch.inputSchema as { properties: { type: { enum: string[] } } })
      .properties.type;
    expect(typeSchema.enum).toContain("clip/add");
    expect(typeSchema.enum).toContain("transition/add");
  });

  it("edits through dispatch and autosaves to the project file", async () => {
    const track = await client.callTool({
      name: "dispatch",
      arguments: { type: "track/add", payload: { id: "t1", kind: "video" } },
    });
    expect(track.isError ?? false).toBe(false);

    const clip = await client.callTool({
      name: "dispatch",
      arguments: {
        type: "clip/add",
        payload: { kind: "text", id: "c1", trackId: "t1", text: "hello", startUs: 0, durationUs: 2_000_000 },
      },
    });
    expect(clip.isError ?? false).toBe(false);

    const saved = JSON.parse(await readFile(projectPath, "utf8")) as ProjectDocument;
    expect(saved.clips["c1"]).toBeDefined();

    const state = await client.callTool({ name: "get_state", arguments: {} });
    expect(textOf(state)).toContain("640x360 @ 30fps");
    expect(textOf(state)).toContain("c1: text");
  });

  it("returns structured, self-correctable failures", async () => {
    const unknown = await client.callTool({
      name: "dispatch",
      arguments: { type: "clip/frobnicate", payload: {} },
    });
    expect(unknown.isError).toBe(true);
    const unknownError = JSON.parse(textOf(unknown)) as { kind: string; validTypes: string[] };
    expect(unknownError.kind).toBe("unknown-command");
    expect(unknownError.validTypes).toContain("clip/add");

    const invalid = await client.callTool({
      name: "dispatch",
      arguments: { type: "clip/move", payload: { clipId: "c1", startUs: "soon" } },
    });
    expect(invalid.isError).toBe(true);
    const invalidError = JSON.parse(textOf(invalid)) as { kind: string; issues: { path: string }[] };
    expect(invalidError.kind).toBe("invalid-payload");
    expect(invalidError.issues.some((issue) => issue.path === "startUs")).toBe(true);

    const rejected = await client.callTool({
      name: "dispatch",
      arguments: { type: "clip/remove", payload: { clipId: "nope" } },
    });
    expect(rejected.isError).toBe(true);
    expect((JSON.parse(textOf(rejected)) as { kind: string }).kind).toBe("rejected");
  });

  it("applies batches transactionally and undoes them as one step", async () => {
    const before = JSON.stringify(session.project.toJSON());

    const failed = await client.callTool({
      name: "apply_commands",
      arguments: {
        commands: [
          { type: "clip/split", payload: { clipId: "c1", atUs: 1_000_000, newClipId: "c1b" } },
          { type: "clip/remove", payload: { clipId: "ghost" } },
        ],
      },
    });
    expect(failed.isError).toBe(true);
    const failure = JSON.parse(textOf(failed)) as { failedIndex: number; applied: number };
    expect(failure.failedIndex).toBe(1);
    expect(failure.applied).toBe(0);
    expect(JSON.stringify(session.project.toJSON())).toBe(before); // rolled back

    const ok = await client.callTool({
      name: "apply_commands",
      arguments: {
        commands: [
          { type: "clip/split", payload: { clipId: "c1", atUs: 1_000_000, newClipId: "c1b" } },
          { type: "clip/move", payload: { clipId: "c1b", startUs: 1_500_000 } },
        ],
        label: "agent edit",
      },
    });
    expect(ok.isError ?? false).toBe(false);
    expect((JSON.parse(textOf(ok)) as { applied: number }).applied).toBe(2);

    const undone = await client.callTool({ name: "undo", arguments: {} });
    expect(textOf(undone)).toContain("undone");
    expect(JSON.stringify(session.project.toJSON())).toBe(before); // one step reverted the batch

    const redone = await client.callTool({ name: "redo", arguments: {} });
    expect(textOf(redone)).toContain("redone");
    expect(session.project.toJSON().clips["c1b"]).toBeDefined();
  });

  it("serves the command catalog", async () => {
    const list = await client.callTool({ name: "list_commands", arguments: {} });
    expect(textOf(list)).toContain("clip/add — ");

    const schema = await client.callTool({
      name: "get_command_schema",
      arguments: { type: "clip/move" },
    });
    const parsed = JSON.parse(textOf(schema)) as { properties: Record<string, unknown> };
    expect(parsed.properties["clipId"]).toBeDefined();

    const missing = await client.callTool({
      name: "get_command_schema",
      arguments: { type: "nope/nope" },
    });
    expect(missing.isError).toBe(true);
    expect(textOf(missing)).toContain("clip/add");
  });
});

// ---------------------------------------------------------------------------
// Rendering tools — need a browser (same convention as server-export tests).
// ---------------------------------------------------------------------------

const CANDIDATES = [
  process.env["MIRAICLIP_BROWSER"],
  "/opt/pw-browsers/chromium",
].filter((p): p is string => p !== undefined && existsSync(p));
const browserPath = CANDIDATES[0];

describe.skipIf(browserPath === undefined)("miraiclip MCP server (rendering tools)", () => {
  let dir: string;
  let session: ProjectSession;
  let client: Client;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "miraiclip-mcp-render-"));
    session = await ProjectSession.open({
      projectPath: path.join(dir, "project.json"),
      defaults: { width: 1920, height: 1080, fps: 30 },
      browser: { executablePath: browserPath!, swiftshader: true },
    });
    client = await connectedClient(session);
    await client.callTool({
      name: "apply_commands",
      arguments: {
        commands: [
          { type: "track/add", payload: { id: "t1", kind: "video" } },
          {
            type: "clip/add",
            payload: { kind: "text", id: "c1", trackId: "t1", text: "PREVIEW", startUs: 0, durationUs: 2_000_000 },
          },
        ],
      },
    });
  }, 60_000);

  afterAll(async () => {
    await client.close();
    await session.close();
  });

  it("preview_frame returns a PNG image scaled for prompts", async () => {
    const result = await client.callTool({
      name: "preview_frame",
      arguments: { timeUs: 500_000 },
    });
    expect(result.isError ?? false).toBe(false);
    const image = (result.content as ContentItem[]).find((item) => item.type === "image")!;
    expect(image.mimeType).toBe("image/png");
    const bytes = Uint8Array.from(Buffer.from(image.data!, "base64"));
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
    // 1920×1080 capped to 768 wide → 768×432 (the IHDR carries the size).
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    expect(view.getUint32(16)).toBe(768);
    expect(view.getUint32(20)).toBe(432);
    expect(textOf(result)).toContain("500000us");
  }, 120_000);

  it("export streams a WebM next to the project file", async () => {
    const result = await client.callTool({
      name: "export",
      arguments: { out: "out.webm", format: "webm", quality: "draft", rangeStartUs: 0, rangeEndUs: 500_000 },
    });
    expect(result.isError ?? false).toBe(false);
    const parsed = JSON.parse(textOf(result)) as { filePath: string; bytesWritten: number };
    expect(parsed.filePath).toBe(path.join(dir, "out.webm"));
    expect(parsed.bytesWritten).toBeGreaterThan(1_000);
    expect(existsSync(parsed.filePath)).toBe(true);
  }, 180_000);
});
