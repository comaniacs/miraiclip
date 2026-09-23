/**
 * The Pixi half of the effect registry: kind → filter factory. Built-ins
 * (colorAdjust, blur, chromaKey) register through the same public contract
 * custom kinds use — `registerEffectRenderer`. Filters mutate in place on
 * param updates (no shader recompiles while dragging a slider).
 */
import {
  BlurFilter,
  ColorMatrixFilter,
  Filter,
  GlProgram,
  type Container,
} from "pixi.js";
import type { EffectInstance } from "@miraiclip/core";
import { blurStrengthPx, chromaKeyUniforms, colorAdjustSteps } from "./params.js";

export interface EffectContext {
  compositionSize: () => { width: number; height: number };
  /**
   * Physical pixels per composition pixel (output size ÷ composition size,
   * or the preview's devicePixelRatio) — the density at which rasterized
   * content (html rasters, text glyphs) should be generated so it stays sharp
   * when the stage scales up. Absent or 1 = render at composition density.
   */
  renderScale?: () => number;
}

export interface ActiveEffect {
  kind: string;
  /** The Pixi filter applied to the clip's node (destroyed when removed). */
  filter: Filter;
  /** Apply new params IN PLACE — called on every `effect/update`, so no shader recompiles. */
  update(params: Record<string, unknown>): void;
}

/**
 * Builds the live filter for one effect instance. `params` arrive validated
 * against the kind's core schema (register it with `registerEffectKind`);
 * length-denoting params should be composition-relative fractions, converted
 * to pixels via `context.compositionSize()` — absolute pixels diverge between
 * scaled preview and full-res export.
 */
export type EffectRendererFactory = (
  params: Record<string, unknown>,
  context: EffectContext,
) => ActiveEffect;

// ---------------------------------------------------------------------------
// Built-ins
// ---------------------------------------------------------------------------

const colorAdjust: EffectRendererFactory = (params) => {
  const filter = new ColorMatrixFilter();
  const apply = (p: Record<string, unknown>): void => {
    const steps = colorAdjustSteps(p);
    filter.reset();
    if (steps.brightness !== 1) filter.brightness(steps.brightness, true);
    if (steps.contrast !== 0) filter.contrast(steps.contrast, true);
    if (steps.saturation !== 0) filter.saturate(steps.saturation, true);
    if (steps.hueDeg !== 0) filter.hue(steps.hueDeg, true);
  };
  apply(params);
  return { kind: "colorAdjust", filter, update: apply };
};

const blur: EffectRendererFactory = (params, context) => {
  const filter = new BlurFilter();
  const apply = (p: Record<string, unknown>): void => {
    filter.strength = blurStrengthPx(p, context.compositionSize().height);
  };
  apply(params);
  return { kind: "blur", filter, update: apply };
};

// Standard Pixi v8 filter vertex shader (screen-space quad + input coords).
const FILTER_VERTEX = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

/**
 * Chroma key: distance in the CbCr chroma plane → alpha via smoothstep, plus
 * spill suppression (clamps the key channel toward the other channels' max).
 * Runs on unpremultiplied color and re-premultiplies on the way out.
 */
const CHROMA_FRAGMENT = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec2 uKeyChroma;
uniform float uSimilarity;
uniform float uSmoothness;
uniform float uSpill;

vec2 rgbToChroma(vec3 c)
{
    return vec2(-0.169 * c.r - 0.331 * c.g + 0.5 * c.b,
                 0.5 * c.r - 0.419 * c.g - 0.081 * c.b);
}

