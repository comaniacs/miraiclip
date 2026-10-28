/** The operated camera: one track that sums keyed moves, follow, handheld and shake. */
import { afterAll, describe, expect, it } from "vitest";
import { browser, fixture, openShot, SIZES, type Shot, type SizeName } from "./harness.js";

afterAll(async () => (await browser())?.close());

const SEQ = (body: string, markup = "", dur = 6, extra = "") =>
  `<div class="stage" data-libs="stage" data-duration="${dur}" data-stage-version="2" ${extra}><div class="world" style="position:absolute;inset:0">${markup}</div></div><script>stage.build((tl, S) => {${body}});</script>`;
const DOT = `<div id="t" style="position:absolute;left:30%;top:40%;width:6%;height:6%;background:#f00"></div><div id="u" style="position:absolute;left:70%;top:55%;width:6%;height:6%;background:#0f0"></div>`;

async function cam(shot: Shot) {
  return shot.page.evaluate(() => {
    const m = new DOMMatrix(getComputedStyle(document.querySelector(".world")!).transform);
    return { x: m.m41, y: m.m42, z: Math.hypot(m.m11, m.m12) };
  });
}
const rectOf = (shot: Shot, sel: string) => shot.page.evaluate((s) => { const r = document.querySelector(s)!.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);

for (const name of Object.keys(SIZES) as SizeName[]) {
  describe(`camera at ${name}`, () => {
    const { width: W, height: H } = SIZES[name];

    it("zooms in log space: 1 to 100 reads 10 at the midpoint", async (ctx) => {
      const shot = await openShot(SEQ(`tl.camera({ zoom: 100, duration: 1, ease: "linear" }, 0);`), name);
      if (!shot) return ctx.skip();
      await shot.seek(0.5);
      expect((await cam(shot)).z).toBeGreaterThan(9.9);
      expect((await cam(shot)).z).toBeLessThan(10.1);
      await shot.close();
    });

    it("sums follow, handheld and shake without fighting", async (ctx) => {
      const mk = (body: string) => SEQ(`tl.to("#t", { x: S.w(20), duration: 3, ease: "none" }, 0); ${body}`, DOT, 6);
      const parts = [`tl.follow("#t", { lead: 0, from: 0, to: 6 });`, `tl.handheld({ amount: 6 }, 0, 6);`, `tl.shake(2, { amp: 12, seed: 3 });`];
      const at = async (body: string) => { const s = await openShot(mk(body), name); if (!s) return null; await s.seek(2.2); const c = await cam(s); await s.close(); return c; };
      const [f, h, k] = [await at(parts[0]!), await at(parts[1]!), await at(parts[2]!)];
      if (!f || !h || !k) return ctx.skip();
      const all = await at(parts.join(" "));
      expect(all!.x).toBeCloseTo(f.x + h.x + k.x, 3);
      expect(all!.y).toBeCloseTo(f.y + h.y + k.y, 3);
      expect(Math.abs(h.x) + Math.abs(h.y)).toBeGreaterThan(0.1);
      expect(Math.abs(k.x) + Math.abs(k.y)).toBeGreaterThan(0.1);
    });

    it("follow keeps a moving target near the frame centre", async (ctx) => {
      const shot = await openShot(SEQ(`tl.to("#t", { x: S.w(25), y: S.h(-10), duration: 4, ease: "inOut(2)" }, 0.5); tl.camera({ zoom: 1.6, duration: 1 }, 0).follow("#t", { lead: 0.1, from: 0, to: 5 });`, DOT, 6), name);
      if (!shot) return ctx.skip();
      for (const t of [0.6, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.4]) {
        await shot.seek(t);
        const r = await rectOf(shot, "#t");
        expect(Math.abs(r.x + r.w / 2 - W / 2), `x at ${t}`).toBeLessThan(W * 0.1);
        expect(Math.abs(r.y + r.h / 2 - H / 2), `y at ${t}`).toBeLessThan(H * 0.1);
      }
      await shot.close();
    });

    it("whip lands with the target centred", async (ctx) => {
      const shot = await openShot(SEQ(`tl.whip("#u", { duration: 0.5 }, 1);`, DOT, 3), name);
      if (!shot) return ctx.skip();
      await shot.seek(1.5);
      const r = await rectOf(shot, "#u");
      expect(Math.abs(r.x + r.w / 2 - W / 2)).toBeLessThan(W * 0.02);
      expect(Math.abs(r.y + r.h / 2 - H / 2)).toBeLessThan(H * 0.02);
      await shot.close();
    });

    it("keys a deep zoom in screen space: the anchor stays where it was keyed", async (ctx) => {
      const shot = await openShot(fixture("deep-zoom.html"), name);
      if (!shot) return ctx.skip();
      expect((await shot.attrs())["data-stage-error"]).toBeUndefined();
      await shot.seek(2.5);
      expect((await cam(shot)).z).toBeCloseTo(300, 0);
      const r = await rectOf(shot, "#l2");
      expect(Math.abs(r.x + r.w / 2 - W / 2)).toBeLessThan(2);
      expect(Math.abs(r.y + r.h / 2 - H / 2)).toBeLessThan(2);
      await shot.seek(6);
      expect((await cam(shot)).z).toBeCloseTo(1, 3);
      await shot.close();
    });

    it("zoomThrough fills the frame; at the midpoint zoom is the geometric mean", async (ctx) => {
      const shot = await openShot(SEQ(`tl.zoomThrough("#t", { fit: "cover", duration: 2, ease: "inOut(3)" }, 0.5);`, DOT, 4), name);
      if (!shot) return ctx.skip();
      await shot.seek(1.5);
      const mid = (await cam(shot)).z;
      await shot.seek(2.5);
      const end = (await cam(shot)).z;
      expect(Math.abs(mid / Math.sqrt(end) - 1)).toBeLessThan(0.01);
      const r = await rectOf(shot, "#t");
      expect(r.w).toBeGreaterThanOrEqual(W - 1);
      expect(r.h).toBeGreaterThanOrEqual(H - 1);
      await shot.close();
    });

    it("handheld is exactly zero outside its range", async (ctx) => {
      const shot = await openShot(SEQ(`tl.handheld({ amount: 8 }, 2, 4);`, DOT, 6), name);
      if (!shot) return ctx.skip();
      await shot.seek(1);
      const a = await cam(shot);
      await shot.seek(5);
      const b = await cam(shot);
      expect(a).toEqual(b);
      await shot.seek(3);
      const mid = await cam(shot);
      expect(Math.abs(mid.x) + Math.abs(mid.y)).toBeGreaterThan(0.01);
      await shot.close();
    });

    it("shake: deterministic, zero before its time, same on-screen size at any zoom", async (ctx) => {
      const run = async (zoom: number) => {
        const s = await openShot(SEQ(`tl.camera({ zoom: ${zoom}, duration: 0.5 }, 0); tl.shake(2, { amp: 20, seed: 9 });`, DOT, 4), name);
        if (!s) return null;
        await s.seek(1.999);
        const before = await cam(s);
        await s.seek(2.03);
        const during = await cam(s);
        await s.close();
        return { before, during };
      };
      const one = await run(1), big = await run(300);
      if (!one || !big) return ctx.skip();
      expect(one.before.x).toBeCloseTo(0, 6);
      expect(one.during.x).not.toBeCloseTo(0, 1);
      expect(big.during.x).toBeCloseTo(one.during.x, 6); // screen space, independent of zoom
      const again = await run(1);
      expect(again!.during).toEqual(one.during);
    });

    it("depth layers move 1/(1+d) as far under a pan", async (ctx) => {
      const shot = await openShot(SEQ(`tl.camera({ x: 200, duration: 1, ease: "linear" }, 0);`, `<div id="d0" style="position:absolute;left:10%;top:10%;width:5%;height:5%;background:#f00"></div><div id="d1" data-depth="1" style="position:absolute;left:10%;top:30%;width:5%;height:5%;background:#0f0"></div>`, 3), name);
      if (!shot) return ctx.skip();
      const r0 = await rectOf(shot, "#d0"), r1 = await rectOf(shot, "#d1");
      await shot.seek(1.2);
      const a = await rectOf(shot, "#d0"), b = await rectOf(shot, "#d1");
      expect(a.x - r0.x).toBeCloseTo(200, 0);
      expect(b.x - r1.x).toBeCloseTo(100, 0);
      await shot.close();
    });

    it("a declared rest fails the build when something moves in it", async (ctx) => {
      const bad = await openShot(SEQ(`tl.to("#t", { x: 50, duration: 2 }, 0); tl.rest(1, 2.5);`, DOT, 4), name);
      if (!bad) return ctx.skip();
      expect((await bad.attrs())["data-stage-error"]).toMatch(/rest 1\.00–2\.50 s: .*#t.* still moves/);
      await bad.close();
      const ok = await openShot(SEQ(`tl.to("#t", { x: 50, duration: 1 }, 0); tl.rest(1.2, 3);`, DOT, 4), name);
      expect((await ok!.attrs())["data-stage-error"]).toBeUndefined();
      await ok!.close();
    });
  });
}
