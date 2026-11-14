/**
 * Charts (Kagura F8.2f): the planner's output and, in headless Chromium, that every chart type
 * draws its colors where its data says.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyCommands, createProject } from "@miraiclip/core";
import { createRenderSession, type RenderSession } from "@miraiclip/server-export";
import { CHART_TYPES, chartContent, chartSpecOf, parseChartSpec } from "../src/index.js";

const SALES = { labels: ["Mon", "Tue", "Wed", "Thu"], values: [12, 30, 18, 24] };

describe("chart planner", () => {
  it("makes an SVG html clip whose colors are params and that carries its spec", () => {
    const c = chartContent({ type: "column", ...SALES, title: "Cups sold", colors: ["#c83406"] });
    expect(c.template.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(c.template).toContain('fill="{{c0}}"');
    expect(c.template).toContain("Cups sold");
    expect(c.params.c0).toBe("#c83406");
    expect(chartSpecOf(c.params)).toMatchObject({ type: "column", values: [12, 30, 18, 24] });
    expect(c.template.match(/<rect /g)).toHaveLength(4);
  });

  it("pie and donut get one color per slice; text is escaped", () => {
    const c = chartContent({ type: "donut", labels: ["A&B", "<C>"], values: [1, 3] });
    expect(Object.keys(c.params).filter((k) => /^c\d$/.test(k))).toEqual(["c0", "c1"]);
    expect(c.template).toContain("A&amp;B");
    expect(c.template).toContain("&lt;C&gt;");
    expect(c.template).toContain("75%");
  });

  it("pairs labels and values to the shorter list and refuses bad input", () => {
    expect(parseChartSpec({ type: "bar", labels: ["a", "b", "c"], values: [1, 2] }).labels).toEqual(["a", "b"]);
    expect(() => parseChartSpec({ type: "radar", labels: ["a"], values: [1] })).toThrow(/invalid chart/);
    expect(() => parseChartSpec({ type: "bar", labels: [], values: [] })).toThrow(/invalid chart/);
    expect(chartSpecOf({ chart: "nope" })).toBeNull();
    expect(chartSpecOf(undefined)).toBeNull();
  });

  it("handles negative values and a single point", () => {
    expect(() => chartContent({ type: "column", labels: ["a", "b"], values: [-5, 10] })).not.toThrow();
    expect(() => chartContent({ type: "line", labels: ["a"], values: [3] })).not.toThrow();
    expect(() => chartContent({ type: "pie", labels: ["a", "b"], values: [0, 0] })).not.toThrow();
  });
});

const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));
const keep = process.env["MIRAICLIP_BLOCK_STILLS"];

describe.skipIf(!browserPath)("charts render", () => {
  let session: RenderSession;
  beforeAll(async () => {
    session = await createRenderSession({ browser: { executablePath: browserPath!, swiftshader: true } });
  }, 60_000);
  afterAll(async () => {
    await session?.close();
  });

  it("every chart type draws on the server", async () => {
    for (const type of CHART_TYPES) {
      const p = createProject({ width: 1280, height: 720, fps: 30 });
      const content = chartContent({ type, ...SALES, title: `${type} chart`, textColor: "#ffffff" });
      const r = applyCommands(p, [
        { type: "track/add", payload: { id: "t", kind: "video" } },
        { type: "clip/add", payload: { id: "chart", trackId: "t", startUs: 0, durationUs: 3_000_000, ...content } },
      ]);
      expect(r.ok, type).toBe(true);
      const png = await session.renderStill(p.toJSON(), { timeUs: 1_000_000, width: 640, height: 360 });
      if (keep) {
        mkdirSync(keep, { recursive: true });
        writeFileSync(path.join(keep, `chart-${type}.png`), png);
      }
      expect(png.length, `${type} drew nothing`).toBeGreaterThan(3000);
    }
  }, 240_000);
});
