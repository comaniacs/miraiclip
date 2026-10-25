import { describe, expect, it } from "vitest";
import { applyCommands, createProject } from "@miraiclip/core";
import { BRAND_FIELD_KEYS, blockCommands, builtinBlocks, FILM_FORMATS, FILM_OVERLAY, FILM_SCENES as LAUNCH_SCENES, FILM_STYLES, FORMAT_INFO, parseBlock, sceneFormats } from "../src/index.js";

describe("launch scenes", () => {
  it("are valid built-in blocks with the brand fields", () => {
    const names = builtinBlocks().map((b) => b.name);
    for (const scene of LAUNCH_SCENES) {
      const block = parseBlock(scene);
      expect(names).toContain(block.name);
      expect(block.category).toBe("scene");
      expect(sceneFormats(block.tags).length, block.name).toBeGreaterThan(0);
      expect(block.fields.map((f) => f.key)).toEqual(expect.arrayContaining(BRAND_FIELD_KEYS));
      const template = block.content.kind === "html" ? block.content.template : "";
      // Container units, not viewport units: viewport units follow the raster's pixel size (preview density).
      expect(template, block.name).not.toMatch(/\dv(min|max|w|h)\b/);
      expect(template).toContain("container-type:size");
      // Inline SVG needs its namespace inside the XHTML raster, or it doesn't draw.
      for (const svg of template.match(/<svg[^>]*>/g) ?? []) expect(svg, block.name).toContain('xmlns="http://www.w3.org/2000/svg"');
      // Every placeholder is a field, and every field is used.
      const used = new Set([...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));
      expect([...used].sort(), block.name).toEqual(block.fields.map((f) => f.key).sort());
    }
  });

  it("place as one full-frame animated clip each, filled with the brand", () => {
    const p = createProject({ width: 1080, height: 1920, fps: 30 });
    p.dispatch({ type: "asset/add", payload: { id: "brand-image-1", kind: "image", src: "a.png" } });
    let at = 0;
    for (const [i, scene] of LAUNCH_SCENES.entries()) {
      const block = parseBlock(scene);
      const images = Object.fromEntries(block.fields.filter((f) => f.description?.includes("image asset")).map((f) => [f.key, "brand-image-1"]));
      const r = applyCommands(p, blockCommands(block, { id: `s${i}`, trackId: "scenes", createTrack: i === 0, startUs: at, values: { primary: "#155eef", font: "Inter", ...images }, composition: { width: 1080, height: 1920 } }));
      expect(r.ok, `${scene.name}: ${JSON.stringify(!r.ok && r.error)}`).toBe(true);
      const clip = p.getState().doc.clips[`s${i}`] as { animated?: boolean; params?: Record<string, unknown>; widthPx?: number };
      expect(clip.animated).toBe(true);
      expect(clip.widthPx).toBeUndefined();
      expect(clip.params?.primary).toBe("#155eef");
      at += block.content.kind === "html" ? block.content.durationUs : 0;
    }
  });

  it("every format has scenes, and its openers and closers exist", () => {
    const names = LAUNCH_SCENES.map((b) => b.name);
    for (const f of FILM_FORMATS) {
      expect(LAUNCH_SCENES.filter((b) => sceneFormats(b.tags ?? []).includes(f)).length, f).toBeGreaterThanOrEqual(5);
      for (const n of [...FORMAT_INFO[f].openers, ...FORMAT_INFO[f].closers]) expect(names).toContain(n);
      expect(FILM_STYLES.map((s) => s.name)).toContain(FORMAT_INFO[f].defaultStyle);
    }
  });

  it("styles use the bundled fonts and valid colours", () => {
    const fonts = ["Inter", "Instrument Serif", "Playfair Display", "Space Grotesk", "Caveat", "JetBrains Mono", "Bebas Neue", "Permanent Marker", "Archivo Black"];
    for (const s of FILM_STYLES) {
      if (!s.tokens) continue;
      expect(fonts).toContain(s.tokens.font);
      expect(fonts).toContain(s.tokens.display);
      for (const c of [s.tokens.primary, s.tokens.secondary, s.tokens.bg, s.tokens.ink]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("the film overlay is a valid full-frame block", () => {
    const block = parseBlock(FILM_OVERLAY);
    const template = block.content.kind === "html" ? block.content.template : "";
    const used = new Set([...template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]));
    expect([...used].sort()).toEqual(block.fields.map((f) => f.key).sort());
    expect(template).not.toMatch(/\dv(min|max|w|h)\b/);
  });
});
