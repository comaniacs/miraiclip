import { describe, expect, it } from "vitest";
import { shotCheckKey, shotWarnings, staleShotChecks } from "../src/index.js";

const report = {
  score: 0.25,
  findings: [
    { rule: "hard-cut", t: 7, message: "a hard cut at 7.00 s", hint: "hide it" },
    { rule: "bare-boundary", t: 4, message: "nothing survives the beat at 4.00 s", hint: "carry it" },
    { rule: "carry-score", t: null, message: "carry score 0.25", hint: "carry more" },
  ],
};

describe("shotWarnings", () => {
  it("places markers on the composition timeline in time order and keeps whole-sequence lines apart", () => {
    const m = shotWarnings("seq1", 10, report);
    expect(m.count).toBe(3);
    expect(m.markers.map((x) => [x.timeSec, x.rule])).toEqual([[14, "bare-boundary"], [17, "hard-cut"]]);
    expect(m.general).toEqual([{ rule: "carry-score", message: "carry score 0.25", hint: "carry more" }]);
    expect(m.score).toBe(0.25);
  });

  it("never blocks an export and handles a missing report", () => {
    expect(shotWarnings("a", 0, report).exportBlocked).toBe(false);
    expect(shotWarnings("a", 0, null)).toMatchObject({ count: 0, markers: [], score: null, exportBlocked: false });
  });
});

describe("staleShotChecks", () => {
  const seq = { kind: "html", template: '<div class="stage" data-libs="stage"></div>', params: {} };
  it("flags stage sequences never checked or edited since, and ignores everything else", () => {
    const clips = { a: seq, b: { kind: "html", template: "<p>x</p>", params: {} }, c: { kind: "text" } };
    expect(staleShotChecks({}, clips)).toEqual(["a"]);
    expect(staleShotChecks({ a: shotCheckKey(seq) }, clips)).toEqual([]);
    const edited = { ...clips, a: { ...seq, template: seq.template + " " } };
    expect(staleShotChecks({ a: shotCheckKey(seq) }, edited)).toEqual(["a"]);
  });
});
