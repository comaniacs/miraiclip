/**
 * Typewriter and Blur animations, through the real compositor (Kagura F6.17): white text on
 * black, so lit pixels are the glyphs and their blur.
 *
 * Needs a browser (MIRAICLIP_BROWSER or the well-known path); skips visibly without one.
 */
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProject, type ProjectDocument } from "@miraiclip/core";
import { createRenderSession, type RenderSession } from "../src/render-session.js";
import { decodePng, type Rgba } from "./png.js";

const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find(
  (p): p is string => p !== undefined && existsSync(p),
);

const W = 400;
const H = 200;

function doc(text: string, extra: Record<string, unknown> = {}, keyframes: [string, number, number][] = []): ProjectDocument {
  const project = createProject({ width: W, height: H, fps: 10 });
  project.dispatch({ type: "track/add", payload: { id: "t1", kind: "video" } });
  project.dispatch({
    type: "clip/add",
    payload: {
      kind: "text",
      id: "c",
      trackId: "t1",
      startUs: 0,
      durationUs: 1_000_000,
      text,
      fontSizePx: 90,
      fontWeight: 900,
      color: "#ffffff",
      textAlign: "center",
      ...extra,
    },
  } as never);
  for (const [property, timeUs, value] of keyframes)
    project.dispatch({ type: "keyframe/set", payload: { clipId: "c", property, timeUs, value } } as never);
  return project.toJSON();
}

/** Lit pixels (any of r/g/b above `min`) in a rectangle. */
function lit(png: Uint8Array, box: { x0?: number; x1?: number; y0?: number; y1?: number } = {}, min = 128): number {
  const img = decodePng(png);
  let n = 0;
  for (let y = box.y0 ?? 0; y < (box.y1 ?? img.height); y++)
    for (let x = box.x0 ?? 0; x < (box.x1 ?? img.width); x++) if (img.at(x, y).slice(0, 3).some((c) => c > min)) n++;
  return n;
}
const bright = ([r, g, b]: Rgba) => r > 240 && g > 240 && b > 240;
function count(png: Uint8Array, test: (p: Rgba) => boolean): number {
  const img = decodePng(png);
  let n = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (test(img.at(x, y))) n++;
  return n;
}

describe.skipIf(browserPath === undefined)("text animations in server renders", () => {
  let session: RenderSession;
  beforeAll(async () => {
    session = await createRenderSession({
      assetsDir: ".",
      browser: { executablePath: browserPath!, swiftshader: true },
    });
  }, 60_000);
  afterAll(async () => {
    await session?.close();
  });

  const still = (d: ProjectDocument, timeUs = 400_000) => session.renderStill(d, { timeUs });
  // A 0.8 s Typewriter on a 1 s clip, like an In slot that ends before the clip does.
  const typed: [string, number, number][] = [["reveal", 0, 0], ["reveal", 800_000, 1]];

  it("Typewriter: nothing at the start, the first characters first, everything at the end", async () => {
    const full = lit(await still(doc("ABCD")));
    expect(full).toBeGreaterThan(1000);
    const none = await still(doc("ABCD", {}, typed), 0);
    expect(lit(none)).toBe(0);
    const half = await still(doc("ABCD", {}, typed), 400_000); // "AB"
    const centerX = W / 2;
    // Centered text keeps its final layout: AB sits left of center, nothing right of it.
    expect(lit(half, { x1: centerX })).toBeGreaterThan(full / 4);
    expect(lit(half, { x0: centerX + 8 })).toBe(0);
    expect(lit(half)).toBeLessThan(full * 0.7);
    // The last frame shows all of it, exactly as without the animation.
    const end = await still(doc("ABCD", {}, typed), 900_000);
    expect(lit(end)).toBe(full);
  }, 120_000);

  it("Typewriter types line by line and the text does not move while it types", async () => {
    const d = (t: number) => still(doc("AA\nBB", {}, typed), t);
    const first = await d(200_000); // 1 of 4 characters: part of the top line
    const mid = H / 2;
    expect(lit(first, { y0: 0, y1: mid })).toBeGreaterThan(0);
    expect(lit(first, { y0: mid + 10 })).toBe(0);
    const topDone = await d(400_000); // "AA"
    const topAfter = lit(topDone, { y0: 0, y1: mid });
    expect(topAfter).toBeGreaterThan(0);
    expect(lit(topDone, { y0: mid + 10 })).toBe(0);
    // The top line looks the same once the bottom one is typed: nothing reflowed.
    const done = await d(900_000);
    expect(lit(done, { y0: 0, y1: mid })).toBeGreaterThan(topAfter * 0.95);
    expect(lit(done, { y0: mid + 10 })).toBeGreaterThan(0);
  }, 120_000);

  it("Typewriter still hides the right characters with an outline and a shadow", async () => {
    const deco = { strokeColor: "#ff0000", strokeWidthFrac: 0.08, shadowColor: "#0000ff", shadowBlurFrac: 0, shadowOffsetFrac: 0.08 };
    const half = await still(doc("ABCD", deco, typed), 400_000);
    const reddishRight = count(half, ([r, g, b]) => r > 120 && g < 60 && b < 60);
    expect(reddishRight).toBeGreaterThan(100); // outline of the typed part
    expect(lit(half, { x0: W / 2 + 14 })).toBe(0); // nothing of the rest, even its outline or shadow
  }, 120_000);

  it("Typewriter keeps its cut when the text is moved and scaled (the mask follows the text)", async () => {
    const at = { transform: { x: 0.4, y: 0.5, scale: 1.4 } }; // centered on x = 160 of 400
    const full = lit(await still(doc("ABCD", at)));
    const half = await still(doc("ABCD", at, typed), 400_000); // "AB"
    expect(lit(half, { x1: 160 })).toBeGreaterThan(full / 4);
    expect(lit(half, { x0: 160 + 8 })).toBe(0);
    expect(lit(await still(doc("ABCD", at, typed), 900_000))).toBe(full);
  }, 120_000);

  it("Blur softens the clip: fewer fully lit pixels, more lit around them", async () => {
    const sharp = await still(doc("HI"));
    const blurred = await still(doc("HI", {}, [["blur", 0, 0.03]]));
    expect(count(blurred, bright)).toBeLessThan(count(sharp, bright) * 0.6);
    expect(lit(blurred, {}, 20)).toBeGreaterThan(lit(sharp, {}, 20));
    // A blur animation that has finished is as sharp as no animation.
    const settled = await still(doc("HI", {}, [["blur", 0, 0.03], ["blur", 200_000, 0]]));
    expect(count(settled, bright)).toBe(count(sharp, bright));
  }, 120_000);
});
