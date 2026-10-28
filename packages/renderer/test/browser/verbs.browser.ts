/** Events, pointer, grid, level of detail and error messages for the version 2 verbs. */
import { afterAll, describe, expect, it } from "vitest";
import { browser, openShot } from "./harness.js";

afterAll(async () => (await browser())?.close());

const SEQ = (body: string, markup = "", dur = 6, version = ' data-stage-version="2"') =>
  `<div class="stage" data-libs="stage" data-duration="${dur}"${version}><div class="world" style="position:absolute;inset:0">${markup}</div></div><script>stage.build((tl, S) => {${body}});</script>`;
const DOT = `<div id="t" style="position:absolute;left:30%;top:40%;width:6%;height:6%;background:#f00"></div><div id="u" style="position:absolute;left:70%;top:55%;width:6%;height:6%;background:#0f0"></div>`;

describe("events", () => {
  it("lists every hit with time, kind and pan, and retiming a label moves its hits", async (ctx) => {
    const at = async (label: number) => {
      const s = await openShot(SEQ(`tl.label("boom", ${label}).shake("boom", { amp: 8 }).press("#t", 4).hit("tick", "boom+=0.5", { pan: -0.5, kind: "click" });`, DOT), "landscape");
      if (!s) return null;
      const ev = JSON.parse((await s.attrs())["data-stage-events"]!) as { name: string; t: number; kind: string; pan: number }[];
      await s.close();
      return ev;
    };
    const a = await at(1), b = await at(2);
    if (!a || !b) return ctx.skip();
    expect(a.map((e) => e.name)).toEqual(["shake", "tick", "press"]);
    expect(a.find((e) => e.name === "tick")).toEqual({ name: "tick", t: 1.5, kind: "click", pan: -0.5 });
    expect(a.find((e) => e.name === "shake")!.kind).toBe("shake");
    expect(b.find((e) => e.name === "shake")!.t).toBe(2);
    expect(b.find((e) => e.name === "tick")!.t).toBe(2.5);
  });

  it("writes cuts and rests to the root", async (ctx) => {
    const s = await openShot(SEQ(`tl.cut(1.5); tl.rest(3, 4);`, DOT), "landscape");
    if (!s) return ctx.skip();
    const a = await s.attrs();
    expect(JSON.parse(a["data-stage-cuts"]!)).toEqual([1.5]);
    expect(JSON.parse(a["data-stage-rests"]!)).toEqual([{ from: 3, to: 4 }]);
    await s.close();
  });
});

describe("pointer", () => {
  const path = [{ t: 0.5, x: 100, y: 100 }, { t: 1.5, x: 600, y: 300 }, { t: 2.5, x: 400, y: 700 }];
  it("passes through every knot and dips on each click", async (ctx) => {
    const s = await openShot(SEQ(`tl.pointer({ path: ${JSON.stringify(path)}, clicks: [1.5, 2.5] });`, DOT), "landscape");
    if (!s) return ctx.skip();
    const pos = async (t: number) => { await s.seek(t); return s.page.evaluate(() => { const e = document.querySelector(".stage-pointer")!; return { x: +e.getAttribute("data-x")!, y: +e.getAttribute("data-y")!, tf: (e as HTMLElement).style.transform }; }); };
    for (const k of path) {
      const p = await pos(k.t);
      expect(Math.abs(p.x - k.x)).toBeLessThan(1);
      expect(Math.abs(p.y - k.y)).toBeLessThan(1);
    }
    const scale = async (t: number) => +/scale\(([\d.]+)\)/.exec((await pos(t)).tf)![1]!;
    expect(await scale(1.5)).toBeLessThan(0.9);
    expect(await scale(2.5)).toBeLessThan(0.9);
    expect(await scale(1.0)).toBe(1);
    await s.close();
  });

  it("builds the same knots from a recorded click log", async (ctx) => {
    const s = await openShot(SEQ(`window.__pp = S.pointerPath([{ t: 0.5, x: 100, y: 100, type: "move" }, { t: 1.5, x: 600, y: 300, type: "click" }]); tl.rest(5, 5.5);`, DOT), "landscape");
    if (!s) return ctx.skip();
    expect(await s.page.evaluate(() => (window as unknown as { __pp: unknown }).__pp)).toEqual({ path: [{ t: 0.5, x: 100, y: 100 }, { t: 1.5, x: 600, y: 300 }], clicks: [1.5] });
    await s.close();
  });
});

