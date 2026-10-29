/**
 * Distributed rendering against a single-pass export of the same document,
 * in real headless Chromium + ffmpeg: same frame count and duration, the
 * picture matches (PSNR), the sound is identical, chunks join without gaps.
 * Also the HTTP worker path (httpRunner → createRenderJobHandler).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyCommands, createProject, type ProjectDocument } from "@miraiclip/core";
import { createExportSession, type ExportSession } from "../src/export-session.js";
import { createRenderJobHandler, hasAudibleClips, httpRunner, localRunner, planChunks, renderDistributed, type RenderRunner } from "../src/distributed.js";

const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));
const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
const S = 1_000_000;

function doc(): ProjectDocument {
  const p = createProject({ width: 320, height: 180, fps: 30 });
  const r = applyCommands(p, [
    { type: "asset/add", payload: { id: "src", kind: "video", src: "src.webm", durationUs: 6 * S, width: 320, height: 180 } },
    { type: "track/add", payload: { id: "v", kind: "video" } },
    { type: "clip/add", payload: { kind: "video", id: "c", trackId: "v", assetId: "src", startUs: 0, durationUs: 6 * S } },
    { type: "track/add", payload: { id: "o", kind: "video" } },
    { type: "clip/add", payload: { kind: "html", id: "badge", trackId: "o", startUs: 1 * S, durationUs: 4 * S, widthPx: 120, heightPx: 40, template: `<div style="width:120px;height:40px;background:#fff;color:#000;font:bold 24px sans-serif">LIVE</div>`, transform: { x: 0.8, y: 0.15 } } },
    { type: "keyframe/set", payload: { clipId: "badge", property: "x", timeUs: 0, value: 0.2 } },
    { type: "keyframe/set", payload: { clipId: "badge", property: "x", timeUs: 4 * S, value: 0.8 } },
  ]);
  expect(r.ok).toBe(true);
  return p.getState().doc;
}

const probe = (file: string, entries: string, stream = "v:0") =>
  execFileSync("ffprobe", ["-v", "error", "-select_streams", stream, "-count_frames", "-show_entries", entries, "-of", "csv=p=0", file]).toString().trim();
const audioMd5 = (file: string) => execFileSync("ffmpeg", ["-v", "error", "-i", file, "-map", "0:a:0", "-f", "md5", "-"]).toString().trim();
/** Average PSNR of b against a, dB (Infinity when identical). */
const psnr = (a: string, b: string): number => {
  const log = execFileSync("sh", ["-c", `ffmpeg -hide_banner -i "${a}" -i "${b}" -lavfi "[0:v][1:v]psnr" -f null - 2>&1`]).toString();
  const avg = /average:([0-9.]+|inf)/.exec(log)?.[1];
  if (!avg) throw new Error(`no PSNR in ffmpeg output:\n${log.slice(-500)}`);
  return avg === "inf" ? Infinity : Number(avg);
};

describe("renderDistributed job options", () => {
  it("hands motion blur to every video chunk and not to the audio job", async () => {
    const seen: { kind: string; motionBlur: unknown }[] = [];
    // records each job, then stops the render: what was asked for is the contract under test
    const recorder: RenderRunner = { concurrency: 16, async run(job) { seen.push({ kind: job.kind, motionBlur: job.options.motionBlur }); throw new Error("recorded"); } };
    await expect(renderDistributed(doc(), { format: "mp4", runner: recorder, chunks: 3, out: "unused.mp4", motionBlur: { shutterAngle: 180 } })).rejects.toThrow("recorded");
    expect(seen.filter((j) => j.kind === "video")).toEqual(Array(3).fill({ kind: "video", motionBlur: { shutterAngle: 180 } }));
    expect(seen.find((j) => j.kind === "audio")?.motionBlur).toBeUndefined();
  });
});

describe("planChunks", () => {
  it("splits on frame boundaries and covers the range exactly", () => {
    const d = doc();
    const chunks = planChunks(d, { startUs: 0, endUs: 6 * S }, 4);
    expect(chunks[0]!.startUs).toBe(0);
    expect(chunks.at(-1)!.endUs).toBe(6 * S);
    for (let i = 1; i < chunks.length; i++) expect(chunks[i]!.startUs).toBe(chunks[i - 1]!.endUs);
    for (const c of chunks) expect(((c.startUs * 30) / S) % 1).toBeCloseTo(0, 6);
    expect(planChunks(d, { startUs: 0, endUs: 100_000 }, 10)).toHaveLength(3); // 3 frames at most 3 chunks
    expect(hasAudibleClips(d, { startUs: 0, endUs: 6 * S })).toBe(true);
  });
});

describe.skipIf(!browserPath || !hasFfmpeg)("renderDistributed (integration)", () => {
  let dir: string;
  let single: string;
  let session: ExportSession;
  const browser = { executablePath: browserPath!, swiftshader: true };

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "mc-dist-"));
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30:duration=6", "-f", "lavfi", "-i", "sine=frequency=330:duration=6", "-c:v", "libvpx-vp9", "-c:a", "libopus", "-shortest", "-y", path.join(dir, "src.webm")]);
    // WebM: headless Chromium builds without H.264 can't make MP4; the join path is the same.
    session = await createExportSession({ assetsDir: dir, browser });
    single = path.join(dir, "single.webm");
    await session.exportFile(doc(), { format: "webm", out: single });
  }, 180_000);
  afterAll(async () => {
    await session?.close();
  });

  it("chunked equals single pass: frames, sound, picture", async () => {
    const runner = localRunner({ assetsDir: dir, browser, concurrency: 2 });
    const out = path.join(dir, "dist.webm");
    const progress: string[] = [];
    try {
      const r = await renderDistributed(doc(), { format: "webm", runner, chunks: 3, out, onProgress: (p) => progress.push(`${p.phase}:${p.jobsDone}/${p.jobsTotal}`) });
      expect(r.chunks).toHaveLength(3);
      expect(r.hasAudio).toBe(true);
    } finally {
      await runner.close!();
    }
    expect(progress.at(-1)).toBe("join:4/4");
    expect(probe(out, "stream=nb_read_frames")).toBe(probe(single, "stream=nb_read_frames"));
    expect(probe(out, "stream=nb_read_frames")).toBe("180");
    // Same sound, bit for bit: it was mixed and encoded exactly as the single pass does.
    expect(audioMd5(out)).toBe(audioMd5(single));
    // Same picture, up to encoder differences around each chunk's first keyframe.
    expect(psnr(out, single)).toBeGreaterThan(35);
  }, 240_000);

  it("http workers: httpRunner → createRenderJobHandler", async () => {
    const handler = createRenderJobHandler({ assetsDir: dir, browser, token: "secret" });
    const runner: RenderRunner = httpRunner({ endpoints: "https://worker.test/render", headers: { authorization: "Bearer secret" }, concurrency: 2, fetch: async (url, init) => handler(new Request(url, init)) });
    const out = path.join(dir, "http.webm");
    try {
      await renderDistributed(doc(), { format: "webm", runner, chunks: 2, out });
      const denied = await handler(new Request("https://worker.test/render", { method: "POST", body: "{}" }));
      expect(denied.status).toBe(401);
    } finally {
      await handler.close();
    }
    expect(probe(out, "stream=nb_read_frames")).toBe("180");
    expect(audioMd5(out)).toBe(audioMd5(single));
  }, 240_000);
});
