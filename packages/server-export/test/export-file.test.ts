/**
 * Closed-loop integration: a real headless Chromium exports a real project
 * through the full server path (harness server → hydrate from JSON →
 * exportProject → bytes back over the wire), and the output container is
 * verified in Node by mediabunny's parser — an independent reader.
 *
 * Needs a browser: set MIRAICLIP_BROWSER, or rely on the well-known
 * container path below. Skips (with a visible reason) when none exists —
 * WebM only, since stock Chromium has no H.264 encoder.
 */
import { existsSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { ALL_FORMATS, BlobSource, Input } from "mediabunny";
import { exportProjectFile } from "../src/export-file.js";
import { ServerExportAbortedError } from "../src/types.js";

const CANDIDATES = [
  process.env["MIRAICLIP_BROWSER"],
  "/opt/pw-browsers/chromium",
].filter((p): p is string => p !== undefined && existsSync(p));
const browserPath = CANDIDATES[0];

const FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/playground/public",
);

function fixtureDoc(): ReturnType<ReturnType<typeof createProject>["getState"]>["doc"] {
  // e2e-frames.webm: 320×180, 30fps, 4s — every frame's color encodes its index.
  const project = createProject({ width: 320, height: 180, fps: 30 });
  project.transaction(() => {
    project.dispatch({
      type: "asset/add",
      payload: { id: "media", kind: "video", src: "e2e-frames.webm", durationUs: 4_000_000 },
    });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "video", id: "main", trackId: "v1", assetId: "media", startUs: 0, durationUs: 4_000_000 },
    });
  });
  return project.getState().doc;
}

describe.skipIf(browserPath === undefined)("exportProjectFile (integration)", () => {
  it("exports a project document to a valid WebM through headless Chromium", async () => {
    const outDir = await mkdtemp(path.join(os.tmpdir(), "mirai-export-"));
    const outPath = path.join(outDir, "out.webm");
    const progress: string[] = [];

    const result = await exportProjectFile(fixtureDoc(), {
      format: "webm",
      quality: "draft",
      assetsDir: FIXTURE_DIR,
      out: outPath,
      browser: { executablePath: browserPath! },
      onProgress: (p) => progress.push(p.phase),
    });

    // Bytes came back and hit the disk identically.
    expect(result.filePath).toBe(outPath);
    expect(result.bytes.length).toBeGreaterThan(1_000);
    expect(Uint8Array.from(await readFile(outPath))).toEqual(result.bytes);
    // EBML magic — it is a WebM container.
    expect([...result.bytes.slice(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3]);
    expect(progress).toContain("video");
    expect(progress.at(-1)).toBe("finalizing");

    // Independent verification: mediabunny (in Node) parses the container.
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(new Blob([result.bytes as BlobPart])),
    });
    const duration = await input.computeDuration();
    expect(Math.abs(duration - 4)).toBeLessThan(0.1);
    const video = await input.getPrimaryVideoTrack();
    expect(video).not.toBeNull();
    expect(video!.displayWidth).toBe(320);
    expect(video!.displayHeight).toBe(180);
    expect(await input.getPrimaryAudioTrack()).toBeNull(); // silent fixture
  }, 180_000);

  it("a range export produces exactly the range's duration", async () => {
    const result = await exportProjectFile(fixtureDoc(), {
      format: "webm",
      quality: "draft",
      range: { startUs: 1_000_000, endUs: 3_000_000 },
      assetsDir: FIXTURE_DIR,
      browser: { executablePath: browserPath! },
    });
    expect(result.filePath).toBeUndefined(); // no `out` — bytes only
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(new Blob([result.bytes as BlobPart])),
    });
    expect(Math.abs((await input.computeDuration()) - 2)).toBeLessThan(0.1);
  }, 180_000);

  it("aborting rejects with ServerExportAbortedError", async () => {
    const controller = new AbortController();
    const promise = exportProjectFile(fixtureDoc(), {
      format: "webm",
      quality: "draft",
      assetsDir: FIXTURE_DIR,
      browser: { executablePath: browserPath! },
      signal: controller.signal,
      onProgress: (p) => {
        if (p.phase === "video" && p.framesDone >= 5) controller.abort();
      },
    });
    await expect(promise).rejects.toThrow(ServerExportAbortedError);
  }, 180_000);

  it("a missing asset file fails fast, before any browser launches", async () => {
    const doc = fixtureDoc();
    await expect(
      exportProjectFile(doc, {
        format: "webm",
        assetsDir: "/nowhere",
        browser: { executablePath: "/definitely/not/chrome" }, // never reached
      }),
    ).rejects.toThrow(/asset "media"/);
  });
});

it("notes why integration ran or skipped", () => {
  // eslint-disable-next-line no-console
  console.log(
    browserPath ? `integration browser: ${browserPath}` : "integration SKIPPED: no browser found",
  );
});
