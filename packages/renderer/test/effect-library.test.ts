import { describe, expect, it } from "vitest";
import { EFFECT_CATALOG, effectParamsSchema } from "@miraiclip/core";
import { getEffectRenderer } from "../src/effects/pixi-effects.js";
import { buildFragment } from "../src/effects/library/glsl.js";
import { hexToRgb, lengthPx } from "../src/effects/library/library.js";
import { EFFECT_SHADERS } from "../src/effects/library/shaders.js";

describe("effect library (renderer half)", () => {
  it("every catalog kind has a built-in renderer", () => {
    const missing = EFFECT_CATALOG.filter((e) => !getEffectRenderer(e.kind)).map((e) => e.kind);
    expect(missing).toEqual([]);
  });

  it("every shader belongs to a catalog kind", () => {
    const kinds = new Set(EFFECT_CATALOG.map((e) => e.kind));
    expect(Object.keys(EFFECT_SHADERS).filter((k) => !kinds.has(k))).toEqual([]);
  });

  it("shaders only reference uniforms their catalog params declare (catalog ↔ shader drift)", () => {
    for (const info of EFFECT_CATALOG) {
      const shader = EFFECT_SHADERS[info.kind];
      if (!shader) continue;
      const declared = new Set(info.params.map((p) => p.key));
      const used = new Set([...shader.glsl.matchAll(/\bu_(\w+)/g)].map((m) => m[1]!));
      for (const key of used) expect(declared.has(key), `${info.kind} uses u_${key}`).toBe(true);
      const fragment = buildFragment(shader, info.params);
      for (const p of info.params) {
        expect(fragment, `${info.kind}.${p.key}`).toContain(
          p.type === "color" ? `uniform vec3 u_${p.key};` : `uniform float u_${p.key};`,
        );
      }
      expect(fragment).toContain("void main(void)");
    }
  });

  it("shader bodies stay GLSL ES 1.00-compatible (Pixi may compile for WebGL1)", () => {
    for (const [kind, shader] of Object.entries(EFFECT_SHADERS)) {
      expect(shader.glsl, kind).not.toMatch(/float\[\d+\]|\bivec\d?\s*\w+\s*=\s*ivec|\buint\b|texelFetch|textureSize/);
    }
  });

  it("color-mode kinds with an intensity param blend by it", () => {
    const info = EFFECT_CATALOG.find((e) => e.kind === "warm")!;
    expect(buildFragment(EFFECT_SHADERS["warm"]!, info.params)).toContain("mix(src, rgb, u_intensity)");
    const gamma = EFFECT_CATALOG.find((e) => e.kind === "gamma")!;
    expect(buildFragment(EFFECT_SHADERS["gamma"]!, gamma.params)).toContain("mix(src, rgb, 1.0)");
  });

  it("length params: fraction of composition HEIGHT → output pixels", () => {
    const ctx = { compositionSize: () => ({ width: 1080, height: 1920 }) };
    expect(lengthPx(0.01, ctx)).toBeCloseTo(19.2, 6);
    expect(lengthPx(0.01, { ...ctx, renderScale: () => 2 })).toBeCloseTo(38.4, 6); // hi-DPI / upscaled export
    expect(lengthPx(0, ctx)).toBe(0);
    expect(lengthPx(0.00001, ctx)).toBe(1); // never sub-pixel
  });

  it("colors parse to normalized rgb", () => {
    expect(hexToRgb("#ff8000")).toEqual([1, 128 / 255, 0]);
    expect(hexToRgb("bad")).toEqual([1, 1, 1]);
  });

  it("every kind's schema defaults cover every param the renderer reads", () => {
    for (const info of EFFECT_CATALOG) {
      const parsed = effectParamsSchema(info.kind)!.parse({}) as Record<string, unknown>;
      for (const p of info.params) expect(parsed[p.key], `${info.kind}.${p.key}`).toBeDefined();
    }
  });
});
