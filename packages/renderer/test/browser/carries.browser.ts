/** The carry verbs: boxes and opacity measured in a real browser at three aspect ratios. */
import { afterAll, describe, expect, it } from "vitest";
import { browser, fixture, openShot, SIZES, type Shot, type SizeName } from "./harness.js";

afterAll(async () => (await browser())?.close());

const box = (shot: Shot, sel: string) =>
  shot.page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, o: Number(getComputedStyle(document.querySelector(s)!).opacity) };
  }, sel);

const SEQ = (body: string, markup: string, dur = 5) =>
  `<div class="stage" data-libs="stage" data-duration="${dur}" data-stage-version="2"><div class="world" style="position:absolute;inset:0">${markup}</div></div><script>stage.build((tl, S) => {${body}});</script>`;

for (const name of Object.keys(SIZES) as SizeName[]) {
  describe(`carry verbs at ${name}`, () => {
    it("morph: the source lands on the target's box and never shows both fully opaque", async (ctx) => {
      const shot = await openShot(fixture("morph.html"), name);
      if (!shot) return ctx.skip();
      expect((await shot.attrs())["data-stage-error"]).toBeUndefined();
      await shot.seek(1);
      const a = await box(shot, "#m1"), b = await box(shot, "#m2");
      for (const k of ["x", "y", "w", "h"] as const) expect(Math.abs(a[k] - b[k]), k).toBeLessThan(1);
      for (let t = 0; t <= 4; t += 0.05) {
        await shot.seek(t);
        const [p, q, r] = [await box(shot, "#m1"), await box(shot, "#m2"), await box(shot, "#m3")];
        expect(p.o >= 0.999 && q.o >= 0.999, `m1/m2 at ${t}`).toBe(false);
        expect(q.o >= 0.999 && r.o >= 0.999 && t < 2.45, `m2/m3 at ${t}`).toBe(false);
      }
      const carries = JSON.parse((await shot.attrs())["data-stage-carries"]!);
      expect(carries.map((c: { from: string; to: string }) => `${c.from}>${c.to}`)).toEqual(["#m1>#m2", "#m2>#m3"]);
      await shot.close();
    });

    it("iris: opens from the source's centre to the farthest corner", async (ctx) => {
      const shot = await openShot(SEQ(`tl.iris("#scene", { from: "#btn", duration: 1 }, 0.5);`, `<div id="btn" style="position:absolute;left:20%;top:30%;width:10%;height:10%;background:#f00"></div><div id="scene" style="position:absolute;inset:0;background:#00f"></div>`), name);
      if (!shot) return ctx.skip();
      const { width: W, height: H } = SIZES[name];
      const clip = async (t: number) => {
        await shot.seek(t);
        const c = await shot.page.evaluate(() => (document.getElementById("scene") as HTMLElement).style.clipPath);
        const m = /circle\(([\d.]+)px at ([\d.]+)px ([\d.]+)px\)/.exec(c);
        return m ? { r: +m[1], x: +m[2], y: +m[3] } : null;
      };
      const start = (await clip(0.5))!;
      expect(start.r).toBe(0);
      expect(start.x).toBeCloseTo(W * 0.25, 0);
      expect(start.y).toBeCloseTo(H * 0.35, 0);
      const nearEnd = (await clip(1.49))!;
      expect(nearEnd.r).toBeGreaterThan(Math.hypot(W * 0.75, H * 0.65) * 0.99);
      await shot.seek(1.6);
      expect(await shot.page.evaluate(() => (document.getElementById("scene") as HTMLElement).style.clipPath)).toBe("none");
      await shot.close();
    });

    it("hop: highest at mid-duration, lands on the slot with a squash", async (ctx) => {
      const shot = await openShot(SEQ(`tl.hop("#ball", { to: "#slot", duration: 1 }, 0.5);`, `<div id="ball" style="position:absolute;left:10%;top:60%;width:6%;height:6%;background:#f00"></div><div id="slot" style="position:absolute;left:70%;top:60%;width:6%;height:6%;background:#0f0"></div>`), name);
      if (!shot) return ctx.skip();
      let minY = Infinity, argT = 0;
      for (let t = 0.5; t <= 1.5; t += 0.02) {
        await shot.seek(t);
        const b = await box(shot, "#ball");
        if (b.y < minY) { minY = b.y; argT = t; }
      }
      expect(argT).toBeGreaterThan(0.95);
      expect(argT).toBeLessThan(1.05);
      await shot.seek(1.4);
      expect(await shot.page.evaluate(() => document.getElementById("ball")!.style.transform)).toMatch(/scale\([\d.]+,\s?0\.[0-9]+\)/);
      await shot.seek(1.5);
      const a = await box(shot, "#ball"), s = await box(shot, "#slot");
      expect(Math.abs(a.x + a.w / 2 - (s.x + s.w / 2))).toBeLessThan(1);
      expect(Math.abs(a.y + a.h / 2 - (s.y + s.h / 2))).toBeLessThan(1);
      await shot.close();
    });

    it("gather: every target ends inside the box, bowing off the straight line mid-path", async (ctx) => {
      const dots = [10, 20, 30, 40].map((x, i) => `<i class="d" style="position:absolute;left:${x}%;top:${10 + i * 5}%;width:3%;height:3%;background:#f00"></i>`).join("");
      const shot = await openShot(SEQ(`tl.gather(".d", { into: "#bin", arc: 0.3, stagger: 0.05, duration: 1 }, 0.5);`, dots + `<div id="bin" style="position:absolute;left:60%;top:60%;width:30%;height:30%;background:#00f"></div>`), name);
      if (!shot) return ctx.skip();
      await shot.seek(3);
      const bin = await box(shot, "#bin");
      const ends = await shot.page.evaluate(() => Array.from(document.querySelectorAll(".d")).map((e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }));
      for (const e of ends) {
        expect(e.x).toBeGreaterThanOrEqual(bin.x - 0.5);
        expect(e.y).toBeGreaterThanOrEqual(bin.y - 0.5);
        expect(e.x + e.w).toBeLessThanOrEqual(bin.x + bin.w + 0.5);
        expect(e.y + e.h).toBeLessThanOrEqual(bin.y + bin.h + 0.5);
      }
      await shot.seek(0);
      const start = (await shot.page.evaluate(() => { const r = document.querySelector(".d")!.getBoundingClientRect(); return { x: r.left, y: r.top }; }));
      await shot.seek(1.0); // first target, half way through its move
      const mid = await shot.page.evaluate(() => { const r = document.querySelector(".d")!.getBoundingClientRect(); return { x: r.left, y: r.top }; });
      await shot.seek(3);
      const end = await shot.page.evaluate(() => { const r = document.querySelector(".d")!.getBoundingClientRect(); return { x: r.left, y: r.top }; });
      const dist = Math.hypot(end.x - start.x, end.y - start.y);
      const line = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      expect(Math.hypot(mid.x - line.x, mid.y - line.y)).toBeGreaterThan(dist * 0.3 * 0.8);
      expect(Math.hypot(mid.x - line.x, mid.y - line.y)).toBeLessThan(dist * 0.3 * 1.2);
      await shot.close();
    });
  });
}
