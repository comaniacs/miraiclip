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
import { evaluateEffectRegion, type EffectInstance, type EffectRegion } from "@miraiclip/core";
import { RegionFilter } from "./region-filter.js";
import { blurStrengthPx, chromaKeyUniforms, colorAdjustSteps } from "./params.js";
import { FILTER_VERTEX } from "./library/glsl.js";
import { libraryEffectFactories } from "./library/library.js";

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

// Built-ins: the three hand-written kinds plus the whole effect library
// (core's EFFECT_CATALOG) — registered in every bundle, so they cross the
// worker/server boundaries custom renderers can't.
const factories = new Map<string, EffectRendererFactory>([
  ...Object.entries({ colorAdjust, blur, chromaKey }),
  ...libraryEffectFactories(),
]);

const BUILTIN_EFFECT_RENDERERS: ReadonlySet<string> = new Set(factories.keys());

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
export function registerEffectRenderer(
  kind: string,
  factory: EffectRendererFactory,
  options?: { replace?: boolean },
): void {
  const existing = factories.get(kind);
  if (existing === factory) return; // idempotent (plugin loaded twice, HMR re-evaluation)
  if (existing && BUILTIN_EFFECT_RENDERERS.has(kind)) {
    throw new Error(`"${kind}" is a built-in effect renderer and can't be replaced`);
  }
  if (existing && !options?.replace) throw new Error(`effect renderer "${kind}" is already registered`);
  factories.set(kind, factory);
}

/** Remove a custom effect renderer (plugin unload). Returns whether it existed. */
export function unregisterEffectRenderer(kind: string): boolean {
  if (BUILTIN_EFFECT_RENDERERS.has(kind)) throw new Error(`"${kind}" is a built-in effect renderer`);
  return factories.delete(kind);
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
  /** Region wrappers, by effect id (only for effects that have a region). */
  private regions = new Map<string, { filter: RegionFilter; region: EffectRegion }>();
  private localUs = 0;
  private durationUs: number | undefined;
  /** The animated blur (Blur animation): after every effect, so it blurs the finished look. */
  private animatedBlur: BlurFilter | undefined;
  private stack: Filter[] = [];

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
        this.dropRegion(effect.id);
        entry?.filter.destroy();
        entry = factory(effect.params, this.context);
        this.active.set(effect.id, entry);
      } else {
        entry.update(effect.params);
      }
      seen.add(effect.id);
      filters.push(this.withRegion(effect, entry));
    }
    for (const [id, entry] of this.active) {
      if (!seen.has(id)) {
        this.dropRegion(id);
        entry.filter.destroy();
        this.active.delete(id);
      }
    }
    this.stack = filters;
    this.assignFilters();
    this.invalidate();
  }

  /** Assign in stack order, animated blur last; null clears (Pixi treats [] as filters present). */
  private assignFilters(): void {
    const all = this.animatedBlur ? [...this.stack, this.animatedBlur] : this.stack;
    this.display.filters = all.length > 0 ? all : (null as unknown as Filter[]);
  }

  /**
   * The Blur animation's strength this frame (composition pixels; 0 = off). Called every render
   * for animated clips, so the unchanged cases return before touching the filter list.
   */
  setAnimatedBlur(strengthPx: number): void {
    if (strengthPx <= 0) {
      if (!this.animatedBlur) return;
      const gone = this.animatedBlur;
      this.animatedBlur = undefined;
      this.assignFilters();
      gone.destroy();
      this.invalidate();
      return;
    }
    if (!this.animatedBlur) {
      this.animatedBlur = new BlurFilter();
      this.animatedBlur.strength = strengthPx;
      this.assignFilters();
      this.invalidate();
      return;
    }
    if (this.animatedBlur.strength === strengthPx) return;
    this.animatedBlur.strength = strengthPx;
    this.invalidate();
  }

  /**
   * Clip-relative time for keyframed regions. Called every render while the
   * clip is visible (and once per stack change); a no-op without regions.
   */
  setTime(localUs: number, clipDurationUs?: number): void {
    this.localUs = localUs;
    this.durationUs = clipDurationUs;
    if (this.regions.size === 0) return;
    for (const { filter, region } of this.regions.values()) {
      if (region.animations) filter.setRegion(evaluateEffectRegion(region, localUs, clipDurationUs));
    }
    this.invalidate();
  }

  private withRegion(effect: EffectInstance, entry: ActiveEffect): Filter {
    if (!effect.region) {
      this.dropRegion(effect.id);
      return entry.filter;
    }
    const evaluated = evaluateEffectRegion(effect.region, this.localUs, this.durationUs);
    let wrapped = this.regions.get(effect.id);
    if (!wrapped || wrapped.filter.inner !== entry.filter) {
      this.dropRegion(effect.id);
      wrapped = { filter: new RegionFilter(entry.filter, this.display, evaluated), region: effect.region };
      this.regions.set(effect.id, wrapped);
    } else {
      wrapped.region = effect.region;
      wrapped.filter.setRegion(evaluated);
    }
    return wrapped.filter;
  }

  /** Forget an effect's region wrapper (its inner filter stays owned by `active`). */
  private dropRegion(effectId: string): void {
    const wrapped = this.regions.get(effectId);
    if (!wrapped) return;
    this.regions.delete(effectId);
    wrapped.filter.destroy();
  }

  destroy(): void {
    this.animatedBlur?.destroy();
    this.animatedBlur = undefined;
    for (const id of [...this.regions.keys()]) this.dropRegion(id);
    for (const entry of this.active.values()) entry.filter.destroy();
    this.active.clear();
  }
}

