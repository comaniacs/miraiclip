/**
 * Region-limited effects: runs any effect filter, then mixes its result with
 * the untouched clip through a rect or ellipse mask (optionally feathered or
 * inverted). The mask lives in the clip's LOCAL space, so a blurred field or
 * a spotlight stays on the same content while the clip moves, zooms or
 * rotates — the mapping from screen pixels to local pixels is rebuilt from
 * the node's world transform on every draw.
 */
import { AlphaFilter, Filter, GlProgram, Matrix, Texture, TexturePool, type Container, type FilterSystem, type RenderSurface } from "pixi.js";
import type { EvaluatedRegion } from "@miraiclip/core";
import { FILTER_VERTEX } from "./library/glsl.js";

const REGION_FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uInner;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform mat3 uToLocal;
uniform vec4 uRegion;
uniform float uFeather;
uniform float uEllipse;
uniform float uInvert;

void main(void)
{
    vec4 original = texture(uTexture, vTextureCoord);
    vec4 processed = texture(uInner, vTextureCoord);
    vec2 frame = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
    vec2 screen = uOutputFrame.xy + frame * uOutputFrame.zw;
    vec2 p = (uToLocal * vec3(screen, 1.0)).xy;

    vec2 halfSize = max(uRegion.zw * 0.5, vec2(1e-4));
    vec2 center = uRegion.xy + halfSize;
    float inside;
    if (uEllipse > 0.5) {
        vec2 q = (p - center) / halfSize;
        inside = (1.0 - length(q)) * min(halfSize.x, halfSize.y);
    } else {
        vec2 d = halfSize - abs(p - center);
        inside = min(d.x, d.y);
    }
    float m = uFeather > 0.0 ? clamp(inside / uFeather, 0.0, 1.0) : step(0.0, inside);
    if (uInvert > 0.5) m = 1.0 - m;
    finalColor = mix(original, processed, m);
}
`;

let program: GlProgram | undefined;
let copier: AlphaFilter | undefined;

/** Wraps an effect's filter so it only applies inside (or outside) a region. */
export class RegionFilter extends Filter {
  private region: EvaluatedRegion;
  private readonly matrix = new Matrix();

  constructor(
    public inner: Filter,
    private readonly display: Container,
    region: EvaluatedRegion,
  ) {
    program ??= GlProgram.from({ vertex: FILTER_VERTEX, fragment: REGION_FRAGMENT, name: "miraiclip-region" });
    super({
      glProgram: program,
      resources: {
        regionUniforms: {
          uToLocal: { value: new Matrix(), type: "mat3x3<f32>" },
          uRegion: { value: new Float32Array(4), type: "vec4<f32>" },
          uFeather: { value: 0, type: "f32" },
          uEllipse: { value: 0, type: "f32" },
          uInvert: { value: 0, type: "f32" },
        },
        uInner: Texture.WHITE.source,
      },
    });
    this.region = region;
    this.padding = inner.padding;
  }

  setRegion(region: EvaluatedRegion): void {
    this.region = region;
  }

  override apply(
    filterManager: FilterSystem,
    input: Texture,
    output: RenderSurface,
    clearMode: boolean,
  ): void {
    this.padding = this.inner.padding;
    // Multi-pass filters (blur) ping-pong through their INPUT texture, so the
    // inner effect runs on a copy and the original stays intact for the mix.
    copier ??= new AlphaFilter({ alpha: 1 });
    const source = TexturePool.getSameSizeTexture(input);
    filterManager.applyFilter(copier, input, source, true);
    const temp = TexturePool.getSameSizeTexture(input);
    this.inner.apply(filterManager, source, temp, true);
    TexturePool.returnTexture(source);

    const uniforms = (this.resources as { regionUniforms: { uniforms: Record<string, unknown> } }).regionUniforms.uniforms;
    const bounds = this.display.getLocalBounds();
    const w = bounds.width || 1;
    const h = bounds.height || 1;
    // screen → local (inverse world transform), then local → region space in local px.
    this.matrix.copyFrom(this.display.worldTransform).invert();
    const toLocal = uniforms["uToLocal"] as Matrix;
    toLocal.copyFrom(this.matrix);
    toLocal.tx -= bounds.x;
    toLocal.ty -= bounds.y;
    const r = this.region;
    const rect = uniforms["uRegion"] as Float32Array;
    rect[0] = r.x * w;
    rect[1] = r.y * h;
    rect[2] = r.width * w;
    rect[3] = r.height * h;
    uniforms["uFeather"] = r.feather * Math.min(r.width * w, r.height * h);
    uniforms["uEllipse"] = r.shape === "ellipse" ? 1 : 0;
    uniforms["uInvert"] = r.invert ? 1 : 0;
    this.resources["uInner"] = temp.source;

    filterManager.applyFilter(this, input, output, clearMode);
    TexturePool.returnTexture(temp);
  }

  /** Destroys the wrapper only — the inner filter belongs to the effect stack. */
  override destroy(): void {
    super.destroy();
  }
}
