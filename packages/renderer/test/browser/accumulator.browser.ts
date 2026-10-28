import { describe, expect, it } from "vitest";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { browser } from "./harness.js";

const here = dirname(fileURLToPath(import.meta.url));
const compiled = ts.transpileModule(readFileSync(join(here, "../../src/export/frame-accumulator.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const source = `const exports = {}; ${compiled}; const acc = exports;`;

async function run<T>(body: string): Promise<T | null> {
  const b = await browser();
  if (!b) return null;
  const page = await b.newPage();
  try {
    await page.setContent("<canvas id=c></canvas>");
    return (await page.evaluate(`(async () => { ${source}\n${body} })()`)) as T;
  } finally {
    await page.close();
  }
}

const READ = `
  function px(canvas, x, y) {
    const c = document.createElement("canvas"); c.width = canvas.width; c.height = canvas.height;
    const g = c.getContext("2d"); g.drawImage(canvas, 0, 0);
    return Array.from(g.getImageData(x, y, 1, 1).data);
  }
  function paint(w, h, f) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d"); f(g, w, h); return c;
  }`;

describe("frame accumulator (real GPU path)", () => {
  it("averages in linear light: white + black is 188, not the 128 an sRGB mean gives", async () => {
    const r = await run<number[] | "unsupported">(`${READ}
      const white = paint(8, 8, (g) => { g.fillStyle = "#fff"; g.fillRect(0, 0, 8, 8); });
      const black = paint(8, 8, (g) => { g.fillStyle = "#000"; g.fillRect(0, 0, 8, 8); });
      const src = document.createElement("canvas"); src.width = 8; src.height = 8;
      const a = acc.createFrameAccumulator(src, 8, 8);
      if (!a) return "unsupported";
      a.reset();
      const s = src.getContext("2d");
      s.drawImage(white, 0, 0); a.add(0.5);
      s.drawImage(black, 0, 0); a.add(0.5);
      a.resolve();
      return px(a.canvas, 4, 4);`);
    if (r === null) return;
    expect(r).not.toBe("unsupported");
    const [red, green, blue, alpha] = r as number[];
    for (const c of [red, green, blue]) expect(Math.abs(c! - 188)).toBeLessThanOrEqual(2);
    expect(alpha).toBe(255);
  });

  it("keeps the picture upright through add + resolve and through copy", async () => {
    const r = await run<{ resolved: number[][]; copied: number[][] } | "unsupported">(`${READ}
      const src = paint(8, 8, (g) => { g.fillStyle = "#f00"; g.fillRect(0, 0, 8, 4); g.fillStyle = "#00f"; g.fillRect(0, 4, 8, 4); });
      const a = acc.createFrameAccumulator(src, 8, 8);
      if (!a) return "unsupported";
      a.reset(); a.add(1); a.resolve();
      const resolved = [px(a.canvas, 4, 1), px(a.canvas, 4, 6)];
      a.copy();
      return { resolved, copied: [px(a.canvas, 4, 1), px(a.canvas, 4, 6)] };`);
    if (r === null) return;
    expect(r).not.toBe("unsupported");
    const { resolved, copied } = r as { resolved: number[][]; copied: number[][] };
    for (const [top, bottom] of [resolved, copied] as const) {
      expect(top![0]).toBeGreaterThan(250); // red on top
      expect(top![2]).toBeLessThan(5);
      expect(bottom![2]).toBeGreaterThan(250); // blue below
      expect(bottom![0]).toBeLessThan(5);
    }
  });

  it("a moving bar sums to a smooth ramp with weights that add to 1", async () => {
    const r = await run<number[] | "unsupported">(`${READ}
      const src = document.createElement("canvas"); src.width = 16; src.height = 4;
      const a = acc.createFrameAccumulator(src, 16, 4);
      if (!a) return "unsupported";
      const s = src.getContext("2d");
      a.reset();
      for (let i = 0; i < 4; i++) {
        s.fillStyle = "#000"; s.fillRect(0, 0, 16, 4);
        s.fillStyle = "#fff"; s.fillRect(4 + i * 2, 0, 4, 4);
        a.add(0.25);
      }
      a.resolve();
      return [0, 3, 5, 7, 9, 11, 13].map((x) => px(a.canvas, x, 2)[0]);`);
    if (r === null) return;
    expect(r).not.toBe("unsupported");
    const row = r as number[];
    expect(row[0]).toBe(0);
    expect(row[2]!).toBeGreaterThan(row[1]!); // x=5 holds one sample, x=7 two: it ramps up
    expect(row[3]!).toBeGreaterThan(row[2]!);
    expect(row.some((v) => v > 0 && v < 250)).toBe(true); // a smear exists, not a hard edge
  });
});
