/**
 * GLSL bodies for the shader-backed built-in effects, keyed by kind. Params,
 * defaults and ranges live in core's EFFECT_CATALOG; each param `key` is a
 * uniform `u_<key>` here (float, or vec3 for colors; length params arrive in
 * filter-texture PIXELS — see library.ts).
 *
 * mode "color": per-pixel op. The body edits `rgb` (unpremultiplied, starting
 *   as the source color; `src`, `c`, `uv` in scope). When the kind has an
 *   `intensity` param the result is blended with the source by it.
 * mode "full": the body defines `vec4 effect(vec2 uv)` returning PREMULTIPLIED color.
 *
 * Helpers available to every body: see FRAGMENT_PRELUDE in glsl.ts. Bodies
 * must stay GLSL ES 1.00-compatible (no arrays, constant loop bounds): Pixi
 * may compile for WebGL1.
 */

export interface EffectShader {
  mode: "color" | "full";
  glsl: string;
}

export const EFFECT_SHADERS: Record<string, EffectShader> = {
  warm: {
    mode: "color",
    glsl: /* glsl */ `rgb = rgb * vec3(1.08, 1.0, 0.86) + vec3(0.03, 0.01, -0.02);`,
  },
  cool: {
    mode: "color",
    glsl: /* glsl */ `rgb = rgb * vec3(0.88, 1.0, 1.1) + vec3(-0.02, 0.0, 0.03);`,
  },
  hueShift: {
    mode: "color",
    glsl: /* glsl */ `vec3 hsv = rgb2hsv(rgb); hsv.x = fract(hsv.x + u_hue / 360.0); rgb = hsv2rgb(hsv);`,
  },
  vibrance: {
    mode: "color",
    glsl: /* glsl */ `float sat = max(rgb.r, max(rgb.g, rgb.b)) - min(rgb.r, min(rgb.g, rgb.b));
rgb = mix(vec3(luma(rgb)), rgb, 1.0 + u_amount * (1.0 - sat) * 1.5);`,
  },
  exposure: {
    mode: "color",
    glsl: /* glsl */ `rgb *= pow(2.0, u_stops);`,
  },
  contrastCurve: {
    mode: "color",
    glsl: /* glsl */ `rgb = rgb * rgb * (3.0 - 2.0 * rgb);`,
  },
  gamma: {
    mode: "color",
    glsl: /* glsl */ `rgb = pow(max(rgb, vec3(0.0)), vec3(1.0 / u_gamma));`,
  },
  channelSwap: {
    mode: "color",
    glsl: /* glsl */ `rgb = rgb.brg;`,
  },
  duotone: {
    mode: "color",
    glsl: /* glsl */ `rgb = mix(u_shadow, u_highlight, luma(rgb));`,
  },
  gradientMap: {
    mode: "color",
    glsl: /* glsl */ `float l = luma(rgb); rgb = l < 0.5 ? mix(u_dark, u_mid, l * 2.0) : mix(u_mid, u_light, (l - 0.5) * 2.0);`,
  },
  colorPop: {
    mode: "color",
    glsl: /* glsl */ `vec3 hsv = rgb2hsv(rgb); float key = rgb2hsv(u_color).x;
float d = abs(hsv.x - key); d = min(d, 1.0 - d);
float keep = (1.0 - smoothstep(u_tolerance, u_tolerance + 0.08, d)) * smoothstep(0.08, 0.2, hsv.y);
rgb = mix(vec3(luma(rgb)), rgb, keep);`,
  },
  solarize: {
    mode: "color",
    glsl: /* glsl */ `rgb = mix(rgb, 1.0 - rgb, step(vec3(u_threshold), rgb));`,
  },
  threshold: {
    mode: "color",
    glsl: /* glsl */ `rgb = vec3(step(u_threshold, luma(rgb)));`,
  },
  posterize: {
    mode: "color",
    glsl: /* glsl */ `float n = max(1.0, u_levels - 1.0); rgb = floor(rgb * n + 0.5) / n;`,
  },
  tealOrange: {
    mode: "color",
    glsl: /* glsl */ `rgb = softLight(rgb, mix(vec3(0.1, 0.45, 0.5), vec3(0.95, 0.6, 0.3), smoothstep(0.15, 0.85, luma(rgb))));`,
  },
  noir: {
    mode: "color",
    glsl: /* glsl */ `float l = smoothstep(0.08, 0.92, luma(rgb)); rgb = vec3(l * l * (3.0 - 2.0 * l));`,
  },
  bleachBypass: {
    mode: "color",
    glsl: /* glsl */ `vec3 g = vec3(luma(rgb));
vec3 ov = mix(2.0 * rgb * g, 1.0 - 2.0 * (1.0 - rgb) * (1.0 - g), step(0.5, g));
rgb = mix(rgb, ov, 0.8); rgb = mix(vec3(luma(rgb)), rgb, 0.5);`,
  },
  crossProcess: {
    mode: "color",
    glsl: /* glsl */ `rgb.r = smoothstep(0.05, 0.95, rgb.r); rgb.g = pow(max(rgb.g, 0.0), 0.85) * 1.05; rgb.b = rgb.b * 0.7 + 0.15;`,
  },
  faded: {
    mode: "color",
    glsl: /* glsl */ `rgb = mix(vec3(0.12, 0.1, 0.12), vec3(0.92, 0.9, 0.86), rgb); rgb = mix(vec3(luma(rgb)), rgb, 0.8);`,
  },
  matte: {
    mode: "color",
    glsl: /* glsl */ `rgb = rgb * 0.85 + 0.08; rgb = mix(vec3(luma(rgb)), rgb, 0.9);`,
  },
  goldenHour: {
    mode: "color",
    glsl: /* glsl */ `rgb = softLight(rgb, vec3(1.0, 0.75, 0.4)) * vec3(1.05, 1.0, 0.9);`,
  },
  moonlight: {
    mode: "color",
    glsl: /* glsl */ `rgb = mix(rgb, vec3(luma(rgb)) * vec3(0.75, 0.9, 1.2), 0.7) * 0.85;`,
  },
  cyberpunk: {
    mode: "color",
    glsl: /* glsl */ `rgb = softLight(rgb, mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.2, 0.8), smoothstep(0.2, 0.8, luma(rgb))));
rgb = mix(vec3(luma(rgb)), rgb, 1.3);`,
  },
  vaporwave: {
    mode: "color",
    glsl: /* glsl */ `float l = luma(rgb);
vec3 m = mix(mix(vec3(0.2, 0.1, 0.5), vec3(1.0, 0.3, 0.7), smoothstep(0.0, 0.6, l)), vec3(0.4, 1.0, 1.0), smoothstep(0.6, 1.0, l));
rgb = mix(rgb, m, 0.6);`,
  },
  cyanotype: {
    mode: "color",
    glsl: /* glsl */ `rgb = mix(vec3(0.02, 0.12, 0.3), vec3(0.85, 0.95, 1.0), luma(rgb));`,
  },
  infrared: {
    mode: "color",
    glsl: /* glsl */ `rgb = vec3(rgb.g * 1.3 + rgb.r * 0.2, rgb.r * 0.6 + rgb.g * 0.4, rgb.b * 0.8);`,
  },
  lomo: {
    mode: "color",
    glsl: /* glsl */ `rgb = mix(vec3(luma(rgb)), rgb, 1.35); rgb = clamp(rgb, 0.0, 1.0); rgb = rgb * rgb * (3.0 - 2.0 * rgb);
float d = length(toFrame(uv) - 0.5) * 1.4142; rgb *= 1.0 - 0.65 * smoothstep(0.35, 1.0, d);`,
  },
  nightVision: {
    mode: "color",
    glsl: /* glsl */ `float l = pow(luma(rgb), 0.8) * 1.4 + (hash(uv * uInputSize.xy) - 0.5) * 0.15;
float d = length(toFrame(uv) - 0.5) * 1.4142;
rgb = vec3(0.15, 1.0, 0.25) * l * (1.0 - smoothstep(0.5, 1.0, d));
rgb *= 0.85 + 0.15 * cos(toFrame(uv).y * uOutputFrame.w * 2.094);`,
  },
  pixelate: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec2 p = uv * uInputSize.xy; vec2 cell = (floor(p / u_size) + 0.5) * u_size;
  return S(cell * uInputSize.zw);
}`,
  },
  halftone: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec2 p = uv * uInputSize.xy; float s = u_size;
  vec2 cell = (floor(p / s) + 0.5) * s;
  vec4 c = S(cell * uInputSize.zw); vec3 rgb = unpre(c);
  float r = s * 0.6 * sqrt(1.0 - luma(rgb));
  float ink = 1.0 - smoothstep(r - 1.0, r + 1.0, length(p - cell));
  return pre(mix(vec3(0.97, 0.95, 0.9), rgb * 0.7, ink), c.a);
}`,
  },
  dotMatrix: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec2 p = uv * uInputSize.xy; float s = u_size;
  vec2 cell = (floor(p / s) + 0.5) * s;
  vec4 c = S(cell * uInputSize.zw);
  float r = s * 0.42;
  float ink = 1.0 - smoothstep(r - 1.0, r + 1.0, length(p - cell));
  return pre(unpre(c) * ink * 1.2, c.a);
}`,
  },
  crosshatch: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec2 p = uv * uInputSize.xy; float s = u_spacing; float w = max(1.0, s * 0.18);
  vec4 c = texture(uTexture, uv); float l = luma(unpre(c)); float ink = 0.0;
  if (l < 0.8 && mod(p.x + p.y, s) < w) ink = 1.0;
  if (l < 0.6 && mod(p.x - p.y, s) < w) ink = 1.0;
  if (l < 0.4 && mod(p.x + p.y - s * 0.5, s) < w) ink = 1.0;
  if (l < 0.2 && mod(p.x - p.y - s * 0.5, s) < w) ink = 1.0;
  return pre(mix(vec3(0.96, 0.94, 0.88), vec3(0.1), ink), c.a);
}`,
  },
  neonEdges: {
    mode: "color",
    glsl: /* glsl */ `rgb = u_color * clamp(edge(uv, 1.0) * 3.0, 0.0, 1.0);`,
  },
  sketch: {
    mode: "color",
    glsl: /* glsl */ `rgb = vec3(1.0 - clamp(edge(uv, 1.0) * 2.5, 0.0, 1.0));`,
  },
  emboss: {
    mode: "color",
    glsl: /* glsl */ `vec2 t = uInputSize.zw * 1.5; rgb = vec3(0.5 + (luma(unpre(S(uv + t))) - luma(unpre(S(uv - t)))) * 2.0);`,
  },
  sharpen: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec2 t = uInputSize.zw; vec4 c = texture(uTexture, uv);
  vec4 n = S(uv + vec2(t.x, 0.0)) + S(uv - vec2(t.x, 0.0)) + S(uv + vec2(0.0, t.y)) + S(uv - vec2(0.0, t.y));
  vec4 o = c + (c * 4.0 - n) * u_amount;
  return vec4(clamp(o.rgb, vec3(0.0), vec3(c.a)), c.a);
}`,
  },
  toon: {
    mode: "color",
    glsl: /* glsl */ `rgb = floor(rgb * 4.0 + 0.5) / 4.0; rgb *= 1.0 - smoothstep(0.2, 0.5, edge(uv, 1.0));`,
  },
  oilPaint: {
    mode: "full",
    glsl: /* glsl */ `vec4 kq(vec2 uv, vec2 dir, vec2 t) {
  vec3 m = vec3(0.0); vec3 s = vec3(0.0);
  for (int j = 0; j <= 3; j++) for (int i = 0; i <= 3; i++) {
    vec3 c = unpre(S(uv + vec2(float(i), float(j)) * dir * t)); m += c; s += c * c;
  }
  m /= 16.0; s = abs(s / 16.0 - m * m);
  return vec4(m, s.r + s.g + s.b);
}
vec4 effect(vec2 uv) {
  vec4 c = texture(uTexture, uv); vec2 t = uInputSize.zw * u_brush;
  vec4 best = kq(uv, vec2(-1.0, -1.0), t);
  vec4 q = kq(uv, vec2(1.0, -1.0), t); if (q.w < best.w) best = q;
  q = kq(uv, vec2(-1.0, 1.0), t); if (q.w < best.w) best = q;
  q = kq(uv, vec2(1.0, 1.0), t); if (q.w < best.w) best = q;
  return pre(best.rgb, c.a);
}`,
  },
  hexPixelate: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec2 p = uv * uInputSize.xy; vec2 r = vec2(1.0, 1.7320508) * u_size; vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h; vec2 b = mod(p - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  return S((p - g) * uInputSize.zw);
}`,
  },
  retro8bit: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec2 p = uv * uInputSize.xy; vec2 cell = (floor(p / u_size) + 0.5) * u_size;
  vec4 c = S(cell * uInputSize.zw); vec3 rgb = floor(unpre(c) * 3.0 + 0.5) / 3.0;
  return pre(rgb, c.a);
}`,
  },
  dither: {
    mode: "color",
    glsl: /* glsl */ `vec2 p = floor(uv * uInputSize.xy / max(1.0, u_scale));
