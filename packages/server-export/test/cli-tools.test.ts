import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli-args.js";
import { formatCheck, parseCheckArgs, parseStillsArgs } from "../src/cli-tools.js";
import type { CheckShotResult } from "../src/check-shot.js";

describe("export flags", () => {
  it("turns --motion-blur into default shutter options and --workers into a worker count", () => {
    const a = parseCliArgs(["p.json", "--out", "o.mp4", "--motion-blur", "--workers", "4"]);
    expect(a.options.motionBlur).toEqual({});
    expect(a.workers).toBe(4);
  });
  it("is a single pass without blur by default", () => {
    const a = parseCliArgs(["p.json", "--out", "o.mp4"]);
    expect(a.options.motionBlur).toBeUndefined();
    expect(a.workers).toBe(1);
  });
  it("rejects a worker count that isn't a whole number of at least 1", () => {
    expect(() => parseCliArgs(["p.json", "--out", "o.mp4", "--workers", "0"])).toThrow(/whole number/);
    expect(() => parseCliArgs(["p.json", "--out", "o.mp4", "--workers", "2.5"])).toThrow(/whole number/);
  });
});

describe("stills arguments", () => {
  it("reads times, output folder, sheet and width", () => {
    expect(parseStillsArgs(["p.json", "--at", "1, 9.5,15", "--out-dir", "x", "--sheet", "--width", "640"])).toEqual({ projectPath: "p.json", times: [1, 9.5, 15], outDir: "x", sheet: true, width: 640 });
  });
  it("needs --at, and valid times", () => {
    expect(() => parseStillsArgs(["p.json"])).toThrow(/--at is required/);
    expect(() => parseStillsArgs(["p.json", "--at", "1,abc"])).toThrow(/times in seconds/);
    expect(() => parseStillsArgs(["p.json", "--at", "--sheet"])).toThrow(/needs a value/);
  });
});

describe("check arguments and report", () => {
  it("reads clip, json and strict", () => {
    expect(parseCheckArgs(["p.json", "--clip", "a", "--json", "--strict"])).toEqual({ projectPath: "p.json", clipId: "a", json: true, strict: true });
    expect(() => parseCheckArgs([])).toThrow(/usage/);
  });
  it("prints scores, boundaries and findings with their hints", () => {
    const result = {
      clips: [
        {
          clipId: "film", startSec: 0, report: {
            duration: 30, score: 0.75, carried: 3, anchored: 0, bare: 1, exempt: 0,
            boundaries: [{ label: "breakout", t: 15, kind: "carried", survivor: "#beam", note: "" }],
            findings: [{ rule: "framing", severity: "warning", t: 15.5, message: "photon is out of frame from 15.50 s", hint: "aim the camera at the subject" }],
          },
        },
        { clipId: "plain", startSec: 30, report: null, skipped: "not a stage sequence" },
      ],
      across: [],
      findings: [{ rule: "framing", severity: "warning", t: 15.5, message: "", hint: "" }],
    } as unknown as CheckShotResult;
    const text = formatCheck(result);
    expect(text).toMatch(/clip film @ 0s · 30s · carry score 0\.75/);
    expect(text).toMatch(/15\.00s breakout\s+carried · #beam/);
    expect(text).toMatch(/! framing @ 15\.50s: photon is out of frame[\s\S]*→ aim the camera/);
    expect(text).toMatch(/clip plain: skipped \(not a stage sequence\)/);
    expect(text).toMatch(/1 finding\(s\)/);
  });
});