describe("press and impact", () => {
  it("press depresses at its time and is back to rest after; impact squashes", async (ctx) => {
    const s = await openShot(SEQ(`tl.press("#t", 1).impact("#u", 2);`, DOT), "landscape");
    if (!s) return ctx.skip();
    const sc = async (id: string, t: number) => { await s.seek(t); return s.page.evaluate((i) => (document.getElementById(i) as HTMLElement).style.transform, id); };
    expect(await sc("t", 0.5)).toBe("scale(1, 1)");
    expect(await sc("t", 1.08)).toMatch(/scale\(0\.9\d*, 0\.9\d*\)/);
    expect(await sc("t", 1.6)).toBe("scale(1, 1)");
    expect(await sc("u", 2.1)).toMatch(/scale\(1\.0\d*, 0\.\d+\)/);
    await s.close();
  });
});

describe("grid and level of detail", () => {
  it("keeps its dot size at any zoom while the lattice moves with the camera", async (ctx) => {
    const s = await openShot(SEQ(`S.grid({ depth: 0.5, spacing: 80, dot: 3 }); tl.camera({ zoom: 50, x: 300, duration: 2, ease: "linear" }, 0);`, DOT), "landscape");
    if (!s) return ctx.skip();
    const read = async (t: number) => { await s.seek(t); return s.page.evaluate(() => { const g = getComputedStyle(document.querySelector(".stage-grid")!); return { img: g.backgroundImage, pos: g.backgroundPosition, size: g.backgroundSize }; }); };
    const a = await read(0), b = await read(2);
    expect(a.img).toBe(b.img);
    expect(a.pos).not.toBe(b.pos);
    await s.close();
  });

  it("fades an element in by its on-screen size and drops it when it is off-frame", async (ctx) => {
    const s = await openShot(SEQ(`tl.camera({ zoom: 300, duration: 2, ease: "linear" }, 0);`, `<div id="tiny" data-lod="40,0" style="position:absolute;left:50%;top:50%;width:0.5%;height:0.5%;background:#f00"></div><div id="far" data-lod="40,0" style="position:absolute;left:2%;top:2%;width:2%;height:2%;background:#0f0"></div>`), "landscape");
    if (!s) return ctx.skip();
    const st = async (id: string, t: number) => { await s.seek(t); return s.page.evaluate((i) => { const e = document.getElementById(i)!; return { op: +e.style.opacity, d: e.style.display }; }, id); };
    expect((await st("tiny", 0)).d).toBe("none");
    expect((await st("tiny", 2)).op).toBe(1);
    expect((await st("far", 2)).d).toBe("none");
    await s.close();
  });
});

describe("errors name the selector and the fix", () => {
  const cases: [string, string, RegExp][] = [
    ["morph", `tl.morph("#nope", "#t");`, /morph\(\): no element matches "#nope" \(from\)/],
    ["iris", `tl.iris("#t", { from: "#nope" });`, /iris\(\): no element matches "#nope" \(from\)/],
    ["zoomThrough", `tl.zoomThrough("#nope");`, /zoomThrough\(\): no element matches "#nope"/],
    ["hop", `tl.hop("#t", { to: "#nope" });`, /hop\(\): no element matches "#nope" \(to\)/],
    ["gather", `tl.gather(".nope", { into: "#t" });`, /gather\(\): no element matches ".nope"/],
    ["press", `tl.press("#nope", 1);`, /press\(\): no element matches "#nope"/],
    ["impact", `tl.impact("#nope", 1);`, /impact\(\): no element matches "#nope"/],
    ["follow", `tl.follow("#nope");`, /follow\(\): no element matches "#nope"/],
    ["whip", `tl.whip("#nope");`, /camera\(\): no element matches "#nope" \(anchor\)/],
    ["pointer", `tl.pointer({ path: [{ t: 0, x: 0, y: 0 }] });`, /pointer\(\): path needs at least two knots/],
  ];
  for (const [verb, body, re] of cases) {
    it(verb, async (ctx) => {
      const s = await openShot(SEQ(body, DOT), "landscape");
      if (!s) return ctx.skip();
      expect((await s.attrs())["data-stage-error"]).toMatch(re);
      await s.close();
    });
  }
  it("version 2 verbs without the version attribute", async (ctx) => {
    const s = await openShot(SEQ(`tl.hop("#t", { to: "#u" });`, DOT, 4, ""), "landscape");
    if (!s) return ctx.skip();
    expect((await s.attrs())["data-stage-error"]).toMatch(/hop\(\): needs data-stage-version="2"/);
    await s.close();
  });
  it("zoomThrough outside the world", async (ctx) => {
    const html = `<div class="stage" data-libs="stage" data-duration="4" data-stage-version="2"><div class="world" style="position:absolute;inset:0"></div><div id="out" style="position:absolute;left:10%;top:10%;width:10%;height:10%"></div></div><script>stage.build((tl) => {tl.zoomThrough("#out");});</script>`;
    const s = await openShot(html, "landscape");
    if (!s) return ctx.skip();
    expect((await s.attrs())["data-stage-error"]).toMatch(/zoomThrough\(\): "#out" must be inside <div class="world">/);
    await s.close();
  });
});
