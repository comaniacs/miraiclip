/**
 * Batch rendering integration: hydrate per row and export through warm
 * export sessions, then verify each file with a DIFFERENT decoder (ffmpeg) —
 * corpus-style census checks (each row drives a distinct solid color), never
 * pixel-exact HTML. Needs a browser and ffmpeg — skips visibly otherwise.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { defineTemplate, rowsFromCsv, rowsFromNdjson } from "../src/index.js";
import { renderTemplateBatch } from "../src/render.js";

const run = promisify(execFile);
const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].filter(
  (p): p is string => p !== undefined && existsSync(p),
)[0];
const hasFfmpeg = existsSync("/usr/bin/ffmpeg") || process.env["PATH"] !== undefined;

function fixtureTemplate() {
  const project = createProject({ width: 320, height: 180, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "html", id: "card", trackId: "v1", startUs: 0, durationUs: 1_000_000,
        template: `<div style="width:100%;height:100%;background:{{bg}};color:#fff;font:700 24px sans-serif">{{label}}</div>`,
        params: { bg: "{{accent}}", label: "Hi {{name}}" },
      },
    });
  });
  return defineTemplate({
    name: "Census card",
    doc: project.toJSON(),
    fields: [
      { name: "name", type: "text" },
      { name: "accent", type: "color" },
    ],
  });
}

/** Decode frame 0's center 2×2 as rgb24 and average it. */
async function centerColor(file: string): Promise<{ r: number; g: number; b: number }> {
  const { stdout } = await run(
    "ffmpeg",
    ["-v", "error", "-i", file, "-frames:v", "1",
     "-vf", "crop=w=2:h=2:x=in_w/2-1:y=in_h/2-1",
     "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    { encoding: "buffer" as never },
  );
  const px = stdout as unknown as Buffer;
  const avg = (offset: number): number =>
    Math.round((px[offset]! + px[offset + 3]! + px[offset + 6]! + px[offset + 9]!) / 4);
  return { r: avg(0), g: avg(1), b: avg(2) };
}

describe.skipIf(browserPath === undefined || !hasFfmpeg)("renderTemplateBatch (integration)", () => {
  const outDir = path.join(tmpdir(), `miraiclip-templates-${process.pid}`);

  afterAll(async () => {
    await rm(outDir, { recursive: true, force: true });
  });

  it("renders each row to its own file (warm sessions, {field} naming), and each carries ITS color", async () => {
    const template = fixtureTemplate();
    const rows = [
      { name: "Red Row", accent: "#ff0000" },
      { name: "Green Row", accent: "#00ff00" },
      { name: "Blue Row", accent: "#0000ff" },
    ];
    const progress: number[] = [];
    const { rows: results, failed } = await renderTemplateBatch(template, rows, {
      out: `${outDir}/{name}.webm`,
      format: "webm",
      quality: "draft",
      range: { startUs: 0, endUs: 500_000 },
      concurrency: 2,
      browser: { executablePath: browserPath!, swiftshader: true },
      onProgress: ({ rowsDone }) => progress.push(rowsDone),
    });

    expect(failed).toEqual([]);
    expect(progress).toHaveLength(3);
    expect(results.map((row) => path.basename(row.filePath!)).sort()).toEqual([
      "Blue-Row.webm", "Green-Row.webm", "Red-Row.webm",
    ]);

    // Census: frame 0 of each file carries that row's color — verified by an
    // independent decoder. The colors are distinct per row, so a swapped or
    // stale hydration cannot pass.
    const tolerance = 30; // yuv420 + draft VP9 round trip on saturated colors
    const want = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
    ];
    for (let i = 0; i < results.length; i++) {
      const got = await centerColor(results[i]!.filePath!);
      const label = `row ${i} (${results[i]!.filePath}) got ${JSON.stringify(got)}`;
      expect(Math.abs(got.r - want[i]!.r), label).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(got.g - want[i]!.g), label).toBeLessThanOrEqual(tolerance);
      expect(Math.abs(got.b - want[i]!.b), label).toBeLessThanOrEqual(tolerance);
    }
  }, 240_000);

  it("a bad row fails alone — the rest of the batch still renders", async () => {
    const template = fixtureTemplate();
    const { rows: results, failed } = await renderTemplateBatch(
      template,
      [
        { name: "Good", accent: "#ff00ff" },
        { name: "Bad" }, // missing required accent
      ],
      {
        out: (data, index) => `${outDir}/partial-${index}.webm`,
        format: "webm",
        quality: "draft",
        range: { startUs: 0, endUs: 300_000 },
        browser: { executablePath: browserPath!, swiftshader: true },
      },
    );
    expect(results[0]!.ok).toBe(true);
    expect(existsSync(results[0]!.filePath!)).toBe(true);
    expect(failed).toHaveLength(1);
    expect(failed[0]!.issues?.some((i) => i.path === "data.accent")).toBe(true);
  }, 240_000);
});

describe("data rows", () => {
  it("CSV rows coerce to field types, quoted cells and empty cells behave", () => {
    const template = fixtureTemplate();
    const withNumber = defineTemplate({
      name: "n",
      doc: (() => {
        const project = createProject({ width: 64, height: 64, fps: 30 });
        project.transaction(() => {
          project.dispatch({ type: "track/add", payload: { id: "t", kind: "video" } });
          project.dispatch({
            type: "clip/add",
            payload: {
              kind: "html", id: "h", trackId: "t", startUs: 0, durationUs: 1,
              template: `<b>{{s}}</b>`, params: { s: "{{size}}", t: "{{title}}" },
            },
          });
        });
        return project.toJSON();
      })(),
      fields: [
        { name: "size", type: "number" },
        { name: "title", type: "text", default: "Untitled" },
      ],
    });
    const rows = rowsFromCsv(
      withNumber,
      'size,title\r\n42,"Hello, ""World"""\n7,\n',
    );
    expect(rows).toEqual([
      { size: 42, title: 'Hello, "World"' },
      { size: 7 }, // empty cell = not provided, default applies at hydrate
    ]);
    expect(template.fields.length).toBeGreaterThan(0); // fixture sanity
  });

  it("NDJSON rows parse per line", () => {
    expect(rowsFromNdjson('{"a":1}\n\n{"a":2}\n')).toEqual([{ a: 1 }, { a: 2 }]);
  });
});
