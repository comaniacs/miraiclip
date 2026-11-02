/**
 * Outline and shadow / glow on text clips, through the real compositor (Kagura F6.15):
 * white text on black, so any red or blue pixel can only come from the decoration.
 *
 * Needs a browser (MIRAICLIP_BROWSER or the well-known path); skips visibly without one.
 */
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProject, type ProjectDocument } from "@miraiclip/core";
import { createRenderSession, type RenderSession } from "../src/render-session.js";
import { countPixels, type Rgba } from "./png.js";

const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find(
  (p): p is string => p !== undefined && existsSync(p),
);

function doc(decoration: Record<string, unknown> = {}): ProjectDocument {
  const project = createProject({ width: 400, height: 200, fps: 10 });
  project.dispatch({ type: "track/add", payload: { id: "t1", kind: "video" } });
  project.dispatch({
    type: "clip/add",
    payload: {
      kind: "text",
      id: "c",
      trackId: "t1",
      startUs: 0,
      durationUs: 1_000_000,
      text: "HI",
      fontSizePx: 120,
      fontWeight: 900,
      color: "#ffffff",
      ...decoration,
    },
  } as never);
  return project.toJSON();
}

const reddish = ([r, g, b]: Rgba) => r > 120 && g < 60 && b < 60;
const bluish = ([r, g, b]: Rgba) => b > 120 && r < 60 && g < 60;
const lit = ([r, g, b]: Rgba) => r > 150 && g > 150 && b > 150;

describe.skipIf(browserPath === undefined)("text decoration in server renders", () => {
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

  const still = (d: ProjectDocument) => session.renderStill(d, { timeUs: 400_000 });

  it("plain text has no colored pixels", async () => {
    const png = await still(doc());
    expect(countPixels(png, lit)).toBeGreaterThan(500);
    expect(countPixels(png, reddish)).toBe(0);
    expect(countPixels(png, bluish)).toBe(0);
  }, 90_000);

  it("an outline draws its color around the glyphs and the white stays", async () => {
    const png = await still(doc({ strokeColor: "#ff0000", strokeWidthFrac: 0.12 }));
    expect(countPixels(png, reddish)).toBeGreaterThan(300);
    expect(countPixels(png, lit)).toBeGreaterThan(200);
  }, 90_000);

  it("a hard shadow draws a copy offset below; a glow (no offset) draws all around", async () => {
    const shadow = await still(doc({ shadowColor: "#0000ff", shadowBlurFrac: 0, shadowOffsetFrac: 0.12 }));
    expect(countPixels(shadow, bluish)).toBeGreaterThan(200);
    const glow = await still(doc({ shadowColor: "#ff0000", shadowBlurFrac: 0.4, shadowOffsetFrac: 0 }));
    expect(countPixels(glow, (p) => p[0] > 60 && p[1] < 40 && p[2] < 40)).toBeGreaterThan(500);
  }, 90_000);
});
