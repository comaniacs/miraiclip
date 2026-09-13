/**
 * The export validation corpus (Gate 3), wave 1: every cell exports a small
 * project through the REAL pipeline (headless Chromium via exportProjectFile)
 * and verifies the file with ffmpeg/ffprobe — an independent decoder. Checks
 * are whole-file (every PTS, every frame's pixel), not spot samples.
 *
 * Cell results append to corpus-results.json — the ledger that release
 * success-rate claims count against.
 *
 * Wave 2 (tracked in PLAN.md): wipe/slide/dip transitions, captions/text
 * cells, PIP layering, the color-bars range/matrix cell, mp4 cells on real
 * Chrome, long-source fixtures.
 */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { exportProjectFile } from "../src/export-file.js";
import {
  audioMono,
  centerPixels,
  colorDistance,
  findBursts,
  fixtureColor,
  pixelAt,
  pixelFrameCount,
  probeContainer,
  rms,
  videoPtsSeconds,
} from "./ffcheck.js";
import { expectedFrames, mixColors, type FrameExpectation, type Segment } from "./expected.js";

const CANDIDATES = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].filter(
  (p): p is string => p !== undefined && existsSync(p),
);
const browserPath = CANDIDATES[0];
const FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/playground/public",
);
const RESULTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../corpus-results.json");
const OUT_DIR = mkdtempSync(path.join(os.tmpdir(), "mirai-corpus-"));

const TOLERANCE = 24; // yuv420 VP9 draft round trip, exact frames
const BLEND_TOLERANCE = 30; // blends add compositing + p-quantization slack
const TONE_RMS = 0.0885; // e2e-tone.webm's 440Hz tone at unity gain

// ---------------------------------------------------------------------------
// Document builders — plain core commands, the same surface users drive.
// ---------------------------------------------------------------------------

type Doc = ReturnType<ReturnType<typeof createProject>["getState"]>["doc"];

function buildDoc(
  build: (project: ReturnType<typeof createProject>) => void,
  size: { width: number; height: number; fps: number } = { width: 320, height: 180, fps: 30 },
): Doc {
  const project = createProject(size);
  project.transaction(() => build(project));
  return project.getState().doc;
}

function videoAsset(project: ReturnType<typeof createProject>, id: string, src: string, durationUs: number): void {
  project.dispatch({ type: "asset/add", payload: { id, kind: "video", src, durationUs } });
}

function videoTrack(project: ReturnType<typeof createProject>, id = "v1"): void {
  project.dispatch({ type: "track/add", payload: { id, kind: "video" } });
}

function videoClip(
  project: ReturnType<typeof createProject>,
  payload: { id: string; assetId?: string; startUs: number; durationUs: number; trimStartUs?: number; trackId?: string },
): void {
  project.dispatch({
    type: "clip/add",
    payload: { kind: "video", assetId: "media", trackId: "v1", trimStartUs: 0, ...payload },
  });
}

// ---------------------------------------------------------------------------
// Shared verifications
// ---------------------------------------------------------------------------

/** Whole-file PTS integrity: count, monotonic, tiling 1/fps (1ms timebase). */
async function assertPtsIntegrity(file: string, fps: number, durationUs: number): Promise<void> {
  const pts = await videoPtsSeconds(file);
  const expected = Math.max(1, Math.ceil((durationUs * fps) / 1_000_000));
  expect(pts.length, "frame count").toBe(expected);
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) expect(pts[i]!, `frame ${i} monotonic`).toBeGreaterThan(pts[i - 1]!);
    expect(Math.abs(pts[i]! - i / fps), `frame ${i} tiling`).toBeLessThan(0.002);
  }
}

/** Whole-file frame selection: every decoded center pixel vs the oracle. */
async function assertFrameSelection(file: string, expectations: FrameExpectation[]): Promise<void> {
  const pixels = await centerPixels(file);
  expect(pixelFrameCount(pixels), "decoded frame count").toBe(expectations.length);
  for (const expectation of expectations) {
    const got = pixelAt(pixels, expectation.n);
    const want =
      expectation.kind === "blend"
        ? mixColors(fixtureColor(expectation.frame), fixtureColor(expectation.inFrame!), expectation.p!)
        : fixtureColor(expectation.frame);
    const tolerance = expectation.kind === "blend" ? BLEND_TOLERANCE : TOLERANCE;
    expect(
      colorDistance(got, want),
      `frame ${expectation.n} (${expectation.kind}, sample ${expectation.sampleUs}µs): got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`,
    ).toBeLessThanOrEqual(tolerance);
  }
}

