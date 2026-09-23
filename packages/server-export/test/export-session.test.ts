/**
 * Integration for the persistent export session: one real headless Chromium
 * stays warm across calls and exports whole files through the same in-page
 * pipeline `exportProjectFile` uses. Needs a browser (MIRAICLIP_BROWSER or
 * the well-known path) — skips visibly when none exists.
 */
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { createExportSession, type ExportSession } from "../src/export-session.js";

const CANDIDATES = [
  process.env["MIRAICLIP_BROWSER"],
  "/opt/pw-browsers/chromium",
].filter((p): p is string => p !== undefined && existsSync(p));
const browserPath = CANDIDATES[0];

function colorDoc(color: string) {
  const project = createProject({ width: 320, height: 180, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "html", id: "card", trackId: "v1", startUs: 0, durationUs: 1_000_000,
        template: `<div style="width:100%;height:100%;background:{{color}}"></div>`,
        params: { color },
      },
    });
  });
  return project.toJSON();
}

describe.skipIf(browserPath === undefined)("createExportSession (integration)", () => {
  let session: ExportSession;
  const outDir = path.join(tmpdir(), `miraiclip-export-session-${process.pid}`);

  beforeAll(async () => {
    session = await createExportSession({
      browser: { executablePath: browserPath!, swiftshader: true },
    });
  }, 60_000);

  afterAll(async () => {
    await session?.close();
    await rm(outDir, { recursive: true, force: true });
  });

  it("exports two documents back to back on one warm page (in-memory and streamed)", async () => {
    const inMemory = await session.exportFile(colorDoc("#ff0000"), {
      format: "webm",
      quality: "draft",
      range: { startUs: 0, endUs: 500_000 },
    });
    expect(inMemory.bytes).toBeDefined();
    expect(inMemory.bytes!.byteLength).toBeGreaterThan(500); // a 0.5s solid-color draft WebM is tiny

    const out = path.join(outDir, "second.webm");
    let sawProgress = false;
    const streamed = await session.exportFile(colorDoc("#00ff00"), {
      format: "webm",
      quality: "draft",
      range: { startUs: 0, endUs: 500_000 },
      out,
      onProgress: () => {
        sawProgress = true;
      },
    });
    expect(streamed.filePath).toBe(out);
    expect(streamed.bytesWritten).toBeGreaterThan(500);
    expect(sawProgress).toBe(true);
    const written = await readFile(out);
    expect(written.byteLength).toBe(streamed.bytesWritten);
    // Both are valid WebM files (EBML magic).
    expect(Array.from(written.subarray(0, 4))).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
    expect(Array.from(inMemory.bytes!.subarray(0, 4))).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
  }, 120_000);

  it("a failed export rejects without wedging the session, and leaves no half file", async () => {
    const project = createProject({ width: 320, height: 180, fps: 30 });
    project.transaction(() => {
      project.dispatch({
        type: "asset/add",
        payload: { id: "ghost", kind: "video", src: "does-not-exist.webm", durationUs: 1_000_000 },
      });
      project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
      project.dispatch({
        type: "clip/add",
        payload: { kind: "video", id: "g1", trackId: "v1", assetId: "ghost", startUs: 0, durationUs: 1_000_000 },
      });
    });
    const out = path.join(outDir, "ghost.webm");
    await expect(
      session.exportFile(project.toJSON(), { format: "webm", quality: "draft", out }),
    ).rejects.toThrow(/no file at/);
    expect(existsSync(out)).toBe(false); // no half files

    // The queue recovers: the next export succeeds.
    const next = await session.exportFile(colorDoc("#0000ff"), {
      format: "webm",
      quality: "draft",
      range: { startUs: 0, endUs: 500_000 },
    });
    expect(next.bytes!.byteLength).toBeGreaterThan(500);
  }, 120_000);
});
