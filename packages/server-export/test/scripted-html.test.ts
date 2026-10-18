/**
 * Scripted html clips — the POC gate. Three GSAP timelines and one Lottie
 * animation render through the real pipeline (sandboxed frame → seek →
 * DOM snapshot → foreignObject raster → compositor → PNG) and are compared
 * against a direct headless capture of the same page seeked to the same
 * time. Pass = frame-exact within encoding noise at every sampled time.
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright-core";
import { createProject } from "@miraiclip/core";
import { createRenderSession, type RenderSession } from "../src/render-session.js";

const require = createRequire(import.meta.url);
const GSAP = readFileSync(require.resolve("gsap/dist/gsap.min.js"), "utf8");
const LOTTIE = readFileSync(path.join(path.dirname(require.resolve("lottie-web/package.json")), "build/player/lottie_svg.min.js"), "utf8");
const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));
const W = 320;
const H = 180;
const keep = process.env["MIRAICLIP_SCRIPTED_STILLS"];

// --------------------------------------------------------------- samples

const BASE = `<style>*{box-sizing:border-box}body{font-family:sans-serif}.stage{position:relative;width:${W}px;height:${H}px;background:#0b1020;overflow:hidden}</style>`;

const SAMPLES: { name: string; markup: string; times: number[] }[] = [
  {
    name: "gsap-move-rotate",
    times: [0, 0.35, 0.8, 1.5],
    markup: `${BASE}<div class="stage"><div id="box" style="position:absolute;left:20px;top:60px;width:60px;height:60px;border-radius:10px;background:#22d3ee"></div></div>
<script>${GSAP}</script><script>
const tl = gsap.timeline({ paused: true });
tl.to("#box", { x: 200, rotation: 180, duration: 1.2, ease: "power2.inOut" });
window.__timelines = { main: tl };
</script>`,
  },
  {
    name: "gsap-stagger-text",
    times: [0.1, 0.45, 0.9, 1.6],
    markup: `${BASE}<div class="stage" style="padding:24px;color:#fff"><div class="w" style="font:800 30px sans-serif">Seek</div><div class="w" style="font:800 30px sans-serif">every</div><div class="w" style="font:800 30px sans-serif">frame</div></div>
<script>${GSAP}</script><script>
const tl = gsap.timeline({ paused: true });
tl.from(".w", { y: 40, opacity: 0, duration: 0.5, stagger: 0.25, ease: "back.out(2)" });
window.__timelines = [tl];
</script>`,
  },
  {
    name: "gsap-scale-color",
    times: [0, 0.5, 1, 1.9],
    markup: `${BASE}<div class="stage"><div id="dot" style="position:absolute;left:130px;top:60px;width:60px;height:60px;border-radius:50%;background:rgb(255,0,80)"></div></div>
<script>${GSAP}</script><script>
const tl = gsap.timeline({ paused: true });
tl.to("#dot", { scale: 2.2, backgroundColor: "rgb(40,200,120)", duration: 1, ease: "sine.inOut" })
  .to("#dot", { y: -40, duration: 0.8, ease: "power1.out" });
window.__timelines = { main: tl };
</script>`,
  },
  {
    name: "lottie-svg",
    times: [0, 0.5, 1, 1.9],
    markup: `${BASE}<div class="stage"><div id="anim" style="position:absolute;inset:0"></div></div>
<script>${LOTTIE}</script><script>
const data = {"v":"5.7.4","fr":30,"ip":0,"op":60,"w":${W},"h":${H},"nm":"poc","ddd":0,"assets":[],"layers":[{"ddd":0,"ind":1,"ty":4,"nm":"box","sr":1,
"ks":{"o":{"a":0,"k":100},"r":{"a":1,"k":[{"t":0,"s":[0],"i":{"x":[0.5],"y":[1]},"o":{"x":[0.5],"y":[0]}},{"t":60,"s":[270]}]},
"p":{"a":1,"k":[{"t":0,"s":[60,90,0],"i":{"x":0.5,"y":1},"o":{"x":0.5,"y":0}},{"t":60,"s":[260,90,0]}]},"a":{"a":0,"k":[0,0,0]},"s":{"a":0,"k":[100,100,100]}},
"ao":0,"shapes":[{"ty":"gr","it":[{"ty":"rc","d":1,"s":{"a":0,"k":[60,60]},"p":{"a":0,"k":[0,0]},"r":{"a":0,"k":8},"nm":"r"},
{"ty":"fl","c":{"a":0,"k":[1,0.8,0.1,1]},"o":{"a":0,"k":100},"r":1,"nm":"f"},
{"ty":"tr","p":{"a":0,"k":[0,0]},"a":{"a":0,"k":[0,0]},"s":{"a":0,"k":[100,100]},"r":{"a":0,"k":0},"o":{"a":0,"k":100},"sk":{"a":0,"k":0},"sa":{"a":0,"k":0}}],"nm":"g"}],
"ip":0,"op":60,"st":0,"bm":0}]};
window.__lottie = [lottie.loadAnimation({ container: document.getElementById("anim"), renderer: "svg", loop: false, autoplay: false, animationData: data })];
</script>`,
  },
];

// --------------------------------------------------------------- pixels

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

/** Share of pixels whose largest channel difference exceeds `tolerance`, and the mean absolute difference. */
function compare(a: Uint8Array, b: Uint8Array, tolerance = 24): { bad: number; mean: number } {
  const A = decodePng(a);
  const B = decodePng(b);
  expect([A.width, A.height]).toEqual([B.width, B.height]);
  let bad = 0;
  let sum = 0;
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

// --------------------------------------------------------------- test

describe.skipIf(!browserPath)("scripted html clips (POC gate)", () => {
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
      // Reference: the page itself, seeked with the libraries' own APIs.
      const page = await browser.newPage({ viewport: { width: W, height: H } });
      await page.setContent(`<!doctype html><html><head><style>html,body{margin:0}</style></head><body>${sample.markup}</body></html>`);
      await page.waitForFunction(() => document.readyState === "complete");

      const project = createProject({ width: W, height: H, fps: 30 });
      project.transaction(() => {
        project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
        project.dispatch({
          type: "clip/add",
          payload: { kind: "html", id: "s", trackId: "v1", startUs: 0, durationUs: 2_000_000, template: sample.markup, scripted: true },
        });
      });
      expect(project.getState().doc.clips["s"]).toMatchObject({ scripted: true, animated: true });
      const doc = project.toJSON();

      for (const t of sample.times) {
        await page.evaluate(async (time) => {
          const w = window as unknown as { __timelines?: unknown; __lottie?: { goToAndStop(ms: number, f: boolean): void }[] };
          for (const tl of Object.values((w.__timelines ?? {}) as Record<string, { pause(): void; seek(t: number, s: boolean): void }>)) {
            tl.pause();
            tl.seek(time, false);
          }
          for (const a of w.__lottie ?? []) a.goToAndStop(time * 1000, false);
          await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        }, t);
        const reference = await page.screenshot();
        const ours = await session.renderStill(doc, { timeUs: Math.round(t * 1e6) });
        if (keep) {
          writeFileSync(path.join(keep, `${sample.name}-${t}-ref.png`), reference);
          writeFileSync(path.join(keep, `${sample.name}-${t}-ours.png`), ours);
        }
        const { bad, mean } = compare(reference, ours);
        expect(bad, `${sample.name} @ ${t}s: ${(bad * 100).toFixed(2)}% pixels differ (mean ${mean.toFixed(2)})`).toBeLessThan(0.01);
        expect(mean, `${sample.name} @ ${t}s mean abs diff`).toBeLessThan(2.5);
      }
      await page.close();
    }, 120_000);
  }

  it("motion actually happens (frames at different times differ)", async () => {
    const project = createProject({ width: W, height: H, fps: 30 });
    project.transaction(() => {
      project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
      project.dispatch({ type: "clip/add", payload: { kind: "html", id: "s", trackId: "v1", startUs: 0, durationUs: 2_000_000, template: SAMPLES[0]!.markup, scripted: true } });
    });
    const a = await session.renderStill(project.toJSON(), { timeUs: 0 });
    const b = await session.renderStill(project.toJSON(), { timeUs: 1_000_000 });
    expect(compare(a, b).bad).toBeGreaterThan(0.02);
  }, 60_000);
});
