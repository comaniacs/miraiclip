/**
 * The rendering half of core's effect library (EFFECT_CATALOG): one Pixi
 * filter factory per built-in kind. Color-matrix looks use Pixi's
 * ColorMatrixFilter presets, grain uses NoiseFilter, and everything else is a
 * data-driven shader (shaders.ts) whose uniforms come straight from the
 * kind's catalog params.
 *
 * Built-in = registered at module load in every renderer bundle — main
 * thread, the export worker, and the server-export harness — so every kind
 * renders in preview, browser/worker export, server export and stills.
 */
import { EFFECT_CATALOG, type EffectInfo } from "@miraiclip/core";
import { ColorMatrixFilter, Filter, GlProgram, NoiseFilter } from "pixi.js";
import type { EffectContext, EffectRendererFactory } from "../pixi-effects.js";
import { FILTER_VERTEX, buildFragment } from "./glsl.js";
import { EFFECT_SHADERS } from "./shaders.js";

const num = (p: Record<string, unknown>, key: string, fallback: number): number => {
  const v = Number(p[key]);
  return Number.isFinite(v) ? v : fallback;
};

/**
 * Length param (fraction of composition height) → filter-texture pixels.
 * Filters run in output pixels, so the render density applies.
 */
export function lengthPx(fraction: number, context: EffectContext): number {
  if (fraction <= 0) return 0;
  return Math.max(1, fraction * context.compositionSize().height * (context.renderScale?.() ?? 1));
}

export function hexToRgb(hex: unknown): [number, number, number] {
  const m = typeof hex === "string" ? /^#([0-9a-fA-F]{6})$/.exec(hex) : null;
  const v = m ? parseInt(m[1]!, 16) : 0xffffff;
  return [((v >> 16) & 0xff) / 255, ((v >> 8) & 0xff) / 255, (v & 0xff) / 255];
}

/* ---------- color-matrix looks (blended by intensity via the filter's alpha) ---------- */

const MATRIX_LOOKS: Record<string, (f: ColorMatrixFilter) => void> = {
  mono: (f) => f.desaturate(),
  sepia: (f) => f.sepia(false),
  vintage: (f) => f.vintage(false),
  polaroid: (f) => f.polaroid(false),
  kodachrome: (f) => f.kodachrome(false),
  technicolor: (f) => f.technicolor(false),
  invert: (f) => f.negative(false),
  thermal: (f) => f.predator(1, false),
};

function matrixLook(info: EffectInfo, preset: (f: ColorMatrixFilter) => void): EffectRendererFactory {
  const fallback = Number(info.params.find((p) => p.key === "intensity")?.default ?? 1);
  return (params) => {
    const filter = new ColorMatrixFilter();
    preset(filter);
    const update = (p: Record<string, unknown>): void => {
      filter.alpha = num(p, "intensity", fallback);
    };
    update(params);
    return { kind: info.kind, filter, update };
  };
}

/* ---------- film grain: fixed seed, so preview and export match ---------- */

const grain: EffectRendererFactory = (params) => {
  const filter = new NoiseFilter({ noise: 0.3, seed: 0.5 });
  const update = (p: Record<string, unknown>): void => {
    filter.noise = Math.max(0.0001, num(p, "intensity", 0.3) * 0.6);
  };
  update(params);
  return { kind: "grain", filter, update };
};

/* ---------- data-driven shaders ---------- */

function shaderEffect(info: EffectInfo): EffectRendererFactory | undefined {
  const shader = EFFECT_SHADERS[info.kind];
  if (!shader) return undefined;
  const fragment = buildFragment(shader, info.params);
  return (initial, context) => {
    const uniforms: Record<string, { value: number | number[]; type: string }> = {};
    for (const p of info.params) {
      uniforms[`u_${p.key}`] = p.type === "color" ? { value: [1, 1, 1], type: "vec3<f32>" } : { value: 0, type: "f32" };
    }
    // Pixi rejects an empty uniform group; param-less kinds get a placeholder.
    if (info.params.length === 0) uniforms["u_unused"] = { value: 0, type: "f32" };
    const filter = new Filter({
      glProgram: GlProgram.from({ vertex: FILTER_VERTEX, fragment, name: `miraiclip-${info.kind}` }),
      resources: { u: uniforms },
    });
    const group = (filter.resources as { u: { uniforms: Record<string, unknown> } }).u.uniforms;
    const update = (values: Record<string, unknown>): void => {
      for (const p of info.params) {
        if (p.type === "color") group[`u_${p.key}`] = hexToRgb(values[p.key] ?? p.default);
        else {
          const v = num(values, p.key, p.default);
          group[`u_${p.key}`] = p.length ? lengthPx(v, context) : v;
        }
      }
    };
    update(initial);
    return { kind: info.kind, filter, update };
  };
}

/** Factories for every catalog kind except the hand-written built-ins (colorAdjust, blur, chromaKey). */
export function libraryEffectFactories(): [string, EffectRendererFactory][] {
  const out: [string, EffectRendererFactory][] = [];
  for (const info of EFFECT_CATALOG) {
    const preset = MATRIX_LOOKS[info.kind];
    const factory = preset ? matrixLook(info, preset) : info.kind === "grain" ? grain : shaderEffect(info);
    if (factory) out.push([info.kind, factory]);
  }
  return out;
}
