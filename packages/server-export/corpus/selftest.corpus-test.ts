/**
 * Verifier self-test: run every ffmpeg-based check against the sync fixture
 * itself, whose ground truth is known by construction. Proves the fixture AND
 * the verification primitives before any export is judged by them — a broken
 * verifier passing everything is worse than no corpus. Needs ffmpeg/ffprobe
 * on PATH and no browser.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  audioMono,
  centerPixels,
  colorDistance,
  findBursts,
  fixtureColor,
  pixelAt,
  probeContainer,
  rms,
  videoPtsSeconds,
} from "./ffcheck.js";

const FIXTURE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/playground/public/corpus-sync.webm",
);
const DECODE_TOLERANCE = 24; // yuv420 VP9 at fixture bitrate

describe("corpus verifiers against the sync fixture's ground truth", () => {
  it("container: 8s, 320×180 VP9 + Opus", async () => {
    const info = await probeContainer(FIXTURE);
    expect(info.video).toMatchObject({ codec: "vp9", width: 320, height: 180 });
    expect(info.audio).toMatchObject({ codec: "opus", channels: 1 });
    expect(Math.abs(info.durationS - 8)).toBeLessThan(0.1);
    expect(info.streamCount).toBe(2);
  });

  it("PTS integrity: 240 frames tiling 1/30s, strictly increasing", async () => {
    const pts = await videoPtsSeconds(FIXTURE);
    expect(pts.length).toBe(240);
    expect(pts[0]).toBe(0);
    for (let i = 1; i < pts.length; i++) {
      expect(pts[i]!, `frame ${i}`).toBeGreaterThan(pts[i - 1]!);
      // Container timebase is 1ms — tiling holds to that rounding.
      expect(Math.abs(pts[i]! - i / 30), `frame ${i}`).toBeLessThan(0.002);
    }
  });

  it("pixel oracle: every frame's center decodes to its own index color", async () => {
    const pixels = await centerPixels(FIXTURE);
    expect(pixels.length).toBe(240 * 12);
    for (let n = 0; n < 240; n++) {
      const got = pixelAt(pixels, n);
      const want = fixtureColor(n);
      expect(colorDistance(got, want), `frame ${n}: got ${JSON.stringify(got)}`).toBeLessThanOrEqual(
        DECODE_TOLERANCE,
      );
    }
  });

  it("audio: bursts start at each whole second, silence between", async () => {
    const samples = await audioMono(FIXTURE);
    const bursts = findBursts(samples, 48_000);
    // Bursts at 0,1,…,7 (t=0 included: mod(0,1)<0.02).
    expect(bursts.length).toBe(8);
    bursts.forEach((onset, index) => {
      expect(Math.abs(onset - index), `burst ${index} at ${onset}`).toBeLessThan(0.01);
    });
    // Between bursts: silence (codec noise floor only).
    expect(rms(samples, 48_000, 0.5, 0.9)).toBeLessThan(0.005);
    // Inside a burst: real signal.
    expect(rms(samples, 48_000, 3.0, 3.02)).toBeGreaterThan(0.2);
  });
});