void main(void)
{
    vec4 premultiplied = texture(uTexture, vTextureCoord);
    vec3 color = premultiplied.a > 0.0 ? premultiplied.rgb / premultiplied.a : premultiplied.rgb;

    float dist = distance(rgbToChroma(color), uKeyChroma);
    float alpha = smoothstep(uSimilarity, uSimilarity + uSmoothness, dist);

    // Spill suppression: pull the dominant key-side energy down toward the
    // other channels so kept edge pixels lose the green (or key-color) cast.
    float spillMask = 1.0 - smoothstep(uSimilarity, uSimilarity + uSmoothness + uSpill, dist);
    float limit = max(color.r, color.b);
    color.g = mix(color.g, min(color.g, limit), uSpill * spillMask);

    float outAlpha = premultiplied.a * alpha;
    finalColor = vec4(color * outAlpha, outAlpha);
}
`;

const chromaKey: EffectRendererFactory = (params) => {
  const uniforms = chromaKeyUniforms(params);
  const filter = new Filter({
    glProgram: GlProgram.from({ vertex: FILTER_VERTEX, fragment: CHROMA_FRAGMENT }),
    resources: {
      chromaUniforms: {
        uKeyChroma: { value: uniforms.keyChroma, type: "vec2<f32>" },
        uSimilarity: { value: uniforms.similarity, type: "f32" },
        uSmoothness: { value: uniforms.smoothness, type: "f32" },
        uSpill: { value: uniforms.spill, type: "f32" },
      },
    },
  });
  const update = (p: Record<string, unknown>): void => {
    const u = chromaKeyUniforms(p);
    const res = (filter.resources as { chromaUniforms: { uniforms: Record<string, unknown> } })
      .chromaUniforms.uniforms;
    res["uKeyChroma"] = u.keyChroma;
    res["uSimilarity"] = u.similarity;
    res["uSmoothness"] = u.smoothness;
    res["uSpill"] = u.spill;
  };
  return { kind: "chromaKey", filter, update };
};

const factories = new Map<string, EffectRendererFactory>(
  Object.entries({ colorAdjust, blur, chromaKey }),
);

/**
 * Register how a custom effect kind draws: a factory building a Pixi filter
 * from validated params, updated in place on `effect/update`. Pair it with
 * core's `registerEffectKind(kind, paramsSchema)` so commands validate. A
 * kind without a renderer applies no visual (the stack skips it).
 *
 * Custom renderers are functions, so they cannot cross a process or thread
 * boundary: server export and worker export support built-in kinds only —
 * the same rule as custom clip-kind factories.
 */
export function registerEffectRenderer(kind: string, factory: EffectRendererFactory): void {
  if (factories.has(kind)) throw new Error(`effect renderer "${kind}" is already registered`);
  factories.set(kind, factory);
}

export function getEffectRenderer(kind: string): EffectRendererFactory | undefined {
  return factories.get(kind);
}

/**
 * Per-node effect state: diffs the clip's effect stack against live filters,
 * updating params in place and rebuilding only on structural change. Attach
 * one to each Pixi scene node.
 */
export class NodeEffects {
  private active = new Map<string, ActiveEffect>();

  constructor(
    private readonly display: Container,
    private readonly context: EffectContext,
    private readonly invalidate: () => void,
  ) {}

  set(effects: readonly EffectInstance[]): void {
    const filters: Filter[] = [];
    const seen = new Set<string>();
    for (const effect of effects) {
      if (!effect.enabled) continue;
      const factory = factories.get(effect.kind);
      if (!factory) continue; // unknown kind: core validated, renderer has no visual — skip
      let entry = this.active.get(effect.id);
      if (!entry || entry.kind !== effect.kind) {
        entry?.filter.destroy();
        entry = factory(effect.params, this.context);
        this.active.set(effect.id, entry);
      } else {
        entry.update(effect.params);
      }
      seen.add(effect.id);
      filters.push(entry.filter);
    }
    for (const [id, entry] of this.active) {
      if (!seen.has(id)) {
        entry.filter.destroy();
        this.active.delete(id);
      }
    }
    // Assign in stack order; null clears (Pixi treats [] as filters present).
    this.display.filters = filters.length > 0 ? filters : (null as unknown as Filter[]);
    this.invalidate();
  }

  destroy(): void {
    for (const entry of this.active.values()) entry.filter.destroy();
    this.active.clear();
  }
}
