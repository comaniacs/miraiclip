/**
 * Font assets must be real from the FIRST frame of a server render (Kagura F6.22).
 *
 * The compositor used to be built before `loadFontAssets` finished, so text nodes laid
 * out with the fallback face and kept it: the first still (or export) in a fresh page
 * was wrong, and only a second one, with the font already cached, was right.
 *
 * Needs a browser (MIRAICLIP_BROWSER or the well-known path); skips visibly without one.
 */
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProject, type ProjectDocument } from "@miraiclip/core";
import { createRenderSession, type RenderSession } from "../src/render-session.js";

const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find(
  (p): p is string => p !== undefined && existsSync(p),
);

const here = path.dirname(fileURLToPath(import.meta.url));
const FONT = path.resolve(here, "../../../examples/templates/_shared/assets/BricolageGrotesque-Variable.woff2");

/** A wide, heavy line of white text in a family the browser can only get from the font asset. */
function textDoc(withFont: boolean): ProjectDocument {
  const project = createProject({ width: 640, height: 200, fps: 30 });
  project.transaction(() => {
    if (withFont) {
      project.dispatch({
        type: "asset/add",
        payload: {
          id: "face",
          kind: "font",
          family: "KaguraTestFace",
          src: "face.woff2",
          weightRange: [200, 800],
        },
      });
    }
    project.dispatch({ type: "track/add", payload: { id: "t1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "text",
        id: "c1",
        trackId: "t1",
        text: "Regional Quality 123",
        fontFamily: withFont ? "KaguraTestFace" : "sans-serif",
        fontSizePx: 72,
        fontWeight: 800,
        color: "#ffffff",
        startUs: 0,
        durationUs: 2_000_000,
      },
    });
  });
  return project.toJSON();
}

const same = (a: Uint8Array, b: Uint8Array): boolean =>
  a.length === b.length && a.every((byte, i) => byte === b[i]);

describe.skipIf(browserPath === undefined || !existsSync(FONT))("font assets in server renders", () => {
  let dir: string;
  let session: RenderSession;

  beforeAll(async () => {
    dir = mkdtempSync(path.join(os.tmpdir(), "mc-fonts-"));
    copyFileSync(FONT, path.join(dir, "face.woff2"));
    // A session is one fresh page: the font cache starts cold.
    session = await createRenderSession({
      assetsDir: dir,
      browser: { executablePath: browserPath!, swiftshader: true },
    });
  }, 60_000);

  afterAll(async () => {
    await session?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("the first still in a fresh page already uses the font (it matches the second)", async () => {
    const doc = textDoc(true);
    const first = await session.renderStill(doc, { timeUs: 500_000 });
    const second = await session.renderStill(doc, { timeUs: 500_000 });
    expect(same(first, second)).toBe(true);
  }, 60_000);

  it("and that picture is the font's, not the fallback face's", async () => {
    const withFont = await session.renderStill(textDoc(true), { timeUs: 500_000 });
    const fallback = await session.renderStill(textDoc(false), { timeUs: 500_000 });
    expect(same(withFont, fallback)).toBe(false);
  }, 60_000);
});
