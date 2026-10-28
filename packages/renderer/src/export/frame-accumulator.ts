/**
 * Averages rendered frames in linear light on the GPU — the blending half of
 * shutter motion blur.
 *
 * Averaging sRGB values directly darkens bright, fast things (a white dot
 * crossing black comes out too dim), so each sub-sample is converted to linear
 * light, summed in a floating-point texture (8-bit accumulation bands in
 * gradients once you add a dozen samples) and converted back once at the end.
 *
 * The accumulator has its own canvas: the compositor keeps rendering into
 * the source canvas; the encoder captures THIS one.
 */

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export interface FrameAccumulator {
  /** The averaged result — hand this canvas to the encoder. */
  readonly canvas: AnyCanvas;
  /** Start a new frame: clear the sum. */
  reset(): void;
  /** Add the source canvas as it is NOW, scaled by `weight` (weights should sum to 1). */
  add(weight: number): void;
  /** Write the sum, back in sRGB, to `canvas`. */
  resolve(): void;
  /** Write the source canvas to `canvas` unchanged (a frame that renders once). */
  copy(): void;
  destroy(): void;
}

const VERT = `#version 300 es
out vec2 uv;
void main() {
  // One oversized triangle covers the viewport.
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const SRGB_TO_LINEAR = `
vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}`;

// Pass 1: add weight × linear(source) into the sum. Row 0 of a canvas upload is the TOP of the image.
const ADD_FRAG = `#version 300 es
precision highp float;
uniform sampler2D src;
uniform float weight;
in vec2 uv;
out vec4 outColor;
${SRGB_TO_LINEAR}
void main() {
  vec3 c = texture(src, uv).rgb;
  outColor = vec4(toLinear(c) * weight, weight);
}`;

// Pass 2: divide by the weight actually added, back to sRGB. Flips so the output is upright.
const RESOLVE_FRAG = `#version 300 es
precision highp float;
uniform sampler2D sum;
in vec2 uv;
out vec4 outColor;
${SRGB_TO_LINEAR}
void main() {
  vec4 s = texture(sum, vec2(uv.x, 1.0 - uv.y));
  outColor = vec4(toSrgb(s.rgb / max(s.a, 1e-6)), 1.0);
}`;

const COPY_FRAG = `#version 300 es
precision highp float;
uniform sampler2D src;
in vec2 uv;
out vec4 outColor;
void main() {
  outColor = vec4(texture(src, vec2(uv.x, 1.0 - uv.y)).rgb, 1.0);
}`;

/**
 * Build an accumulator for `source`, or null when this browser can't render
 * to floating-point textures (the caller then exports without blur and says so).
 */
export function createFrameAccumulator(source: AnyCanvas, width: number, height: number): FrameAccumulator | null {
  const canvas: AnyCanvas =
    typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : Object.assign(document.createElement("canvas"), { width, height });
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true }) as WebGL2RenderingContext | null;
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) return null;

  const program = (frag: string): WebGLProgram | null => {
    const compile = (type: number, text: string): WebGLShader | null => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, text);
      gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, frag);
    if (!vs || !fs) return null;
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  };
  const addProgram = program(ADD_FRAG);
  const resolveProgram = program(RESOLVE_FRAG);
  const copyProgram = program(COPY_FRAG);
  if (!addProgram || !resolveProgram || !copyProgram) return null;

  const texture = (): WebGLTexture => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  const sourceTexture = texture();
  const sumTexture = texture();
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
  const sumBuffer = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, sumBuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sumTexture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null;
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.disable(gl.DEPTH_TEST);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

  const upload = (): void => {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);
  };
  const draw = (p: WebGLProgram, uniforms: () => void): void => {
    gl.useProgram(p);
    uniforms();
    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return {
    canvas,
    reset() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, sumBuffer);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
    add(weight) {
      upload();
      gl.bindFramebuffer(gl.FRAMEBUFFER, sumBuffer);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      draw(addProgram, () => {
        gl.uniform1i(gl.getUniformLocation(addProgram, "src"), 0);
        gl.uniform1f(gl.getUniformLocation(addProgram, "weight"), weight);
      });
      gl.disable(gl.BLEND);
    },
    resolve() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sumTexture);
      draw(resolveProgram, () => gl.uniform1i(gl.getUniformLocation(resolveProgram, "sum"), 0));
    },
    copy() {
      upload();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      // The upload has row 0 at the top; the default framebuffer's row 0 is the bottom, so flip on the way out.
      draw(copyProgram, () => gl.uniform1i(gl.getUniformLocation(copyProgram, "src"), 0));
    },
    destroy() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
