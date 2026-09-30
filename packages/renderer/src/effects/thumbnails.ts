/**
 * Effect thumbnails for editor UIs: renders each kind's REAL filter (default
 * params) over a sample image, so pickers preview exactly what applying the
 * effect does.
 *
 * Uses its own offscreen canvas and Pixi Application — never pass the
 * preview's canvas: two Pixi renderers on one canvas share one WebGL context,
 * and each one's cached GL state goes stale behind the other.
 */
import { EFFECT_CATALOG, effectParamsSchema } from "@miraiclip/core";
import { Application, Sprite, Texture } from "pixi.js";
import { getEffectRenderer, type EffectContext } from "./pixi-effects.js";

export interface EffectThumbnailOptions {
  /** Kinds to render (built-in or registered custom). Default: every catalog kind. */
  kinds?: readonly string[];
  /** Square thumbnail size in px. Default 144. */
  size?: number;
  /** Image to apply effects to (drawn cover-fit). Default: a built-in sample scene. */
  sample?: CanvasImageSource;
  /**
   * Magnifies length params (dot size, blur distance…): at thumbnail size they
   * would be 1–3px and unreadable, so the default 3 reads like a crop of a
   * full-size frame. 1 = true scale.
   */
  lengthScale?: number;
  /** Default "image/jpeg". */
  type?: "image/jpeg" | "image/png" | "image/webp";
  quality?: number;
  /** Called as each thumbnail is ready — fill a grid progressively. */
  onThumbnail?: (kind: string, dataUrl: string) => void;
  signal?: AbortSignal;
}

/** Render effect thumbnails as data URLs, keyed by kind. Kinds that fail to render are skipped. */
export async function renderEffectThumbnails(options: EffectThumbnailOptions = {}): Promise<Map<string, string>> {
  const size = options.size ?? 144;
  const kinds = options.kinds ?? EFFECT_CATALOG.map((e) => e.kind);
  const out = new Map<string, string>();

  const app = new Application();
  await app.init({ width: size, height: size, preference: "webgl", preserveDrawingBuffer: true, antialias: false, background: 0x000000 });
  const copy = document.createElement("canvas");
  copy.width = copy.height = size;
  const copy2d = copy.getContext("2d")!;
  const scene = new Sprite(Texture.from(sceneCanvas(size, options.sample)));
  app.stage.addChild(new Sprite(Texture.from(checkerCanvas(size))), scene);
  const context: EffectContext = {
    compositionSize: () => ({ width: size, height: size }),
    renderScale: () => options.lengthScale ?? 3,
  };

  try {
    let n = 0;
    for (const kind of kinds) {
      if (options.signal?.aborted) break;
      const factory = getEffectRenderer(kind);
      if (!factory) continue;
      try {
        const params = (effectParamsSchema(kind)?.parse({}) ?? {}) as Record<string, unknown>;
        const active = factory(params, context);
        scene.filters = [active.filter];
        app.renderer.render(app.stage);
        copy2d.clearRect(0, 0, size, size);
        copy2d.drawImage(app.canvas, 0, 0);
        const url = copy.toDataURL(options.type ?? "image/jpeg", options.quality ?? 0.85);
        scene.filters = null as never;
        active.filter.destroy();
        out.set(kind, url);
        options.onThumbnail?.(kind, url);
      } catch {
        scene.filters = null as never; // skip this kind
      }
      // setTimeout, not rAF (paused in hidden tabs): keep the UI responsive.
      if (++n % 8 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  } finally {
    // `false`, never `true`: `true` also releases Pixi's GLOBAL resources
    // (TexturePool, batcher pools) that every other renderer on the page
    // shares — the live preview's text and filter textures would break.
    app.destroy(false, { children: true, texture: true, textureSource: true });
  }
  return out;
}

function sceneCanvas(size: number, sample?: CanvasImageSource): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  if (sample) {
    const w = Number((sample as { width?: number }).width) || size;
    const h = Number((sample as { height?: number }).height) || size;
    const s = Math.max(size / w, size / h);
    g.drawImage(sample, (size - w * s) / 2, (size - h * s) / 2, w * s, h * s);
    return c;
  }
  const sky = g.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, "#f59e0b");
  sky.addColorStop(0.55, "#ec4899");
  sky.addColorStop(1, "#6366f1");
  g.fillStyle = sky;
  g.fillRect(0, 0, size, size);
  g.fillStyle = "#fde68a";
  g.beginPath();
  g.arc(size * 0.5, size * 0.38, size * 0.16, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1e293b";
  g.beginPath();
  g.moveTo(0, size * 0.8);
  for (const [x, y] of [[0.3, 0.55], [0.55, 0.78], [0.75, 0.6], [1, 0.82]] as const) g.lineTo(size * x, size * y);
  g.lineTo(size, size);
  g.lineTo(0, size);
  g.fill();
  g.fillStyle = "#00ff00"; // a green-screen swatch, so chromaKey has something to key
  g.fillRect(size * 0.06, size * 0.06, size * 0.22, size * 0.22);
  g.fillStyle = "#ffffff";
  g.font = `bold ${Math.round(size * 0.2)}px system-ui, sans-serif`;
  g.textAlign = "center";
  g.fillText("Aa", size * 0.5, size * 0.95);
  return c;
}

function checkerCanvas(size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const s = Math.max(4, Math.round(size / 12));
  for (let y = 0; y < size; y += s) {
    for (let x = 0; x < size; x += s) {
      g.fillStyle = (x / s + y / s) % 2 ? "#3a3a3a" : "#555555";
      g.fillRect(x, y, s, s);
    }
  }
  return c;
}
