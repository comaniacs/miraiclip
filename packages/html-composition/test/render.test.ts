/** An imported composition renders through the real pipeline (headless Chromium). */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRenderSession, type RenderSession } from "@miraiclip/server-export";
import { importHtmlComposition } from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(here, "../../../apps/playground/public");
const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));

describe.skipIf(!browserPath)("imported composition renders", () => {
  let session: RenderSession;
  beforeAll(async () => {
    session = await createRenderSession({ assetsDir: FIXTURES, browser: { executablePath: browserPath!, swiftshader: true } });
  }, 60_000);
  afterAll(async () => {
    await session?.close();
  });

  it("draws video, styled image, CSS-animated titles and the root background", async () => {
    const { doc } = importHtmlComposition(readFileSync(path.join(here, "fixtures/launch.html"), "utf8"), {
      mediaDurationsUs: { "e2e-frames.webm": 4_000_000, "e2e-tone.webm": 4_000_000 },
    });
    const early = await session.renderStill(doc as never, { timeUs: 1_200_000 });
    const late = await session.renderStill(doc as never, { timeUs: 3_500_000 });
    if (process.env["MIRAICLIP_IMPORT_STILLS"]) {
      writeFileSync(path.join(process.env["MIRAICLIP_IMPORT_STILLS"], "import-early.png"), early);
      writeFileSync(path.join(process.env["MIRAICLIP_IMPORT_STILLS"], "import-late.png"), late);
    }
    expect(early.length).toBeGreaterThan(1500);
    expect(late.length).toBeGreaterThan(1500);
  }, 60_000);
});
