/** The browser path works: layout is real, seeking is deterministic. */
import { afterAll, describe, expect, it } from "vitest";
import { browser, fixture, openShot, SIZES, type SizeName } from "./harness.js";

afterAll(async () => (await browser())?.close());

describe("browser harness", () => {
  for (const name of Object.keys(SIZES) as SizeName[]) {
    it(`measures a box at ${name}`, async (ctx) => {
      const shot = await openShot(fixture("measure.html"), name);
      if (!shot) return ctx.skip();
      const { width, height } = SIZES[name];
      const box = await shot.page.evaluate(() => {
        const r = document.getElementById("box")!.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      });
      expect(box.left).toBeCloseTo(width * 0.1, 0);
      expect(box.top).toBeCloseTo(height * 0.2, 0);
      expect(box.width).toBeCloseTo(width * 0.3, 0);
      await shot.seek(0.5);
      const moved = await shot.page.evaluate(() => document.getElementById("box")!.getBoundingClientRect().left);
      expect(moved).toBeCloseTo(width * 0.1 + 50, 0);
      await shot.close();
    });
  }
});
