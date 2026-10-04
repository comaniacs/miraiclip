/**
 * Headless export frame parity at 29.97: a saved-and-reloaded project with
 * cuts on frame boundaries exports through real headless Chromium, and the
 * container (read back by mediabunny in Node) holds exactly the frames the
 * core frame rule predicts, at the predicted times.
 *
 * Needs a browser (MIRAICLIP_BROWSER or the container path); skips otherwise.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createProject, frameCount, frameToUs, projectFrameRate } from "@miraiclip/core";
import { ALL_FORMATS, BlobSource, EncodedPacketSink, Input } from "mediabunny";
import { exportProjectFile } from "../src/export-file.js";

const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find(
  (p): p is string => p !== undefined && existsSync(p),
);
const FIXTURE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../apps/playground/public");

const DURATION_US = 60_000_000;

function ntscDoc() {
  const project = createProject({ width: 320, height: 180, fps: 29.97 });
  const rate = projectFrameRate(project.getState().doc.settings);
  const total = frameCount(DURATION_US, rate);
  const lengths = [1, 2, 3, 7, 299, 30, 29]; // cuts on every phase of the 3-frame cycle
  project.transaction(() => {
    project.dispatch({ type: "asset/add", payload: { id: "bars", kind: "image", src: "corpus-bars.png" } });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    for (let i = 0, from = 0; from < total; i++) {
      const to = Math.min(total, from + lengths[i % lengths.length]!);
      const startUs = frameToUs(from, rate);
      project.dispatch({
        type: "clip/add",
        payload: { kind: "image", id: `c${i}`, trackId: "v1", assetId: "bars", startUs, durationUs: frameToUs(to, rate) - startUs },
      });
      from = to;
    }
  });
  // Save/reload: the export reads the document as JSON.
  return { doc: JSON.parse(JSON.stringify(project.toJSON())) as ReturnType<typeof project.toJSON>, total };
}

describe.skipIf(browserPath === undefined)("headless export frame parity (integration)", () => {
  it("a 29.97 export holds exactly the predicted frames at the predicted times", async () => {
    const { doc, total } = ntscDoc();
    const rate = projectFrameRate(doc.settings);
    expect(rate).toEqual({ num: 30000, den: 1001 });
    const endUs = Math.max(...Object.values(doc.clips).map((c) => c.startUs + c.durationUs));
    expect(frameCount(endUs, rate)).toBe(total); // 1,799

    let reportedTotal = 0;
    const result = await exportProjectFile(doc, {
      format: "webm",
      quality: "draft",
      assetsDir: FIXTURE_DIR,
      browser: { executablePath: browserPath! },
      onProgress: (p) => {
        if (p.totalFrames !== undefined) reportedTotal = p.totalFrames;
      },
    });
    expect(reportedTotal).toBe(total);

    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(new Blob([result.bytes as BlobPart])) });
    const track = (await input.getPrimaryVideoTrack())!;
    const timestamps: number[] = [];
    for await (const packet of new EncodedPacketSink(track).packets()) timestamps.push(packet.timestamp);
    timestamps.sort((a, b) => a - b);

    expect(timestamps).toHaveLength(total);
    // WebM stores milliseconds: each frame's time is its exact start, rounded to 1 ms.
    let bad = 0;
    timestamps.forEach((t, n) => {
      if (Math.abs(t * 1_000_000 - frameToUs(n, rate)) > 500.5) bad++;
    });
    expect(bad).toBe(0);
    // No drift at the end: the last frame starts where the frame rule says.
    expect(Math.abs(timestamps.at(-1)! * 1_000_000 - frameToUs(total - 1, rate))).toBeLessThanOrEqual(500.5);
    // The container's duration covers at least every frame start. (WebM written
    // by mediabunny stores no duration for the last block, so it reads one frame
    // short of the timeline end — a muxer limitation, not frame mapping.)
    const durationS = await input.computeDuration();
    expect(durationS).toBeGreaterThanOrEqual(frameToUs(total - 1, rate) / 1_000_000 - 0.001);
    expect(durationS).toBeLessThanOrEqual(endUs / 1_000_000 + 0.001);
  }, 300_000);
});
