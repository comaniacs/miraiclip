/** An imported composition renders through the real pipeline (headless Chromium). */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRenderSession, type RenderSession } from "@miraiclip/server-export";
import { createProject } from "@miraiclip/core";
import { describeHtml, importHtmlComposition, planHtmlEdit } from "../src/index.js";
import { decodePng } from "./png.js";

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

  it("an html clip edited by element still renders, with the edit drawn", async () => {
    const template =
      `<div style="position:absolute; left:0; top:0; width:400px; height:400px; background:#ffffff">` +
      `<div class="stub" style="position:absolute; left:20px; top:20px; width:100px; height:100px; background:#0000ff"></div>` +
      `<p style="position:absolute; left:20px; top:200px; font-size:40px; margin:0">SEAT 14</p></div>`;
    const p = createProject({ width: 400, height: 400, fps: 30 });
    p.transaction(() => {
      p.dispatch({ type: "track/add", payload: { id: "t", kind: "video" } });
      p.dispatch({ type: "clip/add", payload: { kind: "html", id: "ticket", trackId: "t", startUs: 0, durationUs: 1_000_000, template, params: {} } });
    });
    const pixel = (png: Uint8Array, x: number, y: number) => {
      const { width, rgb } = decodePng(png);
      return [...rgb.subarray((y * width + x) * 3, (y * width + x) * 3 + 3)];
    };
    const before = await session.renderStill(p.getState().doc as never, { timeUs: 0 });
    expect(pixel(before, 70, 70)).toEqual([0, 0, 255]);
    expect(pixel(before, 270, 70)).toEqual([255, 255, 255]);

    const stub = describeHtml(template).elements.find((e) => e.attrs.class === "stub")!.id;
    const seat = describeHtml(template).elements.find((e) => e.text === "SEAT 14")!.id;
    const commands = planHtmlEdit(p.getState().doc, "ticket", [
      { op: "style", id: stub, set: { left: "220px", background: "#ff0000" } },
      { op: "text", id: seat, text: "SEAT 15" },
    ]);
    p.transaction(() => commands.forEach((c) => p.dispatch(c)));
    const after = await session.renderStill(p.getState().doc as never, { timeUs: 0 });
    expect(pixel(after, 70, 70)).toEqual([255, 255, 255]);
    expect(pixel(after, 270, 70)).toEqual([255, 0, 0]);
  }, 60_000);
});
