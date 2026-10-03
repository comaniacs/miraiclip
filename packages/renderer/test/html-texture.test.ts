import { describe, expect, it } from "vitest";
import { htmlTextureSource } from "../src/compositor/pixi-backend.js";

describe("htmlTextureSource", () => {
  it("never resizes (and so clears) the raster canvas, whatever the density", () => {
    for (const out of [2560, 2720, 2730, 2800, 3000, 3840]) {
      const density = out / 1920;
      const w = Math.round(980 * density);
      const h = Math.round(700 * density);
      const canvas = { width: w, height: h, getContext: () => null } as unknown as HTMLCanvasElement;
      const source = htmlTextureSource(canvas, density);
      expect([canvas.width, canvas.height]).toEqual([w, h]);
      expect(source.pixelWidth).toBe(w);
      expect(source.width).toBeCloseTo(w / density, 6);
    }
  });
});
