/** Chained hops, contact shadows and depth-of-field focus. */
import { afterAll, describe, expect, it } from "vitest";
import { browser, openShot } from "./harness.js";

afterAll(async () => (await browser())?.close());

const SEQ = (body: string, markup = "", dur = 8) =>
  `<div class="stage" data-libs="stage" data-duration="${dur}" data-stage-version="2"><div class="world" style="position:absolute;inset:0">${markup}</div></div><script>stage.build((tl, S) => {${body}});</script>`;
const SLOTS = `<div id="a" style="position:absolute;left:10%;top:60%;width:6%;height:6%;background:#f00"></div><div id="b" style="position:absolute;left:40%;top:50%;width:6%;height:6%;background:#0f0"></div><div id="c" style="position:absolute;left:75%;top:62%;width:6%;height:6%;background:#00f"></div>`;

type Pt = { x: number; y: number };
const centre = (s: NonNullable<Awaited<ReturnType<typeof openShot>>>, sel: string) =>
  s.page.evaluate((q) => {
    const r = document.querySelector(q)!.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, sel) as Promise<Pt>;

describe("chained hop", () => {
  it("a second hop starts where the first ended and lands on its own target", async (ctx) => {
    const s = await openShot(SEQ(`tl.hop("#a", { to: "#b", duration: 1 }, 1).hop("#a", { to: "#c", duration: 1 }, 2.5);`, SLOTS), "landscape");
    if (!s) return ctx.skip();
    expect((await s.attrs())["data-stage-error"]).toBeUndefined();
    await s.seek(2.2);
    const mid = await centre(s, "#a"), b = await centre(s, "#b");
    expect(Math.abs(mid.x - b.x)).toBeLessThan(1);
    expect(Math.abs(mid.y - b.y)).toBeLessThan(1);
    await s.seek(3.5);
    const end = await centre(s, "#a"), c = await centre(s, "#c");
    expect(Math.abs(end.x - c.x)).toBeLessThan(1);
    expect(Math.abs(end.y - c.y)).toBeLessThan(1);
    const carries = JSON.parse((await s.attrs())["data-stage-carries"] ?? "[]") as unknown[];
    expect(carries.length).toBe(2);
    await s.close();
  });

  it("rejects a hop that starts before the last one lands", async (ctx) => {
    const s = await openShot(SEQ(`tl.hop("#a", { to: "#b", duration: 1 }, 1).hop("#a", { to: "#c", duration: 1 }, 1.5);`, SLOTS), "landscape");
    if (!s) return ctx.skip();
    expect((await s.attrs())["data-stage-error"]).toMatch(/hop\(\): "#a" is still in its previous hop until 2s/);
    await s.close();
  });
});

describe("contact shadow", () => {
  const shadow = (s: NonNullable<Awaited<ReturnType<typeof openShot>>>) =>
    s.page.evaluate(() => {
      const el = document.querySelector(".stage-shadow") as HTMLElement;
      return { op: parseFloat(el.style.opacity), tf: el.style.transform, n: document.querySelectorAll(".stage-shadow").length };
    });
  it("follows a hop on the ground, faint and wide while in the air, full when it rests", async (ctx) => {
    const s = await openShot(SEQ(`tl.hop("#a", { to: "#b", duration: 1, shadow: true }, 1).hop("#a", { to: "#c", duration: 1, shadow: true }, 2.5);`, SLOTS), "landscape");
    if (!s) return ctx.skip();
    expect((await s.attrs())["data-stage-error"]).toBeUndefined();
    await s.seek(0.2);
    const rest = await shadow(s);
    await s.seek(1.5);
    const air = await shadow(s);
    expect(rest.n).toBe(1); // one shadow, however many hops
    expect(air.op).toBeLessThan(rest.op);
    expect(air.tf).not.toBe(rest.tf);
    await s.seek(2.2);
    const landed = await shadow(s);
    expect(landed.op).toBeCloseTo(rest.op, 2);
    await s.close();
  });
  it("tl.shadow on a resting element draws a steady shadow", async (ctx) => {
    const s = await openShot(SEQ(`tl.shadow("#b", { opacity: 0.5 });`, SLOTS), "landscape");
    if (!s) return ctx.skip();
    await s.seek(1);
    expect((await shadow(s)).op).toBeCloseTo(0.5, 2);
    await s.close();
  });
});

describe("depth of field", () => {
  const MARK = `<div id="n" data-dof="0" style="position:absolute;left:10%;top:20%;width:8%;height:8%;background:#f00"></div><div id="m" data-dof="1" style="position:absolute;left:40%;top:20%;width:8%;height:8%;background:#0f0"></div><div id="f" data-dof="2" style="position:absolute;left:70%;top:20%;width:8%;height:8%;background:#00f"></div>`;
  const blur = (s: NonNullable<Awaited<ReturnType<typeof openShot>>>) =>
    s.page.evaluate(() => ["n", "m", "f"].map((id) => parseFloat((document.getElementById(id)!.style.filter.match(/blur\(([\d.]+)px\)/) ?? [0, "0"])[1]!)));
  it("blurs by distance from the focus depth and racks between depths", async (ctx) => {
    const s = await openShot(SEQ(`tl.focus("#m", { blur: 6, duration: 0.5 }, 1).focus("#f", { blur: 6, duration: 1 }, 3).focus(null, {}, 6);`, MARK), "landscape");
    if (!s) return ctx.skip();
    expect((await s.attrs())["data-stage-error"]).toBeUndefined();
    await s.seek(0.5);
    expect(await blur(s)).toEqual([0, 0, 0]); // before the first focus everything is sharp
    await s.seek(2);
    expect(await blur(s)).toEqual([6, 0, 6]);
    await s.seek(3.5); // halfway through the rack: depth 1.5
    const mid = await blur(s);
    expect(mid[0]).toBeCloseTo(9, 0);
    expect(mid[1]).toBeCloseTo(3, 0);
    expect(mid[2]).toBeCloseTo(3, 0);
    await s.seek(5);
    expect(await blur(s)).toEqual([12, 6, 0]);
    await s.seek(7.5);
    expect(await blur(s)).toEqual([0, 0, 0]);
    await s.close();
  });
  it("is a pure function of the time, so seeking back gives the same blur", async (ctx) => {
    const s = await openShot(SEQ(`tl.focus("#m", { blur: 6, duration: 0.5 }, 1);`, MARK), "landscape");
    if (!s) return ctx.skip();
    await s.seek(3);
    const a = await blur(s);
    await s.seek(0.2);
    await s.seek(3);
    expect(await blur(s)).toEqual(a);
    await s.close();
  });
  it("names the fix when nothing is marked", async (ctx) => {
    const s = await openShot(SEQ(`tl.focus(1, {}, 1);`, SLOTS), "landscape");
    if (!s) return ctx.skip();
    expect((await s.attrs())["data-stage-error"]).toMatch(/focus\(\): no element has data-dof/);
    await s.close();
  });
});

describe("frame", () => {
  it("calls the function with the time on every seek, so a canvas is a function of t", async (ctx) => {
    const s = await openShot(SEQ(`tl.frame((t) => { document.getElementById("c").getContext("2d").fillStyle = "rgb(" + Math.round(t * 20) + ",0,0)"; document.getElementById("c").getContext("2d").fillRect(0, 0, 4, 4); });`, `<canvas id="c" width="4" height="4"></canvas>`), "landscape");
    if (!s) return ctx.skip();
    expect((await s.attrs())["data-stage-error"]).toBeUndefined();
    const red = () => s.page.evaluate(() => (document.getElementById("c") as HTMLCanvasElement).getContext("2d")!.getImageData(1, 1, 1, 1).data[0]);
    await s.seek(5);
    expect(await red()).toBe(100);
    await s.seek(2);
    expect(await red()).toBe(40);
    await s.close();
  });
  it("needs a function", async (ctx) => {
    const s = await openShot(SEQ(`tl.frame("nope");`), "landscape");
    if (!s) return ctx.skip();
    expect((await s.attrs())["data-stage-error"]).toMatch(/frame\(\): pass a function/);
    await s.close();
  });
});
