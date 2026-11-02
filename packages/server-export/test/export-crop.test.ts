/**
 * A crop shows only part of a picture, through the real compositor (Kagura F6.16): the
 * cropped part is what is fitted to the frame (images and videos alike), it is centered, and
 * nothing else of the picture shows. Image: left half red | right half blue, 128×32 px.
 * Video: the same, 128×64. The frame is 400×200.
 *
 * Needs a browser (MIRAICLIP_BROWSER or the well-known path); skips visibly without one.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProject, type Crop, type ProjectDocument } from "@miraiclip/core";
import { createRenderSession, type RenderSession } from "../src/render-session.js";
import { pixelAt } from "./png.js";

const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find(
  (p): p is string => p !== undefined && existsSync(p),
);
const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

const W = 400;
const H = 200;

function doc(kind: "image" | "video", crop?: Crop): ProjectDocument {
  const project = createProject({ width: W, height: H, fps: 10 });
  project.transaction(() => {
    project.dispatch({
      type: "asset/add",
      payload:
        kind === "image"
          ? { id: "a", kind: "image", src: "split-red-blue.png" }
          : { id: "a", kind: "video", src: "split-red-blue.mp4", durationUs: 1_000_000 },
    });
    project.dispatch({ type: "track/add", payload: { id: "t1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: {
        kind,
        id: "c",
        trackId: "t1",
        assetId: "a",
        startUs: 0,
        durationUs: 1_000_000,
        ...(kind === "image" ? { transform: { scale: 3 } } : {}),
        ...(crop ? { crop } : {}),
      },
    });
  });
  return project.toJSON();
}

const isRed = ([r, g, b, a]: number[]) => a > 200 && r > 180 && g < 80 && b < 80;
const isBlue = ([r, g, b, a]: number[]) => a > 200 && b > 180 && r < 80 && g < 80;
/** Stills have an opaque black background, so "nothing drawn here" is black. */
const isEmpty = ([r, g, b]: number[]) => r < 40 && g < 40 && b < 40;

describe.skipIf(browserPath === undefined)("crop in server renders", () => {
  let session: RenderSession;
  beforeAll(async () => {
    session = await createRenderSession({
      assetsDir: FIXTURES,
      browser: { executablePath: browserPath!, swiftshader: true },
    });
  }, 60_000);
  afterAll(async () => {
    await session?.close();
  });

  const at = async (d: ProjectDocument, x: number, y: number) =>
    pixelAt(await session.renderStill(d, { timeUs: 400_000 }), x, y);

  it("image: uncropped shows both halves, a crop shows only its part, centered", async () => {
    // Images draw at native size; at scale 3, 128×32 is 384×96 (x 8..392): red left, blue right.
    const whole = doc("image");
    expect(isRed(await at(whole, 100, 100))).toBe(true);
    expect(isBlue(await at(whole, 300, 100))).toBe(true);

    // A 32×32 piece of the blue half is 96×96 at scale 3 (x 152..248): all blue, nothing around it.
    const blue = doc("image", { x: 0.5, y: 0, width: 0.25, height: 1 });
    expect(isBlue(await at(blue, 170, 100))).toBe(true);
    expect(isBlue(await at(blue, 230, 100))).toBe(true);
    expect(isEmpty(await at(blue, 100, 100))).toBe(true);
    expect(isEmpty(await at(blue, 300, 100))).toBe(true);

    const red = doc("image", { x: 0.25, y: 0, width: 0.25, height: 1 });
    expect(isRed(await at(red, 170, 100))).toBe(true);
    expect(isRed(await at(red, 230, 100))).toBe(true);
    expect(isEmpty(await at(red, 100, 100))).toBe(true);
  }, 90_000);

  it("image: a thin strip of the top becomes the whole clip, so it is fitted wide", async () => {
    // 128×8 at scale 3 is 384×24, centered (y 88..112). Red left, blue right.
    const strip = doc("image", { x: 0, y: 0, width: 1, height: 0.25 });
    expect(isEmpty(await at(strip, 100, 60))).toBe(true);
    expect(isRed(await at(strip, 100, 100))).toBe(true);
    expect(isBlue(await at(strip, 300, 100))).toBe(true);
    expect(isEmpty(await at(strip, 100, 140))).toBe(true);
  }, 90_000);

  it("video: the cropped part fills the fit, not the whole frame", async () => {
    // 128×64 fits the 400×200 frame at ×3.125: whole picture spans x 0..400.
    const whole = doc("video");
    expect(isRed(await at(whole, 100, 100))).toBe(true);
    expect(isBlue(await at(whole, 300, 100))).toBe(true);

    // Right half = 64×64: fits to 200×200 centered (x 100..300), all blue.
    const right = doc("video", { x: 0.5, y: 0, width: 0.5, height: 1 });
    expect(isBlue(await at(right, 150, 100))).toBe(true);
    expect(isBlue(await at(right, 250, 100))).toBe(true);
    expect(isEmpty(await at(right, 50, 100))).toBe(true);
  }, 90_000);
});
