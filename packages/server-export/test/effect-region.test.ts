/**
 * Effect regions through the real pipeline (headless Chromium, WebGL): the
 * effect applies only inside the region, the region follows the clip's
 * transform, and keyframed regions move with time.
 */
import { existsSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { createRenderSession, type RenderSession } from "../src/render-session.js";

const CANDIDATES = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].filter(
  (p): p is string => p !== undefined && existsSync(p),
);
const browserPath = CANDIDATES[0];

/** PNG header check: signature plus IHDR width/height (big-endian at 16..23). */
function pngSize(bytes: Uint8Array): { width: number; height: number } {
  expect(Array.from(bytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Minimal PNG decode (8-bit RGB/RGBA, all five row filters) → one pixel. */
function pngPixel(bytes: Uint8Array, x: number, y: number): [number, number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const channels = bytes[25] === 6 ? 4 : 3;
  const idat: Uint8Array[] = [];
  for (let off = 8; off < bytes.length; ) {
    const len = view.getUint32(off);
    const type = String.fromCharCode(...bytes.subarray(off + 4, off + 8));
    if (type === "IDAT") idat.push(bytes.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  let prev = new Uint8Array(stride);
  let row = new Uint8Array(stride);
  for (let r = 0; r <= y; r++) {
    const base = r * (stride + 1);
    const filter = raw[base]!;
    row = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const v = raw[base + 1 + i]!;
      const a = i >= channels ? row[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      row[i] = (v + [0, a, b, (a + b) >> 1, paeth][filter]!) & 0xff;
    }
    prev = row;
  }
  return [row[x * channels]!, row[x * channels + 1]!, row[x * channels + 2]!];
}


type Build = (p: ReturnType<typeof createProject>) => void;

/** A white full-frame html card with an invert effect. */
function doc(build: Build) {
  const project = createProject({ width: 320, height: 180, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "html", id: "card", trackId: "v1", startUs: 0, durationUs: 2_000_000,
        template: `<div style="width:100%;height:100%;background:#ffffff"></div>`,
      },
    });
    build(project);
  });
  return project.toJSON();
}

const isWhite = (px: number[]) => px.every((c) => c > 220);
const isBlack = (px: number[]) => px.every((c) => c < 35);

describe.skipIf(browserPath === undefined)("effect regions (integration)", () => {
  let session: RenderSession;
  beforeAll(async () => {
    session = await createRenderSession({ browser: { executablePath: browserPath!, swiftshader: true } });
  }, 60_000);
  afterAll(async () => {
    await session?.close();
  });

  it("applies the effect only inside the region", async () => {
    const png = await session.renderStill(
      doc((p) => p.dispatch({ type: "effect/add", payload: { clipId: "card", kind: "invert", region: { x: 0, y: 0, width: 0.5, height: 1 } } })),
      { timeUs: 500_000 },
    );
    expect(isBlack(pngPixel(png, 40, 90)), "inside: inverted").toBe(true);
    expect(isWhite(pngPixel(png, 280, 90)), "outside: untouched").toBe(true);
  }, 60_000);

  it("invert flips the mask (spotlight)", async () => {
    const png = await session.renderStill(
      doc((p) => p.dispatch({ type: "effect/add", payload: { clipId: "card", kind: "invert", region: { x: 0.25, y: 0.25, width: 0.5, height: 0.5, invert: true } } })),
      { timeUs: 500_000 },
    );
    expect(isWhite(pngPixel(png, 160, 90)), "center kept").toBe(true);
    expect(isBlack(pngPixel(png, 10, 10)), "outside inverted").toBe(true);
  }, 60_000);

  it("the region follows the clip when it is scaled and moved", async () => {
    // Half-size clip in the right half: clip spans x 160..320; region = its left half (160..240).
    const png = await session.renderStill(
      doc((p) => {
        p.dispatch({ type: "clip/set-property", payload: { clipId: "card", transform: { scale: 0.5, x: 0.75 } } });
        p.dispatch({ type: "effect/add", payload: { clipId: "card", kind: "invert", region: { x: 0, y: 0, width: 0.5, height: 1 } } });
      }),
      { timeUs: 500_000 },
    );
    expect(isBlack(pngPixel(png, 200, 90)), "clip's left half inverted").toBe(true);
    expect(isWhite(pngPixel(png, 280, 90)), "clip's right half untouched").toBe(true);
  }, 60_000);

  it("padded effects (blur) map the region through the filter padding", async () => {
    const edge = (region: { x: number; y: number; width: number; height: number }) => {
      const project = createProject({ width: 320, height: 180, fps: 30 });
      project.transaction(() => {
        project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
        project.dispatch({
          type: "clip/add",
          payload: {
            kind: "html", id: "card", trackId: "v1", startUs: 0, durationUs: 1_000_000,
            template: `<div style="display:flex;width:100%;height:100%"><div style="flex:1;background:#000"></div><div style="flex:1;background:#fff"></div></div>`,
          },
        });
        project.dispatch({ type: "effect/add", payload: { clipId: "card", kind: "blur", params: { amount: 0.05 }, region } });
      });
      return project.toJSON();
    };
    const over = await session.renderStill(edge({ x: 0.4, y: 0, width: 0.2, height: 1 }), { timeUs: 500_000 });
    const mid = pngPixel(over, 158, 90)[0];
    expect(mid, "edge blurred inside the region").toBeGreaterThan(40);
    expect(mid).toBeLessThan(215);
    const away = await session.renderStill(edge({ x: 0, y: 0, width: 0.2, height: 1 }), { timeUs: 500_000 });
    expect(pngPixel(away, 157, 90)[0], "edge stays sharp outside").toBeLessThan(20);
    expect(pngPixel(away, 163, 90)[0]).toBeGreaterThan(235);
  }, 60_000);

  it("keyframed regions move with time", async () => {
    const d = doc((p) => {
      p.dispatch({ type: "effect/add", payload: { clipId: "card", kind: "invert", effectId: "fx", region: { x: 0, y: 0, width: 0.5, height: 1 } } });
      p.dispatch({ type: "effect/set-region-keyframe", payload: { clipId: "card", effectId: "fx", property: "x", timeUs: 0, value: 0 } });
      p.dispatch({ type: "effect/set-region-keyframe", payload: { clipId: "card", effectId: "fx", property: "x", timeUs: 1_000_000, value: 0.5 } });
    });
    const early = await session.renderStill(d, { timeUs: 0 });
    expect(isBlack(pngPixel(early, 40, 90))).toBe(true);
    expect(isWhite(pngPixel(early, 280, 90))).toBe(true);
    const late = await session.renderStill(d, { timeUs: 1_500_000 });
    expect(isWhite(pngPixel(late, 40, 90))).toBe(true);
    expect(isBlack(pngPixel(late, 280, 90))).toBe(true);
  }, 60_000);
});
