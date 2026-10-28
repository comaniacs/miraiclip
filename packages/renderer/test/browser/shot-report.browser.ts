/** The shot report the kit produces about itself: carry classification, framing, rhythm. */
import { afterAll, describe, expect, it } from "vitest";
import { browser, fixture, openShot } from "./harness.js";

afterAll(async () => (await browser())?.close());

async function report(name: string, size: "landscape" | "portrait" | "square" = "landscape") {
  const shot = await openShot(fixture(name), size);
  if (!shot) return null;
  const rep = await shot.page.evaluate(() => (window as any).__miraiclipProbe({}).report);
  await shot.close();
  return rep as any;
}

describe("shot report", () => {
  it("a slideshow's boundaries are bare and the score is low", async (ctx) => {
    const r = await report("slideshow.html");
    if (!r) return ctx.skip();
    expect(r.boundaries.filter((b: any) => b.kind === "bare").length).toBe(2);
    expect(r.score).toBe(0);
    expect(r.findings.some((f: any) => f.rule === "bare-boundary")).toBe(true);
    expect(r.findings.some((f: any) => f.rule === "carry-score")).toBe(true);
  });

  it("a morph across a boundary is carried", async (ctx) => {
    const r = await report("carried.html");
    if (!r) return ctx.skip();
    const b = r.boundaries.find((x: any) => x.label === "b");
    expect(b.kind).toBe("carried");
    expect(r.carried).toBeGreaterThanOrEqual(1);
  });

  it("is the same at every aspect ratio", async (ctx) => {
    for (const s of ["landscape", "portrait", "square"] as const) {
      const r = await report("slideshow.html", s);
      if (!r) return ctx.skip();
      expect(r.bare, s).toBe(2);
    }
  });

  it("flags a subject that leaves the frame", async (ctx) => {
    const r = await report("leaves-frame.html");
    if (!r) return ctx.skip();
    const f = r.findings.find((x: any) => x.rule === "framing");
    expect(f).toBeTruthy();
    expect(f.t).toBeGreaterThan(3.5);
    expect(f.t).toBeLessThan(4.2);
  });

  it("flags evenly spaced beats", async (ctx) => {
    const r = await report("equal-beats.html");
    if (!r) return ctx.skip();
    expect(r.rhythm.cv).toBeLessThan(0.05);
    expect(r.findings.some((f: any) => f.rule === "cadence")).toBe(true);
  });

  it("exempts a burst of cuts and does not count it as hard cuts outside bursts", async (ctx) => {
    const r = await report("cut-burst.html");
    if (!r) return ctx.skip();
    expect(r.boundaries.slice(0, 3).every((b: any) => b.kind === "exempt")).toBe(true);
    expect(r.rhythm.bursts).toBe(1);
    expect(r.findings.filter((f: any) => f.rule === "hard-cut").length).toBe(1);
  });

  it("probing does not change what a later seek shows", async (ctx) => {
    const shot = await openShot(fixture("carried.html"));
    if (!shot) return ctx.skip();
    await shot.seek(2.8);
    const sample = () => shot.page.evaluate(() => document.querySelector("#m1")!.getBoundingClientRect().left);
    const before = await sample();
    await shot.page.evaluate(() => (window as any).__miraiclipProbe({}));
    await shot.seek(2.8);
    expect(await sample()).toBeCloseTo(before, 3);
    await shot.close();
  });
});
