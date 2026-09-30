/**
 * GLSL scaffolding shared by the shader-backed built-in effects: the standard
 * Pixi v8 filter vertex shader and a fragment prelude of helpers.
 */
import type { EffectParamInfo } from "@miraiclip/core";
import type { EffectShader } from "./shaders.js";

// Standard Pixi v8 filter vertex shader (same as the renderer's built-ins).
export const FILTER_VERTEX = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void)
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
 * Fragment prelude. uInputSize/uOutputFrame are highp to match the vertex
 * stage (a uniform declared in both stages must agree on precision).
 * Filter textures hold the clip's frame at their origin; `toFrame` maps a
 * texture uv to 0..1 across the frame, `S` samples clamped to the frame.
 */
export const FRAGMENT_PRELUDE = /* glsl */ `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;

vec2 toFrame(vec2 uv) { return uv * uInputSize.xy / uOutputFrame.zw; }
vec2 toTex(vec2 f) { return f * uOutputFrame.zw * uInputSize.zw; }
float frameAspect() { return uOutputFrame.z / uOutputFrame.w; }
vec4 S(vec2 uv) {
  vec2 lo = 0.5 * uInputSize.zw;
  vec2 hi = (uOutputFrame.zw - 0.5) * uInputSize.zw;
  return texture(uTexture, clamp(uv, lo, hi));
}
vec3 unpre(vec4 c) { return c.a > 0.0 ? c.rgb / c.a : vec3(0.0); }
vec4 pre(vec3 rgb, float a) { return vec4(clamp(rgb, 0.0, 1.0) * a, a); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
vec3 softLight(vec3 base, vec3 blend) {
  return mix(2.0 * base * blend + base * base * (1.0 - 2.0 * blend),
             sqrt(max(base, vec3(0.0))) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend),
             step(0.5, blend));
}
float edge(vec2 uv, float w) {
  vec2 t = uInputSize.zw * w;
  float tl = luma(unpre(S(uv + vec2(-t.x, -t.y)))), tc = luma(unpre(S(uv + vec2(0.0, -t.y)))), tr = luma(unpre(S(uv + vec2(t.x, -t.y))));
  float ml = luma(unpre(S(uv + vec2(-t.x, 0.0)))), mr = luma(unpre(S(uv + vec2(t.x, 0.0))));
  float bl = luma(unpre(S(uv + vec2(-t.x, t.y)))), bc = luma(unpre(S(uv + vec2(0.0, t.y)))), br = luma(unpre(S(uv + vec2(t.x, t.y))));
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  return length(vec2(gx, gy));
}
// Ordered-dither threshold (4x4 Bayer) without arrays, so it also compiles as GLSL ES 1.00.
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 p) { return bayer2(0.5 * p) * 0.25 + bayer2(p); }
`;

/** Assemble a kind's fragment shader: prelude + `u_<key>` uniforms + body + main. */
export function buildFragment(shader: EffectShader, params: readonly EffectParamInfo[]): string {
  const uniforms = params
    .map((p) => (p.type === "color" ? `uniform vec3 u_${p.key};` : `uniform float u_${p.key};`))
    .join("\n");
  const hasIntensity = shader.mode === "color" && params.some((p) => p.key === "intensity");
  const body =
    shader.mode === "color"
      ? `vec4 effect(vec2 uv) {
  vec4 c = texture(uTexture, uv); vec3 src = unpre(c); vec3 rgb = src;
  ${shader.glsl}
  return pre(mix(src, rgb, ${hasIntensity ? "u_intensity" : "1.0"}), c.a);
}`
      : shader.glsl;
  return `${FRAGMENT_PRELUDE}\n${uniforms}\n${body}\nvoid main(void) { finalColor = effect(vTextureCoord); }\n`;
}
