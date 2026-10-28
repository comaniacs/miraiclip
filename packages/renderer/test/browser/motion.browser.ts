/** `__miraiclipMotion`: how far anything with an id travels between two instants (feeds motion-blur sampling). */
import { afterAll, describe, expect, it } from "vitest";
import { browser, openShot, SIZES } from "./harness.js";

afterAll(async () => (await browser())?.close());

const SEQ = (body: string, markup: string, dur = 4) =>
  `<div class="stage" data-libs="stage" data-duration="${dur}" data-stage-version="2"><div class="world" style="position:absolute;inset:0">${markup}</div></div><script>stage.build((tl, S) => {${body}});</script>`;
const DOT = `<div id="d" style="position:absolute;left:10%;top:40%;width:5%;height:10%;background:#f00"></div>`;

const motion = (page: import("playwright-core").Page, a: number, b: number) =>
  page.evaluate(([x, y]) => (window as unknown as { __miraiclipMotion(a: number, b: number): number }).__miraiclipMotion(x!, y!), [a, b]);

describe("motion query", () => {
  const { width: W } = SIZES.landscape;

  it("reports how far an element moves between two times, in px", async (ctx) => {
    const shot = await openShot(SEQ(`tl.to("#d", { x: S.w(50), duration: 2, ease: "none" }, 0);`, DOT), "landscape");
    if (!shot) return ctx.skip();
    // 50% of the width over 2 s → 0.5 × W / 2 per second
    expect(await motion(shot.page, 0, 0.2)).toBeCloseTo((0.5 * W) / 2 / 5, 0);
    expect(await motion(shot.page, 2.5, 3)).toBe(0); // done moving
    await shot.close();
  });

  it("includes the camera", async (ctx) => {
    const shot = await openShot(SEQ(`tl.camera({ zoom: 2, duration: 1, ease: "linear" }, 0);`, DOT), "landscape");
    if (!shot) return ctx.skip();
    expect(await motion(shot.page, 0, 1)).toBeGreaterThan(50); // the dot is carried out by the zoom
    await shot.close();
  });

  it("ignores things that only appear or vanish", async (ctx) => {
    const shot = await openShot(SEQ(`tl.to("#d", { opacity: 0, duration: 0.5 }, 1);`, DOT), "landscape");
    if (!shot) return ctx.skip();
    expect(await motion(shot.page, 1.2, 2)).toBe(0);
    await shot.close();
  });
});
