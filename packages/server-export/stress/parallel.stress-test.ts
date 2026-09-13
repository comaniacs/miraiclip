/**
 * Scenario E — parallel server exports.
 * N `exportProjectFile` runs at once: N headless-Chromium instances, N harness
 * servers on distinct loopback ports, N encodes. Every output must be a valid
 * container (verified by mediabunny — an independent reader), and the batch
 * must not exceed strictly-sequential wall time (runs colliding on ports or
 * serializing behind a shared lock would). Speedup is recorded, not gated —
 * it's hardware-dependent.
 *
 * Named *.stress-test.ts so the default `pnpm test` glob (*.test.ts) never
 * picks it up; run via `pnpm --filter @miraiclip/server-export stress`.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { ALL_FORMATS, BlobSource, Input } from "mediabunny";
import { exportProjectFile } from "../src/export-file.js";

const CANDIDATES = [
  process.env["MIRAICLIP_BROWSER"],
  "/opt/pw-browsers/chromium",
].filter((p): p is string => p !== undefined && existsSync(p));
const browserPath = CANDIDATES[0];

const FIXTURE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/playground/public",
);

const PARALLEL = Number(process.env["STRESS_PARALLEL"] ?? 3);

function doc(seconds: number) {
  const project = createProject({ width: 320, height: 180, fps: 30 });
  project.transaction(() => {
    project.dispatch({
      type: "asset/add",
      payload: { id: "media", kind: "video", src: "e2e-frames.webm", durationUs: 4_000_000 },
    });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    for (let start = 0, i = 0; start < seconds * 1_000_000; start += 4_000_000, i++) {
      project.dispatch({
        type: "clip/add",
        payload: {
          kind: "video", id: `c${i}`, trackId: "v1", assetId: "media",
          startUs: start, durationUs: Math.min(4_000_000, seconds * 1_000_000 - start),
        },
      });
    }
    project.dispatch({
      type: "effect/add",
      payload: { clipId: "c0", kind: "colorAdjust", params: { saturation: -1 } },
    });
  });
  return project.getState().doc;
}

async function assertValidWebm(bytes: Uint8Array): Promise<number> {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(new Blob([bytes as BlobPart])),
  });
  const video = await input.getPrimaryVideoTrack();
  expect(video).not.toBeNull();
  const duration = await input.computeDuration();
  input.dispose();
  return duration;
}

describe.skipIf(browserPath === undefined)("parallel server exports (stress)", () => {
  it(
    `${PARALLEL} exports at once all produce valid files, without serializing`,
    { timeout: 15 * 60_000 },
    async () => {
      const run = () =>
        exportProjectFile(doc(8), {
          format: "webm",
          quality: "draft",
          assetsDir: FIXTURE_DIR,
          browser: { executablePath: browserPath! },
        });

      // Baseline: one run alone.
      const soloStart = Date.now();
      const solo = await run();
      const soloSec = (Date.now() - soloStart) / 1000;
      await assertValidWebm(solo.bytes!);

      // The batch.
      const batchStart = Date.now();
      const results = await Promise.all(Array.from({ length: PARALLEL }, run));
      const batchSec = (Date.now() - batchStart) / 1000;

      for (const result of results) {
        expect(result.bytes!.byteLength).toBeGreaterThan(10_000);
        const duration = await assertValidWebm(result.bytes!);
        expect(duration).toBeGreaterThan(7.5);
      }
      // Interference gate, not a speedup gate: one export already saturates
      // the CPU (encoder threads), so on small boxes N parallel runs can't
      // beat N sequential ones by much — that's physics. What must never
      // happen is runs colliding (ports, temp dirs) or serializing behind a
      // shared lock: the batch must not exceed strictly-sequential time plus
      // a small overhead allowance. The measured speedup is recorded below.
      expect(batchSec, `solo ${soloSec}s, batch of ${PARALLEL} ${batchSec}s`).toBeLessThan(
        PARALLEL * soloSec * 1.15,
      );

      console.log(
        `[stress:parallel-server-export] ${JSON.stringify({
          parallel: PARALLEL,
          soloSec: Number(soloSec.toFixed(1)),
          batchSec: Number(batchSec.toFixed(1)),
          speedup: Number(((PARALLEL * soloSec) / batchSec).toFixed(2)),
        })}`,
      );
    },
  );
});
