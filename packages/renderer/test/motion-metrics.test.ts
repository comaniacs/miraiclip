/**
 * Motion metrics, on hand-made series and on recorded ones: films the assistant made before
 * sequences existed (slide-like scenes joined by dissolves), measured at 192 px and 10 fps.
 * These are the calibration fixtures: each must fail the motion-graphics targets.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { changeSeries, frameChange, lumaFrame, motionFindings, motionMetrics, MOTION_TARGETS } from "../src/metrics/motion.js";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/motion/${name}.json`, import.meta.url), "utf8")) as { fps: number; changes: number[] };

describe("motion metrics", () => {
  it("converts RGBA to limited-range luma and measures change", () => {
    const black = lumaFrame(new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255]));
    const white = lumaFrame(new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]));
    expect(black[0]).toBeCloseTo(16);
    expect(white[0]).toBeCloseTo(235);
    expect(frameChange(black, white)).toBeCloseTo(219);
    expect(changeSeries([black, white, white])).toEqual([expect.closeTo(219), 0]);
    expect(() => frameChange(black, new Float32Array(3))).toThrow(/size/);
  });

  it("finds holds with their times, and allows an end-card hold", () => {
    // 1 s moving, 1.5 s still, 1 s moving, then 2 s still at the end (10 fps).
    const series = [...Array(10).fill(3), ...Array(15).fill(0.1), ...Array(10).fill(3), ...Array(20).fill(0)];
    const strict = motionMetrics(series, 10);
    expect(strict.holds).toEqual([
      { from: 1, to: 2.5 },
      { from: 3.5, to: 5.5 },
    ]);
    const endCard = motionMetrics(series, 10, { endHoldSeconds: 1.5, offsetSeconds: 10 });
    expect(endCard.holds).toEqual([{ from: 11, to: 12.5 }]); // 2 s at the end − 1.5 s allowed = 0.5 s: not a hold
    expect(strict.density).toBeCloseTo(20 / 55, 3);
  });

  it("finds isolated jumps but not sustained fast motion", () => {
    expect(motionMetrics([1, 1, 40, 1, 1], 10).jumps).toEqual([0.2]);
    expect(motionMetrics([20, 30, 40, 30, 20], 10).jumps).toEqual([]);
  });

  it("passes a continuously moving series and reports nothing", () => {
    const series = Array.from({ length: 130 }, (_, i) => 2.5 + Math.sin(i / 3));
    const report = motionMetrics(series, 10);
    expect(report.density).toBe(1);
    expect(motionFindings(report, MOTION_TARGETS.motion)).toEqual([]);
  });

  it("fails the slide-like films the assistant made before sequences", () => {
    for (const name of ["course-film", "environment-film", "nasa-film"]) {
      const f = fixture(name);
      const report = motionMetrics(f.changes, f.fps);
      const findings = motionFindings(report, MOTION_TARGETS.motion);
      expect(findings.map((x) => x.kind), name).toContain("density");
      expect(findings.some((x) => x.kind === "hold"), name).toBe(true);
    }
  });

  it("reproduces the recorded calibration of the 90 s documentary film", () => {
    const f = fixture("nasa-film");
    const report = motionMetrics(f.changes, f.fps);
    expect(Math.abs(report.density - 0.32)).toBeLessThan(0.01); // the stored series is rounded to 0.01
    expect(report.medianChange).toBeCloseTo(0.45, 1);
    // It fails even documentary pacing: long stretches of nothing.
    expect(motionFindings(report, MOTION_TARGETS.documentary).map((x) => x.kind)).toContain("density");
  });
});
