/**
 * Every built-in html block through the real renderer (headless Chromium):
 * each one draws something at its settled moment, in 16:9 and 9:16. Set
 * MIRAICLIP_BLOCK_STILLS=<dir> to keep the PNGs for a visual review.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProject, applyCommands } from "@miraiclip/core";
import { createRenderSession, type RenderSession } from "@miraiclip/server-export";
import { blockCommands, builtinBlocks } from "../src/index.js";

const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));
const keep = process.env["MIRAICLIP_BLOCK_STILLS"];

describe.skipIf(!browserPath)("built-in blocks render", () => {
  let session: RenderSession;
  beforeAll(async () => {
    session = await createRenderSession({ browser: { executablePath: browserPath!, swiftshader: true } });
  }, 60_000);
  afterAll(async () => {
    await session?.close();
  });

  for (const [width, height] of [[1920, 1080], [1080, 1920]] as const) {
    it(`every html block draws at ${width}×${height}`, async () => {
      for (const block of builtinBlocks()) {
        if (block.content.kind !== "html") continue;
        const p = createProject({ width, height, fps: 30 });
        p.dispatch({ type: "track/add", payload: { id: "bg", kind: "video" } });
        p.dispatch({
          type: "clip/add",
          payload: { kind: "html", id: "bgc", trackId: "bg", startUs: 0, durationUs: 20_000_000, template: `<div style="width:100%;height:100%;background:#556070"></div>` },
        });
        const result = applyCommands(p, blockCommands(block, { id: "b", trackId: "o", createTrack: true, startUs: 0, composition: { width, height } }));
        expect(result.ok, block.name).toBe(true);
        // The settled moment: after entrances, before exits.
        const timeUs = Math.min(Math.round(block.content.durationUs * 0.6), block.content.durationUs - 500_000);
        const png = await session.renderStill(p.toJSON(), { timeUs: Math.max(0, timeUs), width: width / 4, height: height / 4 });
        if (keep) {
          mkdirSync(keep, { recursive: true });
          writeFileSync(path.join(keep, `${block.name}-${width}x${height}.png`), png);
        }
        // A flat background compresses to a few hundred bytes; any drawn block adds detail.
        expect(png.length, `${block.name} drew nothing`).toBeGreaterThan(600);
      }
    }, 240_000);
  }
});
