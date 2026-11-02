/**
 * Per-axis stretch and flip draw through the real compositor and export path
 * (Kagura F6.13): a mirrored or stretched text clip is a different picture from the plain
 * one, and a mirror of a mirror is the plain picture again.
 *
 * Needs a browser (MIRAICLIP_BROWSER or the well-known path); skips visibly without one.
 */
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProject, type ProjectDocument } from "@miraiclip/core";
import { createRenderSession, type RenderSession } from "../src/render-session.js";

const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find(
  (p): p is string => p !== undefined && existsSync(p),
);

function doc(transform: Record<string, number>): ProjectDocument {
  const project = createProject({ width: 640, height: 360, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "track/add", payload: { id: "t1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "text",
        id: "c1",
        trackId: "t1",
        text: "Left Heavy 123",
        fontFamily: "sans-serif",
        fontSizePx: 56,
        fontWeight: 800,
        color: "#ffffff",
        startUs: 0,
        durationUs: 2_000_000,
        transform: { x: 0.3, y: 0.5, ...transform },
      },
    });
  });
  return project.toJSON();
}

const same = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((byte, i) => byte === b[i]);

describe.skipIf(browserPath === undefined)("scaleX / scaleY in server renders", () => {
  let session: RenderSession;
  beforeAll(async () => {
    session = await createRenderSession({
      browser: { executablePath: browserPath!, swiftshader: true },
    });
  }, 60_000);
  afterAll(async () => {
    await session?.close();
  });

  const still = (transform: Record<string, number>) =>
    session.renderStill(doc(transform), { timeUs: 500_000 });

  it("a mirrored clip is a different picture, and mirroring left-right is not mirroring top-bottom", async () => {
    const plain = await still({});
    const mirrored = await still({ scaleX: -1 });
    expect(same(plain, mirrored)).toBe(false);
    const upsideDown = await still({ scaleY: -1 });
    expect(same(plain, upsideDown)).toBe(false);
    expect(same(mirrored, upsideDown)).toBe(false);
  }, 60_000);

  it("a stretched clip differs from a plain one and from a uniform scale", async () => {
    const plain = await still({});
    const stretched = await still({ scaleX: 1.5 });
    const uniform = await still({ scale: 1.5 });
    expect(same(plain, stretched)).toBe(false);
    expect(same(stretched, uniform)).toBe(false);
  }, 60_000);
});