float n = max(1.0, u_levels - 1.0);
rgb = floor(rgb * n + bayer4(p)) / n;`,
  },
  frostedGlass: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec2 p = uv * uInputSize.xy;
  vec2 j = (vec2(hash(p), hash(p + 17.31)) - 0.5) * 2.0 * u_amount;
  return S((p + j) * uInputSize.zw);
}`,
  },
  rgbSplit: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec2 o = vec2(u_amount * uInputSize.z, 0.0);
  vec4 r = S(uv + o); vec4 g = texture(uTexture, uv); vec4 b = S(uv - o);
  return vec4(r.r, g.g, b.b, max(g.a, max(r.a, b.a)));
}`,
  },
  scanlines: {
    mode: "color",
    glsl: /* glsl */ `float y = uv.y * uInputSize.y; rgb *= 1.0 - (0.5 + 0.5 * cos(6.2831853 * y / max(2.0, u_spacing))) * 0.6;`,
  },
  crt: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec2 f = toFrame(uv) * 2.0 - 1.0;
  f *= 1.0 + u_curve * dot(f, f) * 0.12;
  if (abs(f.x) > 1.0 || abs(f.y) > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
  vec2 fu = f * 0.5 + 0.5; vec2 tu = toTex(fu); vec2 o = vec2(1.5 * uInputSize.z, 0.0);
  vec4 c = S(tu);
  vec3 col = vec3(unpre(S(tu + o)).r, unpre(c).g, unpre(S(tu - o)).b);
  col *= 0.8 + 0.2 * cos(fu.y * uOutputFrame.w * 2.094);
  col *= 1.0 - 0.5 * smoothstep(0.7, 1.5, length(f));
  return pre(col * 1.1, max(c.a, 1.0));
}`,
  },
  vhs: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec2 f = toFrame(uv);
  float band = hash(vec2(floor(f.y * 60.0), u_seed));
  float shift = (band > 0.9 ? (band - 0.9) * 0.3 : 0.0) * u_intensity;
  vec2 tu = toTex(vec2(f.x + shift, f.y)); vec2 o = vec2(u_intensity * 6.0 * uInputSize.z, 0.0);
  vec4 c = S(tu);
  vec3 col = vec3(unpre(S(tu + o)).r, unpre(c).g, unpre(S(tu - o)).b);
  col = mix(vec3(luma(col)), col, 0.75);
  col += (hash(uv * uInputSize.xy + u_seed) - 0.5) * 0.12 * u_intensity;
  return pre(col * 0.9 + 0.05, c.a);
}`,
  },
  glitch: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec2 f = toFrame(uv); vec2 block = floor(f * vec2(8.0, 24.0));
  vec2 off = vec2(0.0);
  if (hash(block + u_seed) > 1.0 - u_intensity * 0.5) off.x = (hash(block * 1.7 + u_seed) - 0.5) * 0.25 * u_intensity;
  vec2 tu = toTex(f + off); vec2 o = vec2(u_intensity * 8.0 * uInputSize.z, 0.0);
  vec4 c = S(tu);
  vec3 col = vec3(unpre(S(tu + o)).r, unpre(c).g, unpre(S(tu - o)).b);
  return pre(col, c.a);
}`,
  },
  tvStatic: {
    mode: "color",
    glsl: /* glsl */ `rgb = vec3(hash(floor(uv * uInputSize.xy) + u_seed * 13.7));`,
  },
  lensFringe: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec2 f = toFrame(uv); vec2 d = (f - 0.5) * u_amount; vec4 c = S(uv);
  return pre(vec3(unpre(S(toTex(f + d))).r, unpre(c).g, unpre(S(toTex(f - d))).b), c.a);
}`,
  },
  vignette: {
    mode: "color",
    glsl: /* glsl */ `float inner = mix(0.8, 0.1, u_size);
