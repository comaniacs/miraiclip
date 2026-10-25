import { describe, expect, it } from "vitest";
import { lintSequence } from "../src/stage/lint.js";

const ok = `<div class="stage" data-libs="stage" data-duration="6"><style>.a{width:10cqw}</style><div class="world"><b class="a">Hi</b></div></div>
<script>stage.build((tl, S) => { tl.from(".a", { y: S.h(6), opacity: 0, duration: 0.6 }, 0).camera({ zoom: 1.1, duration: 2 }, "<"); });</script>`;

const rules = (t: string) => lintSequence(t).errors.map((e) => e.rule);

describe("lintSequence", () => {
  it("passes a well-formed sequence", () => {
    expect(lintSequence(ok)).toEqual({ errors: [], warnings: [] });
  });

  it("needs the stage library, a length and one build", () => {
    expect(rules("<div></div>")).toEqual(expect.arrayContaining(["libs", "duration", "build"]));
    expect(rules(ok.replace("</script>", "</script><script>stage.build(()=>{})</script>"))).toContain("build");
  });

  it("refuses what breaks determinism", () => {
    const bad = (code: string) => rules(ok.replace("tl.from", `${code}; tl.from`));
    expect(bad("const r = Math.random()")).toContain("random");
    expect(bad("const t = Date.now()")).toContain("clock");
    expect(bad("requestAnimationFrame(f)")).toContain("async-loop");
    expect(bad("fetch('/x')")).toContain("network");
    expect(bad("tl.to('.a', { repeat: -1 })")).toContain("infinite");
    expect(bad("window.__timelines = []")).toContain("owned-hooks");
    expect(bad("gsap.to('.a', {})")).toContain("gsap");
  });

  it("doesn't trip on words inside strings or comments", () => {
    expect(rules(ok.replace("tl.from", "// Math.random() is banned\n const s = 'Date.now()'; tl.from"))).toEqual([]);
  });

  it("refuses external scripts, viewport units and fixed positioning", () => {
    expect(rules(`<script src="https://cdn/x.js"></script>${ok}`)).toContain("external-script");
    expect(rules(ok.replace("width:10cqw", "width:10vw"))).toContain("units");
    expect(rules(ok.replace("width:10cqw", "position:fixed"))).toContain("fixed");
  });

  it("warns about pixel positions", () => {
    const w = lintSequence(ok.replace("y: S.h(6)", "y: 120")).warnings.map((x) => x.rule);
    expect(w).toContain("pixels");
    expect(lintSequence(ok.replace("y: S.h(6)", "y: 12")).warnings).toEqual([]);
  });
});

describe("lintSequence: large blurred layers", () => {
  const tpl = (css: string, markup = "") => `<div class="stage" data-libs="stage" data-duration="4"><style>${css}</style><div class="world">${markup}</div></div><script>stage.build((tl, S) => { tl.label("a", 0); });</script>`;
  it("warns about a big filter: blur layer, in CSS or inline", () => {
    expect(lintSequence(tpl(".bloom{position:absolute;width:70cqw;height:70cqw;filter:blur(6cqmin)}")).warnings.map((w) => w.rule)).toContain("big-blur");
    expect(lintSequence(tpl("", '<div style="position:absolute;inset:0;filter:blur(20px)"></div>')).warnings.map((w) => w.rule)).toContain("big-blur");
  });
  it("leaves small blurs and gradient glows alone", () => {
    expect(lintSequence(tpl(".dot{width:4cqmin;height:4cqmin;filter:blur(.3cqmin)}")).warnings).toEqual([]);
    expect(lintSequence(tpl(".bloom{width:70cqw;height:70cqw;background:radial-gradient(circle,#f0f,transparent 65%)}")).warnings).toEqual([]);
  });
});