function record(cellId: string, data: Record<string, unknown>): void {
  let all: Record<string, unknown> = {};
  try {
    all = JSON.parse(readFileSync(RESULTS, "utf8")) as Record<string, unknown>;
  } catch {
    // first cell of the run
  }
  const existing = (all[cellId] ?? {}) as Record<string, unknown>;
  all[cellId] = { ...existing, ...data, at: new Date().toISOString() };
  writeFileSync(RESULTS, JSON.stringify(all, null, 2) + "\n");
}

async function exportCell(
  cellId: string,
  doc: Doc,
  options: { fps?: number; range?: { startUs: number; endUs: number }; audioChunkSeconds?: number } = {},
): Promise<string> {
  const outPath = path.join(OUT_DIR, `${cellId}.webm`);
  const started = Date.now();
  const result = await exportProjectFile(doc, {
    format: "webm",
    quality: "draft",
    assetsDir: FIXTURE_DIR,
    out: outPath,
    browser: { executablePath: browserPath! },
    ...options,
  });
  record(cellId, { pass: "pending", bytes: result.bytesWritten, wallSec: Number(((Date.now() - started) / 1000).toFixed(1)) });
  return outPath;
}

// ---------------------------------------------------------------------------
// The cells
// ---------------------------------------------------------------------------

