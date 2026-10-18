/**
 * Document plugins over MCP: with plugins allowed, adding a plugin to the
 * manifest makes its custom kinds valid for the agent's next commands, and
 * the preview page renders them. Without permission, the agent is told why.
 */
import { copyFile, mkdtemp } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { clipKindRegistration } from "@miraiclip/core";
import { callTool } from "../src/tools.js";
import { ProjectSession } from "../src/session.js";

const FIXTURE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../server-export/test/fixtures/box-plugin.mjs");
const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));

async function open(plugins?: Parameters<typeof ProjectSession.open>[0]["plugins"]) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "miraiclip-mcp-plugins-"));
  await copyFile(FIXTURE, path.join(dir, "box.mjs"));
  return ProjectSession.open({
    projectPath: path.join(dir, "p.json"),
    defaults: { width: 160, height: 90, fps: 30 },
    ...(plugins ? { plugins } : {}),
    ...(browserPath ? { browser: { executablePath: browserPath, swiftshader: true } } : {}),
  });
}
const textOf = (r: { content: { type: string; text?: string }[] }) => r.content.map((c) => c.text ?? "").join("\n");

let session: ProjectSession | undefined;
afterEach(async () => {
  await session?.close();
  session = undefined;
});

describe("MCP document plugins", () => {
  it("allowed: plugin/add makes the custom kind dispatchable; removing it unloads", async () => {
    session = await open({ allow: true });
    await callTool(session, "dispatch", { type: "plugin/add", payload: { name: "test-box", version: "1.0.0", url: "box.mjs" } });
    expect(clipKindRegistration("test/box")).toBeDefined();
    await callTool(session, "dispatch", { type: "track/add", payload: { id: "v", kind: "video" } });
    const added = await callTool(session, "dispatch", {
      type: "clip/add",
      payload: { kind: "test/box", id: "b", trackId: "v", startUs: 0, durationUs: 1_000_000, props: { color: "#ff0000" } },
    });
    expect(JSON.parse(textOf(added as never))).toEqual({ ok: true });
    if (browserPath) {
      const frame = await callTool(session, "preview_frame", { timeUs: 500_000 });
      expect((frame as { content: { type: string }[] }).content.some((c) => c.type === "image")).toBe(true);
    }
    await callTool(session, "dispatch", { type: "clip/remove", payload: { clipId: "b" } });
    await callTool(session, "dispatch", { type: "plugin/remove", payload: { name: "test-box" } });
    expect(clipKindRegistration("test/box")).toBeUndefined();
  }, 60_000);

  it("not allowed: the edit lands, and the agent is told why the kind is unknown", async () => {
    session = await open();
    const result = await callTool(session, "dispatch", { type: "plugin/add", payload: { name: "test-box", version: "1.0.0", url: "box.mjs" } });
    expect(JSON.parse(textOf(result as never)).pluginProblems[0]).toMatch(/does not allow/);
    expect(clipKindRegistration("test/box")).toBeUndefined();
  });
});
