import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatDoctor, isStale, newestFile, workspaceRoot } from "../src/doctor.js";

const at = (file: string, seconds: number) => { writeFileSync(file, "x"); utimesSync(file, seconds, seconds); };

describe("build freshness", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "doctor-"));
  mkdirSync(path.join(dir, "src/deep"), { recursive: true });
  mkdirSync(path.join(dir, "src/node_modules"), { recursive: true });
  at(path.join(dir, "src/a.ts"), 1_000);
  at(path.join(dir, "src/deep/b.ts"), 2_000);
  at(path.join(dir, "src/node_modules/ignored.js"), 9_000); // never counts as a source

  it("finds the newest source, skipping node_modules", () => {
    expect(newestFile([path.join(dir, "src")])?.file).toBe(path.join(dir, "src/deep/b.ts"));
  });
  it("calls an output older than its newest source stale, and a newer one current", () => {
    const out = path.join(dir, "out.js");
    at(out, 1_500);
    expect(isStale(out, [path.join(dir, "src")]).stale).toBe(true);
    at(out, 3_000);
    expect(isStale(out, [path.join(dir, "src")]).stale).toBe(false);
  });
  it("calls a missing output stale", () => {
    expect(isStale(path.join(dir, "missing.js"), [path.join(dir, "src")]).stale).toBe(true);
  });
});

describe("workspace detection", () => {
  it("finds the monorepo root from this package's src, and nothing from elsewhere", () => {
    const src = path.resolve(__dirname, "../src");
    expect(workspaceRoot(src)).toBe(path.resolve(src, "../../.."));
    expect(workspaceRoot(tmpdir())).toBeNull();
  });
});

describe("report", () => {
  it("marks fixed, passing and failing checks", () => {
    const text = formatDoctor([
      { name: "export harness", ok: true, fixed: true, detail: "rebuilt" },
      { name: "browser", ok: true, detail: "chromium 140" },
      { name: "ffmpeg", ok: false, detail: "not on PATH" },
    ]);
    expect(text.split("\n")).toEqual([
      "FIXED  export harness    rebuilt",
      "  OK   browser           chromium 140",
      " FAIL  ffmpeg            not on PATH",
    ]);
  });
});
