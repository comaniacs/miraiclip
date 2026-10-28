/**
 * Motion blur through the whole server path: a real headless Chromium exports
 * a fast-moving white square twice, with and without `motionBlur`, and ffmpeg
 * (an independent decoder) reads one frame back. A sharp export has a hard
 * edge (black, then white); a blurred one has a ramp between them.
 *
 * Needs a browser and ffmpeg; skips visibly without them.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { exportProjectFile } from "../src/export-file.js";

const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find((p): p is string => !!p && existsSync(p));
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

function movingSquare() {
  const project = createProject({ width: 320, height: 180, fps: 10 });
  project.transaction(() => {
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "html", id: "sq", trackId: "v1", startUs: 0, durationUs: 500_000, widthPx: 40, heightPx: 40,
        template: `<div style="width:100%;height:100%;background:#fff"></div>`, params: {},
      },
    });
    project.dispatch({ type: "keyframe/set", payload: { clipId: "sq", property: "x", timeUs: 0, value: 0.1 } });
    project.dispatch({ type: "keyframe/set", payload: { clipId: "sq", property: "x", timeUs: 500_000, value: 0.9 } });
  });
  return project.getState().doc;
}

/** Gray values along the middle row of frame `n`. */
function middleRow(file: string, n: number): number[] {
  const out = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `select=eq(n\\,${n})`, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 24 });
  expect(out.status).toBe(0);
  const gray = new Uint8Array(out.stdout);
  expect(gray.length).toBe(320 * 180);
  return Array.from(gray.subarray(90 * 320, 91 * 320));
}

const midValues = (row: number[]): number => row.filter((v) => v > 40 && v < 215).length;

describe.skipIf(browserPath === undefined || !hasFfmpeg)("motionBlur (integration)", () => {
  it("smears a fast mover into a ramp; a sharp export keeps a hard edge", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mirai-blur-"));
    const run = (name: string, motionBlur?: object) =>
      exportProjectFile(movingSquare(), {
        format: "webm", quality: "high", assetsDir: dir, out: path.join(dir, name),
        browser: { executablePath: browserPath! },
        ...(motionBlur ? { motionBlur } : {}),
      }).then(() => path.join(dir, name));
    const sharp = await run("sharp.webm");
    const blurred = await run("blurred.webm", {});

    const sharpRow = middleRow(sharp, 2);
    const blurRow = middleRow(blurred, 2);
    expect(Math.max(...blurRow)).toBeGreaterThan(200); // the square is still there
    expect(midValues(blurRow)).toBeGreaterThan(midValues(sharpRow) + 6); // and it has a smear (≈25 px of travel)
  }, 180_000);

  it("a static frame is identical to an export without blur (holds render once)", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "mirai-blur-"));
    const project = createProject({ width: 320, height: 180, fps: 10 });
    project.transaction(() => {
      project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
      project.dispatch({ type: "clip/add", payload: { kind: "html", id: "c", trackId: "v1", startUs: 0, durationUs: 300_000, template: `<div style="width:100%;height:100%;background:linear-gradient(90deg,#102030,#e0d0c0)"></div>`, params: {} } });
    });
    const doc = project.getState().doc;
    const run = (name: string, motionBlur?: object) =>
      exportProjectFile(doc, { format: "webm", quality: "high", assetsDir: dir, out: path.join(dir, name), browser: { executablePath: browserPath! }, ...(motionBlur ? { motionBlur } : {}) }).then(() => path.join(dir, name));
    const a = middleRow(await run("a.webm"), 0);
    const b = middleRow(await run("b.webm", {}), 0);
    const worst = Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));
    expect(worst).toBeLessThanOrEqual(3); // the copy path adds no tone change
  }, 180_000);
});