rgb *= 1.0 - smoothstep(inner, inner + 0.5, length(toFrame(uv) - 0.5) * 1.4142);`,
  },
  glow: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec4 c = texture(uTexture, uv); vec3 acc = vec3(0.0); float tot = 0.0;
  for (int j = -3; j <= 3; j++) for (int i = -3; i <= 3; i++) {
    vec2 o = vec2(float(i), float(j)); float w = exp(-dot(o, o) / 8.0);
    vec4 s = S(uv + o * (u_radius / 3.0) * uInputSize.zw);
    acc += max(s.rgb - u_threshold * s.a, vec3(0.0)) * w; tot += w;
  }
  vec3 g = acc / tot * 2.5 * u_intensity;
  float a = max(c.a, min(1.0, luma(g)));
  return vec4(min(c.rgb + g, vec3(a)), a);
}`,
  },
  dreamy: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec4 c = texture(uTexture, uv); vec4 acc = vec4(0.0); float tot = 0.0;
  for (int j = -3; j <= 3; j++) for (int i = -3; i <= 3; i++) {
    vec2 o = vec2(float(i), float(j)); float w = exp(-dot(o, o) / 8.0);
    acc += S(uv + o * (u_radius / 3.0) * uInputSize.zw) * w; tot += w;
  }
  vec4 b = acc / tot; vec4 o = mix(c, b, 0.45 * u_intensity);
  o.rgb = min(o.rgb + b.rgb * 0.25 * u_intensity, vec3(o.a));
  return o;
}`,
  },
  tiltShift: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  float k = smoothstep(u_band * 0.5, u_band * 0.5 + 0.25, abs(toFrame(uv).y - u_focus));
  vec4 c = texture(uTexture, uv);
  if (k < 0.01) return c;
  vec4 acc = vec4(0.0); float tot = 0.0;
  for (int j = -3; j <= 3; j++) for (int i = -3; i <= 3; i++) {
    vec2 o = vec2(float(i), float(j)); float w = exp(-dot(o, o) / 8.0);
    acc += S(uv + o * (u_blur * k / 3.0) * uInputSize.zw) * w; tot += w;
  }
  return acc / tot;
}`,
  },
  zoomBlur: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec2 dir = uv - toTex(vec2(0.5)); vec4 acc = vec4(0.0);
  for (int i = 0; i < 24; i++) acc += S(uv - dir * u_amount * (float(i) / 23.0));
  return acc / 24.0;
}`,
  },
  motionBlur: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  float a = radians(u_angle); vec2 d = vec2(cos(a), sin(a)) * u_distance * uInputSize.zw;
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 24; i++) acc += S(uv + d * (float(i) / 23.0 - 0.5));
  return acc / 24.0;
}`,
  },
  colorVignette: {
    mode: "color",
    glsl: /* glsl */ `float inner = mix(0.8, 0.1, u_size);
rgb = mix(rgb, u_color, smoothstep(inner, inner + 0.5, length(toFrame(uv) - 0.5) * 1.4142));`,
  },
  lightLeak: {
    mode: "color",
    glsl: /* glsl */ `vec2 f = toFrame(uv);
float g = smoothstep(1.1, 0.0, length(f - vec2(1.0, 0.0))) + 0.5 * smoothstep(0.7, 0.0, length(f - vec2(0.0, 1.0)));
rgb = 1.0 - (1.0 - rgb) * (1.0 - u_color * clamp(g, 0.0, 1.0));`,
  },
  fisheye: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  float asp = frameAspect(); vec2 f = toFrame(uv) - 0.5; f.x *= asp;
  float r = length(f); vec2 s = f;
  if (r > 0.0 && r < 0.5) s = f / r * pow(r * 2.0, 1.0 + u_strength) * 0.5;
  s.x /= asp; return S(toTex(s + 0.5));
}`,
  },
  pinch: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  float asp = frameAspect(); vec2 f = toFrame(uv) - 0.5; f.x *= asp;
  float r = length(f); vec2 s = f;
  if (r > 0.0 && r < 0.5) s = f / r * pow(r * 2.0, 1.0 / (1.0 + u_strength)) * 0.5;
  s.x /= asp; return S(toTex(s + 0.5));
}`,
  },
  swirl: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  float asp = frameAspect(); vec2 f = toFrame(uv) - 0.5; f.x *= asp;
  float k = max(0.0, 1.0 - length(f) / u_radius); float a = radians(u_angle) * k * k;
  float s = sin(a), c = cos(a); vec2 p = vec2(c * f.x - s * f.y, s * f.x + c * f.y);
  p.x /= asp; return S(toTex(p + 0.5));
}`,
  },
  wave: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec2 f = toFrame(uv); f.x += sin(f.y * u_frequency * 6.2831853) * u_amplitude;
  return S(toTex(f));
}`,
  },
  ripple: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  float asp = frameAspect(); vec2 f = toFrame(uv) - 0.5; f.x *= asp;
  float r = length(f); if (r > 0.0) f += f / r * sin(r * u_frequency * 6.2831853) * u_amplitude;
  f.x /= asp; return S(toTex(f + 0.5));
}`,
  },
  mirrorX: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) { vec2 f = toFrame(uv); if (f.x > 0.5) f.x = 1.0 - f.x; return S(toTex(f)); }`,
  },
  mirrorY: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) { vec2 f = toFrame(uv); if (f.y > 0.5) f.y = 1.0 - f.y; return S(toTex(f)); }`,
  },
  kaleidoscope: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  float asp = frameAspect(); vec2 f = toFrame(uv) - 0.5; f.x *= asp;
  float r = length(f); float seg = 6.2831853 / max(2.0, u_segments);
  float a = mod(atan(f.y, f.x) + radians(u_rotation), seg); a = abs(a - seg * 0.5);
  vec2 p = vec2(cos(a), sin(a)) * r; p.x /= asp;
  return S(toTex(p + 0.5));
}`,
  },
  letterbox: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  float y = toFrame(uv).y;
  if (y < u_size || y > 1.0 - u_size) return vec4(0.0, 0.0, 0.0, 1.0);
  return texture(uTexture, uv);
}`,
  },
  roundedCorners: {
    mode: "full",
    glsl: /* glsl */ `vec4 effect(vec2 uv) {
  vec2 sz = uOutputFrame.zw; vec2 p = toFrame(uv) * sz;
  float r = u_radius * min(sz.x, sz.y);
  vec2 q = abs(p - sz * 0.5) - (sz * 0.5 - r);
  float d = length(max(q, vec2(0.0))) - r;
  return texture(uTexture, uv) * (1.0 - smoothstep(-1.0, 1.0, d));
}`,
  },
};
