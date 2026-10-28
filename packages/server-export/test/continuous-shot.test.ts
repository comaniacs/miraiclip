/**
 * Continuous-shot sequences (stage kit version 2) through the real pipeline: sandboxed frame → seek →
 * DOM snapshot → foreignObject raster → compositor → PNG, compared against a direct headless capture of the
 * same page seeked to the same time. Covers what the new verbs rely on: circular clip-path, 3D tilt with
 * blur under the camera, 300× zoom, boxes that morph, and hits that shake the frame.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright-core";
import { createProject } from "@miraiclip/core";
import { ANIME_SOURCE, STAGE_KIT_HASH, STAGE_KIT_SOURCE } from "@miraiclip/renderer/stage";
import { createRenderSession, type RenderSession } from "../src/render-session.js";

const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));
const W = 320;
const H = 180;

const BASE = `<style>*{box-sizing:border-box}body{font-family:sans-serif}.stage{position:relative;width:${W}px;height:${H}px;background:#0b1020;overflow:hidden;color:#fff}.world{position:absolute;inset:0}</style>`;
const seq = (dur: number, markup: string, script: string) =>
  `${BASE}<div class="stage" data-libs="stage" data-duration="${dur}" data-stage-version="2"><div class="world">${markup}</div></div><script>stage.build((tl, S) => {${script}});</script>`;

const SAMPLES: { name: string; markup: string; times: number[] }[] = [
  {
    name: "iris-clip-path",
    times: [0.2, 0.7, 1.1, 1.8],
    markup: seq(2, `<div id="btn" style="position:absolute;left:60px;top:70px;width:30px;height:30px;background:#f43f5e"></div><div id="scene" style="position:absolute;inset:0;background:#2563eb"></div>`, `tl.iris("#scene", { from: "#btn", duration: 1.2 }, 0.3);`),
  },
  {
    name: "tilt-and-blur-under-camera",
    times: [0.4, 1, 1.6],
    markup: seq(2, `<div style="position:absolute;left:60px;top:40px;width:200px;height:100px;border-radius:12px;background:#22d3ee"></div><div id="b" style="position:absolute;left:130px;top:70px;width:60px;height:40px;background:#facc15"></div>`, `tl.camera({ tiltX: 16, tiltY: -12, zoom: 1.3, duration: 1.6, ease: "inOut(2)" }, 0).to("#b", { blur: 3, duration: 1, ease: "sine.inOut" }, 0.3);`),
  },
  {
    name: "deep-zoom-300x",
    times: [0.3, 1, 1.7],
    markup: seq(2, `<div style="position:absolute;left:60px;top:30px;width:200px;height:120px;background:#14532d"></div><div id="d" style="position:absolute;left:158.9px;top:89.5px;width:2.2px;height:1px;background:#fde047"></div>`, `tl.camera({ anchor: "#d", at: [50, 50], zoom: 300, duration: 1.8, ease: "inOut(3)" }, 0);`),
  },
  {
    name: "morph-and-hop",
    times: [0.5, 1, 1.5, 1.9],
    markup: seq(2, `<div id="a" style="position:absolute;left:30px;top:100px;width:20px;height:20px;border-radius:50%;background:#f97316"></div><div id="b" style="position:absolute;left:180px;top:60px;width:110px;height:60px;border-radius:8px;background:#6d28d9"><p style="margin:0;padding:8px">Hi</p></div><div id="h" style="position:absolute;left:20px;top:20px;width:16px;height:16px;background:#e5e7eb"></div><div id="s" style="position:absolute;left:260px;top:20px;width:16px;height:16px;background:#4ade80"></div>`, `tl.morph("#a", "#b", { duration: 0.9 }, 0.2).hop("#h", { to: "#s", duration: 0.9 }, 0.6);`),
  },
  {
    name: "shake-and-handheld",
    times: [0.3, 0.55, 1.0],
    markup: seq(2, `<div style="position:absolute;left:100px;top:50px;width:120px;height:80px;background:#ec4899"></div>`, `tl.handheld({ amount: 2 }, 0, 2).shake(0.5, { amp: 6, seed: 4 });`),
  },
];

function decodePng(bytes: Uint8Array): { width: number; height: number; rgb: Uint8Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
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
  const rgb = new Uint8Array(width * height * 3);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const base = y * (stride + 1);
    const filter = raw[base]!;
    const row = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const v = raw[base + 1 + i]!;
      const a = i >= channels ? row[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      row[i] = (v + [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter]!) & 0xff;
    }
    for (let x = 0; x < width; x++) for (let k = 0; k < 3; k++) rgb[(y * width + x) * 3 + k] = row[x * channels + k]!;
    prev = row;
  }
  return { width, height, rgb };
}

function compare(a: Uint8Array, b: Uint8Array, tolerance = 24): { bad: number; mean: number } {
  const A = decodePng(a);
  const B = decodePng(b);
  expect([A.width, A.height]).toEqual([B.width, B.height]);
  let bad = 0, sum = 0;
  const n = A.width * A.height;
  for (let i = 0; i < n; i++) {
    let worst = 0;
    for (let k = 0; k < 3; k++) {
      const d = Math.abs(A.rgb[i * 3 + k]! - B.rgb[i * 3 + k]!);
      sum += d;
      worst = Math.max(worst, d);
    }
    if (worst > tolerance) bad++;
  }
  return { bad: bad / n, mean: sum / (n * 3) };
}

describe("the server-export harness is current", () => {
  it("bundles this workspace's stage kit (a stale dist/harness.js fails here)", () => {
    const harness = path.join(import.meta.dirname, "../dist/harness.js");
    expect(existsSync(harness), "run pnpm build first").toBe(true);
    expect(readFileSync(harness, "utf8")).toContain(STAGE_KIT_HASH);
  });
});

describe.skipIf(!browserPath)("continuous shot through the real pipeline", () => {
  let session: RenderSession;
  let browser: Browser;
  beforeAll(async () => {
    session = await createRenderSession({ browser: { executablePath: browserPath!, swiftshader: true } });
    browser = await chromium.launch({ executablePath: browserPath!, args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });
  }, 60_000);
  afterAll(async () => {
    await session?.close();
    await browser?.close();
  });

  for (const sample of SAMPLES) {
    it(`${sample.name}: matches a direct capture at every sampled time`, async () => {
      const page = await browser.newPage({ viewport: { width: W, height: H } });
      // The reference page runs the kit directly; the clip asks for it with data-libs="stage".
      const body = sample.markup.replace(/<script>([\s\S]*)<\/script>$/, "");
      const inline = /<script>([\s\S]*)<\/script>$/.exec(sample.markup)![1]!;
      await page.setContent(`<!doctype html><html><head><style>html,body{margin:0}</style></head><body>${body}</body></html>`);
      await page.addScriptTag({ content: ANIME_SOURCE });
      await page.addScriptTag({ content: STAGE_KIT_SOURCE });
      await page.addScriptTag({ content: inline });
      await page.evaluate(() => (window as unknown as { __miraiclipReady: Promise<void> }).__miraiclipReady);
      expect(await page.evaluate(() => document.querySelector(".stage")!.getAttribute("data-stage-error"))).toBeNull();

      const project = createProject({ width: W, height: H, fps: 30 });
      project.transaction(() => {
        project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
        project.dispatch({ type: "clip/add", payload: { kind: "html", id: "s", trackId: "v1", startUs: 0, durationUs: 2_000_000, template: sample.markup, scripted: true } });
      });
      const doc = project.toJSON();
      const frames: Uint8Array[] = [];
      for (const t of sample.times) {
        await page.evaluate(async (time) => {
          (window as unknown as { __miraiclipSeek(t: number): void }).__miraiclipSeek(time);
          await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        }, t);
        const reference = await page.screenshot();
        const ours = await session.renderStill(doc, { timeUs: Math.round(t * 1e6) });
        frames.push(ours);
        const { bad, mean } = compare(reference, ours);
        expect(bad, `${sample.name} @ ${t}s: ${(bad * 100).toFixed(2)}% pixels differ (mean ${mean.toFixed(2)})`).toBeLessThan(0.02);
        expect(mean, `${sample.name} @ ${t}s mean abs diff`).toBeLessThan(3);
      }
      // A blank render would match a blank reference: the frames must actually change over the shot.
      let moved = 0;
      for (let i = 1; i < frames.length; i++) moved = Math.max(moved, compare(frames[0]!, frames[i]!).mean);
      expect(moved, `${sample.name}: frames never change`).toBeGreaterThan(0.3);
      await page.close();
    }, 120_000);
  }
});

describe.skipIf(!browserPath)("deep zoom stays sharp", () => {
  let session: RenderSession;
  beforeAll(async () => {
    session = await createRenderSession({ browser: { executablePath: browserPath!, swiftshader: true } });
  }, 60_000);
  afterAll(async () => session?.close());

  /** Mean of the strongest 0.5 % of horizontal luminance steps: high when edges are crisp, low when they are soft. */
  function edgeContrast(png: Uint8Array): number {
    const { width, height, rgb } = decodePng(png);
    const steps: number[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 1; x < width; x++) {
        const i = (y * width + x) * 3, j = i - 3;
        steps.push(Math.abs(0.3 * (rgb[i]! - rgb[j]!) + 0.59 * (rgb[i + 1]! - rgb[j + 1]!) + 0.11 * (rgb[i + 2]! - rgb[j + 2]!)));
      }
    }
    steps.sort((a, b) => b - a);
    const top = steps.slice(0, Math.max(1, Math.floor(steps.length * 0.005)));
    return top.reduce((a, b) => a + b, 0) / top.length;
  }

  it("text a hundred-fold zoom in has the same edge contrast as the same text at 1x", async () => {
    const dive = (zoom: number) =>
      `${BASE}<div class="stage" data-libs="stage" data-duration="2" data-stage-version="2"><div class="world">` +
      // a nested level drawn tiny (1/300) and carrying the text
      `<div id="host" style="position:absolute;left:158.5px;top:89px;width:3px;height:2px"><div id="inner" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;transform:scale(${3 / W});background:#7c2d12"><p id="t" style="position:absolute;left:0;width:${W}px;top:60px;text-align:center;font:800 40px sans-serif;color:#fff">Sharp edges</p><i id="mk" style="position:absolute;left:${W / 2 - 2}px;top:${H / 2 - 2}px;width:4px;height:4px"></i></div></div>` +
      `</div></div><script>stage.build((tl, S) => {tl.camera({ anchor: "#mk", at: [50, 50], zoom: ${zoom}, duration: 0.5 }, 0);});</script>`;
    const render = async (zoom: number, markup: string) => {
      const project = createProject({ width: W, height: H, fps: 30 });
      project.transaction(() => {
        project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
        project.dispatch({ type: "clip/add", payload: { kind: "html", id: "s", trackId: "v1", startUs: 0, durationUs: 2_000_000, template: markup, scripted: true } });
      });
      void zoom;
      return session.renderStill(project.toJSON(), { timeUs: 1_500_000 });
    };
    const deep = await render(W / 3, dive(W / 3)); // the inner level fills the frame
    const flat = await render(1, `${BASE}<div class="stage" data-libs="stage" data-duration="2" data-stage-version="2"><div class="world"><div style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;background:#7c2d12"><p style="position:absolute;left:0;width:${W}px;top:60px;text-align:center;font:800 40px sans-serif;color:#fff">Sharp edges</p></div></div></div><script>stage.build((tl) => {tl.camera({ zoom: 1, duration: 0.5 }, 0);});</script>`);
    const ratio = edgeContrast(deep) / edgeContrast(flat);
    expect(ratio, `edge contrast at depth vs 1x: ${ratio.toFixed(2)}`).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(1.2);
  }, 120_000);
});

