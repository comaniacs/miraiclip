import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createProject, type ProjectDocument } from "@miraiclip/core";
import { exportHtmlComposition, importHtmlComposition } from "../src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(path.join(here, "fixtures/launch.html"), "utf8");
const S = 1_000_000;

describe("importHtmlComposition", () => {
  const { doc, warnings } = importHtmlComposition(FIXTURE, { mediaDurationsUs: { "e2e-frames.webm": 4 * S, "e2e-tone.webm": 4 * S } });

  it("reads the canvas and every timed element", () => {
    expect(doc.settings).toEqual({ width: 320, height: 180, fps: 30, name: "launch" });
    expect(Object.keys(doc.clips).sort()).toEqual(["bars", "composition-background", "cta", "music", "shot", "title"]);
    expect(doc.clips["shot"]).toMatchObject({ kind: "video", startUs: 0, durationUs: 3 * S, trimStartUs: 0.5 * S, volume: 0, trackId: "v0" });
    expect(doc.clips["music"]).toMatchObject({ kind: "audio", volume: 0.4, trackId: "a3", durationUs: 4 * S });
    expect(doc.assets["e2e-frames"]).toMatchObject({ kind: "video", src: "e2e-frames.webm", durationUs: 4 * S });
  });

  it("resolves relative start times (\"<id> + n\" = n seconds after that clip ends)", () => {
    expect(doc.clips["title"]).toMatchObject({ startUs: 0.5 * S, durationUs: 1.5 * S });
    expect(doc.clips["cta"]).toMatchObject({ startUs: 2.5 * S, durationUs: 1.5 * S });
  });

  it("keeps styled elements as html clips with the page CSS, well-formed for the rasterizer", () => {
    const title = doc.clips["title"]!;
    expect(title).toMatchObject({ kind: "html", animated: true });
    const template = String(title["template"]);
    expect(template).toContain("@keyframes rise");
    expect(template).toContain("<br/>");
    expect(template).toContain(".card &gt; span");
    expect(template).not.toContain("data-start");
    expect(template).not.toContain("<script");
    expect(String(doc.clips["bars"]!["template"])).toContain('src="asset:corpus-bars"');
    expect(String(doc.clips["composition-background"]!["template"])).toContain("background:#101828");
    // well-formed XML (what the html rasterizer parses)
    for (const clip of Object.values(doc.clips)) {
      if (clip.kind !== "html") continue;
      expect(String(clip["template"]).match(/<img[^>]*[^/]>/), clip.id).toBeNull();
    }
  });

  it("orders layers bottom-up and loads into core", () => {
    expect(doc.trackOrder).toEqual(["background", "v0", "v1", "v2", "a3"]);
    const project = createProject(doc as unknown as ProjectDocument);
    expect(Object.keys(project.getState().doc.clips)).toHaveLength(6);
    expect(warnings.some((w) => w.includes("script-driven"))).toBe(true);
  });

  it("round-trips through export: same clips, timings, tracks and assets", () => {
    const { html, warnings: exportWarnings } = exportHtmlComposition(doc);
    expect(exportWarnings).toEqual([]);
    const again = importHtmlComposition(html, { mediaDurationsUs: { "e2e-frames.webm": 4 * S, "e2e-tone.webm": 4 * S } }).doc;
    const shape = (d: typeof doc) =>
      Object.values(d.clips)
        .filter((c) => c.id !== "composition-background")
        .map((c) => ({ id: c.id, kind: c.kind, startUs: c.startUs, durationUs: c.durationUs, trimStartUs: c["trimStartUs"], volume: c["volume"] }))
        .sort((a, b) => a.id.localeCompare(b.id));
    expect(shape(again)).toEqual(shape(doc));
    expect(again.settings).toEqual(doc.settings);
    expect(Object.values(again.assets).map((a) => a.src).sort()).toEqual(Object.values(doc.assets).map((a) => a.src).sort());
  });

  it("reports what it can't import", () => {
    const { warnings: w } = importHtmlComposition(
      `<div data-composition-id="x" data-width="100" data-height="100"><div data-start="nope + 1" data-duration="1">a</div><div data-composition-src="intro.html" data-start="0"></div></div>`,
    );
    expect(w.join("\n")).toMatch(/couldn't resolve/);
    expect(w.join("\n")).toMatch(/nested composition/);
    expect(() => importHtmlComposition("<p>hi</p>")).not.toThrow();
  });
});

export const fixtureExists = existsSync(path.join(here, "fixtures/launch.html"));