describe.skipIf(browserPath === undefined)("export validation corpus", () => {
  it("single-clip: container, PTS, every frame exact, no phantom audio", async () => {
    const doc = buildDoc((p) => {
      videoAsset(p, "media", "e2e-frames.webm", 4_000_000);
      videoTrack(p);
      videoClip(p, { id: "c", startUs: 0, durationUs: 4_000_000 });
    });
    const file = await exportCell("single-clip", doc);
    const info = await probeContainer(file);
    expect(info.video).toMatchObject({ codec: "vp9", width: 320, height: 180 });
    expect(info.audio, "silent source must produce NO audio track").toBeNull();
    expect(Math.abs(info.durationS - 4)).toBeLessThan(0.05);
    await assertPtsIntegrity(file, 30, 4_000_000);
    const segments: Segment[] = [{ timelineStartUs: 0, timelineEndUs: 4_000_000, mediaStartUs: 0 }];
    await assertFrameSelection(file, expectedFrames({ segments, rangeStartUs: 0, rangeEndUs: 4_000_000, fps: 30 }));
    record("single-clip", { pass: true });
  });

  it("cuts-mid-gop: six cuts with staggered trims select exact frames throughout", async () => {
    const trims = [700_000, 1_500_000, 2_200_000, 300_000, 1_900_000, 1_100_000];
    const doc = buildDoc((p) => {
      videoAsset(p, "media", "e2e-frames.webm", 4_000_000);
      videoTrack(p);
      trims.forEach((trimStartUs, i) =>
        videoClip(p, { id: `c${i}`, startUs: i * 1_000_000, durationUs: 1_000_000, trimStartUs }),
      );
    });
    const file = await exportCell("cuts-mid-gop", doc);
    await assertPtsIntegrity(file, 30, 6_000_000);
    const segments: Segment[] = trims.map((trimStartUs, i) => ({
      timelineStartUs: i * 1_000_000,
      timelineEndUs: (i + 1) * 1_000_000,
      mediaStartUs: trimStartUs,
    }));
    await assertFrameSelection(file, expectedFrames({ segments, rangeStartUs: 0, rangeEndUs: 6_000_000, fps: 30 }));
    record("cuts-mid-gop", { pass: true });
  });

  it("dissolve: exact frames outside the window, blend math inside", async () => {
    const doc = buildDoc((p) => {
      videoAsset(p, "media", "e2e-frames.webm", 4_000_000);
      videoTrack(p);
      videoClip(p, { id: "a", startUs: 0, durationUs: 2_000_000 });
      videoClip(p, { id: "b", startUs: 2_000_000, durationUs: 1_000_000, trimStartUs: 2_800_000 });
      p.dispatch({
        type: "transition/add",
        payload: { id: "t", kind: "crossDissolve", fromClipId: "a", toClipId: "b", durationUs: 800_000 },
      });
    });
    const file = await exportCell("dissolve", doc);
    const segments: Segment[] = [
      { timelineStartUs: 0, timelineEndUs: 2_000_000, mediaStartUs: 0 },
      { timelineStartUs: 2_000_000, timelineEndUs: 3_000_000, mediaStartUs: 2_800_000 },
    ];
    await assertFrameSelection(
      file,
      expectedFrames({
        segments,
        dissolves: [{ cutUs: 2_000_000, durationUs: 800_000 }],
        rangeStartUs: 0,
        rangeEndUs: 3_000_000,
        fps: 30,
      }),
    );
    record("dissolve", { pass: true });
  });

  it("range: output rebases to the range start with exact selection", async () => {
    const doc = buildDoc((p) => {
      videoAsset(p, "media", "e2e-frames.webm", 4_000_000);
      videoTrack(p);
      videoClip(p, { id: "c", startUs: 0, durationUs: 4_000_000 });
    });
    const file = await exportCell("range", doc, { range: { startUs: 1_000_000, endUs: 3_000_000 } });
    const info = await probeContainer(file);
    expect(Math.abs(info.durationS - 2)).toBeLessThan(0.05);
    await assertPtsIntegrity(file, 30, 2_000_000);
    const segments: Segment[] = [{ timelineStartUs: 0, timelineEndUs: 4_000_000, mediaStartUs: 0 }];
    await assertFrameSelection(
      file,
      expectedFrames({ segments, rangeStartUs: 1_000_000, rangeEndUs: 3_000_000, fps: 30 }),
    );
    record("range", { pass: true });
  });

  it("fps-24: 30fps source resampled to 24fps output selects by midpoint", async () => {
    const doc = buildDoc((p) => {
      videoAsset(p, "media", "e2e-frames.webm", 4_000_000);
      videoTrack(p);
      videoClip(p, { id: "c", startUs: 0, durationUs: 4_000_000 });
    });
    const file = await exportCell("fps-24", doc, { fps: 24 });
    await assertPtsIntegrity(file, 24, 4_000_000);
    const segments: Segment[] = [{ timelineStartUs: 0, timelineEndUs: 4_000_000, mediaStartUs: 0 }];
    await assertFrameSelection(file, expectedFrames({ segments, rangeStartUs: 0, rangeEndUs: 4_000_000, fps: 24 }));
    record("fps-24", { pass: true });
  });

  it("opacity-ramp: keyframed opacity bakes as color·α over black", async () => {
    const doc = buildDoc((p) => {
      videoAsset(p, "media", "e2e-frames.webm", 4_000_000);
      videoTrack(p);
      videoClip(p, { id: "c", startUs: 0, durationUs: 4_000_000 });
      p.dispatch({ type: "keyframe/set", payload: { clipId: "c", property: "opacity", timeUs: 0, value: 0 } });
      p.dispatch({ type: "keyframe/set", payload: { clipId: "c", property: "opacity", timeUs: 2_000_000, value: 1 } });
    });
    const file = await exportCell("opacity-ramp", doc);
    const pixels = await centerPixels(file);
    const segments: Segment[] = [{ timelineStartUs: 0, timelineEndUs: 4_000_000, mediaStartUs: 0 }];
    for (const e of expectedFrames({ segments, rangeStartUs: 0, rangeEndUs: 4_000_000, fps: 30 })) {
      const alpha = Math.min(1, e.sampleUs / 2_000_000); // linear ramp, then hold
      const want = mixColors({ r: 0, g: 0, b: 0 }, fixtureColor(e.frame), alpha);
      expect(
        colorDistance(pixelAt(pixels, e.n), want),
        `frame ${e.n} α=${alpha.toFixed(2)}`,
      ).toBeLessThanOrEqual(BLEND_TOLERANCE);
    }
    record("opacity-ramp", { pass: true });
  });

  it("audio-unity: the tone survives at unity gain", async () => {
    const doc = buildDoc((p) => {
      videoAsset(p, "media", "e2e-tone.webm", 4_000_000);
      videoTrack(p);
      videoClip(p, { id: "c", startUs: 0, durationUs: 4_000_000 });
    });
    const file = await exportCell("audio-unity", doc);
    const info = await probeContainer(file);
    expect(info.audio).not.toBeNull();
    const samples = await audioMono(file);
    expect(Math.abs(rms(samples, 48_000, 1, 3) - TONE_RMS)).toBeLessThan(0.02);
    record("audio-unity", { pass: true });
  });

  it("audio-mid-start: leading silence is real samples, then unity tone", async () => {
    const doc = buildDoc((p) => {
      videoAsset(p, "media", "e2e-frames.webm", 4_000_000);
      videoAsset(p, "tone", "e2e-tone.webm", 4_000_000);
      videoTrack(p);
      videoClip(p, { id: "bg", startUs: 0, durationUs: 6_000_000, trimStartUs: 0 });
      videoClip(p, { id: "t", assetId: "tone", startUs: 2_000_000, durationUs: 4_000_000, trackId: "v1" });
    });
    // 1s audio chunks force real silent chunks before the tone starts.
    const file = await exportCell("audio-mid-start", doc, { audioChunkSeconds: 1 });
    const info = await probeContainer(file);
    expect(info.audio).not.toBeNull();
    expect(Math.abs(info.durationS - 6)).toBeLessThan(0.1);
    const samples = await audioMono(file);
    expect(rms(samples, 48_000, 0.1, 1.9), "leading silence").toBeLessThan(0.005);
    expect(Math.abs(rms(samples, 48_000, 3, 5) - TONE_RMS), "tone at unity").toBeLessThan(0.02);
    record("audio-mid-start", { pass: true });
  });

  it("volume-fade: keyframed volume decays in the decoded audio", async () => {
    const doc = buildDoc((p) => {
      videoAsset(p, "media", "e2e-tone.webm", 4_000_000);
      videoTrack(p);
      videoClip(p, { id: "c", startUs: 0, durationUs: 4_000_000 });
      p.dispatch({ type: "keyframe/set", payload: { clipId: "c", property: "volume", timeUs: 0, value: 1 } });
      p.dispatch({ type: "keyframe/set", payload: { clipId: "c", property: "volume", timeUs: 4_000_000, value: 0 } });
    });
    const file = await exportCell("volume-fade", doc);
    const samples = await audioMono(file);
    const early = rms(samples, 48_000, 0.2, 0.7);
    const late = rms(samples, 48_000, 3.3, 3.8);
    expect(early).toBeGreaterThan(TONE_RMS * 0.7);
    expect(early / Math.max(late, 1e-6), `early ${early} vs late ${late}`).toBeGreaterThan(3);
    record("volume-fade", { pass: true });
  });

  it("sync: A/V offset ≤ 1 frame at the first AND last burst, no drift", async () => {
    const doc = buildDoc((p) => {
      videoAsset(p, "media", "corpus-sync.webm", 8_000_000);
      videoTrack(p);
      videoClip(p, { id: "c", startUs: 0, durationUs: 8_000_000 });
    });
    const file = await exportCell("sync", doc);
    const samples = await audioMono(file);
    const bursts = findBursts(samples, 48_000);
    expect(bursts.length).toBeGreaterThanOrEqual(7);
    // Bursts belong at whole seconds; video PTS tile from 0, so burst offset
    // IS the A/V offset. One output frame at 30fps = 33.3ms.
    const offsets = bursts.map((b) => b - Math.round(b));
    const first = offsets[0]!;
    const last = offsets.at(-1)!;
    expect(Math.abs(first), `first burst offset ${first}`).toBeLessThan(1 / 30);
    expect(Math.abs(last), `last burst offset ${last}`).toBeLessThan(1 / 30);
    expect(Math.abs(last - first), "drift across the file").toBeLessThan(1 / 30);
    record("sync", { pass: true, offsetFirstMs: Math.round(first * 1000), offsetLastMs: Math.round(last * 1000) });
  });

  it("streamed-equals-buffered: the same export byte-matches both ways", async () => {
    const doc = buildDoc((p) => {
      videoAsset(p, "media", "e2e-frames.webm", 4_000_000);
      videoTrack(p);
      videoClip(p, { id: "c", startUs: 0, durationUs: 2_000_000 });
    });
    const streamedPath = await exportCell("streamed-equals-buffered", doc);
    const buffered = await exportProjectFile(doc, {
      format: "webm",
      quality: "draft",
      assetsDir: FIXTURE_DIR,
      browser: { executablePath: browserPath! },
    });
    const streamed = readFileSync(streamedPath);
    expect(streamed.byteLength).toBe(buffered.bytes!.byteLength);
    expect(streamed.equals(Buffer.from(buffered.bytes!)), "byte-identical").toBe(true);
    record("streamed-equals-buffered", { pass: true, bytes: streamed.byteLength });
  });
});

it("notes why the corpus ran or skipped", () => {
  // eslint-disable-next-line no-console
  console.log(browserPath ? `corpus browser: ${browserPath}` : "corpus SKIPPED: no browser found");
});
