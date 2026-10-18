import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyCommands, createProject, type ProjectDocument } from "@miraiclip/core";
import { sessionCommands, type CaptureSession } from "@miraiclip/capture";
import type { Transcript } from "@miraiclip/transcript";
import { addStills, buildGuide, toHtml, toMarkdown, titleForAction } from "../src/index.js";
import { decodePng, pixel } from "./png.js";

const S = 1_000_000;
const W = 640;
const H = 360;
const save = { selector: "#save", tag: "button", label: "Save", rect: { x: 400, y: 150, width: 100, height: 40 } };
const email = { selector: "#email", tag: "input", label: "Email address", rect: { x: 100, y: 100, width: 200, height: 30 } };
const pw = { selector: "#pw", tag: "input", label: "Password", sensitive: true, rect: { x: 100, y: 200, width: 200, height: 30 } };
const session: CaptureSession = {
  format: 1,
  startedAt: "2026-10-17T00:00:00.000Z",
  durationUs: 6 * S,
  viewport: { width: W, height: H, devicePixelRatio: 1 },
  viewportInVideo: { x: 0, y: 0, width: 1, height: 1 },
  media: { screen: { mimeType: "video/webm", width: W, height: H, durationUs: 6 * S } },
  events: [
    { tUs: 0, type: "navigate", url: "https://example.com/" },
    { tUs: 0.1 * S, type: "marker", label: "Sign in", data: { kind: "step" } },
    { tUs: 0.5 * S, type: "click", x: 200, y: 115, button: 0, target: email },
    { tUs: 0.8 * S, type: "input", target: email },
    { tUs: 1.5 * S, type: "click", x: 200, y: 215, button: 0, target: pw },
    { tUs: 3 * S, type: "marker", label: "Save your settings", data: { kind: "step" } },
    { tUs: 4 * S, type: "click", x: 450, y: 170, button: 0, target: save },
  ],
};
const transcript: Transcript = {
  assetId: "screen",
  words: [
    { text: "um", startUs: 0.3 * S, endUs: 0.4 * S },
    { text: "type", startUs: 0.5 * S, endUs: 0.7 * S },
    { text: "your", startUs: 0.75 * S, endUs: 0.9 * S },
    { text: "email.", startUs: 0.95 * S, endUs: 1.3 * S },
  ],
};

function doc(): ProjectDocument {
  const p = createProject({ width: W, height: H, fps: 30 });
  expect(applyCommands(p, sessionCommands(session, { screenSrc: "screen.webm" })).ok).toBe(true);
  return p.getState().doc;
}

describe("buildGuide", () => {
  it("steps from step markers, actions and highlights from the log, text from what was said", () => {
    const guide = buildGuide(doc(), { title: "Get started", session, clipId: "screen", transcript, highlightPaddingPx: 0 });
    expect(guide.steps.map((s) => [s.number, s.title, s.body, s.action])).toEqual([
      [1, "Sign in", "Type your email.", { kind: "click", label: "Email address" }],
      [2, "Save your settings", undefined, { kind: "click", label: "Save" }],
    ]);
    // Screenshot just before the click, with the control boxed (canvas fractions).
    expect(guide.steps[1]!.timeUs).toBe(3.85 * S);
    const h = guide.steps[1]!.highlight!;
    expect(h.x).toBeCloseTo(400 / W, 5);
    expect(h.y).toBeCloseTo(150 / H, 5);
    expect(h.width).toBeCloseTo(100 / W, 5);
  });

  it("steps from clicks when there are no markers; sensitive targets are never highlighted", () => {
    const d = doc();
    const noMarkers = { ...d, markers: {} };
    const guide = buildGuide(noMarkers, { title: "Clicks", session, clipId: "screen" });
    expect(guide.steps.map((s) => s.title)).toEqual(["Click “Email address”", "Click “Password”", "Click “Save”"]);
    expect(guide.steps[1]!.highlight).toBeUndefined();
    expect(titleForAction({ kind: "type", label: "Email address" })).toBe("Enter email address");
    expect(titleForAction({ kind: "key", key: "Meta+k" })).toBe("Press Meta + k");
  });

  it("a recording split into pieces (a freeze frame inserted): actions are found on the piece that shows them", () => {
    const p = createProject(structuredClone(doc()));
    // Split at 2.5 s and push the second piece 2 s later, as a voiceover's held frame would.
    const r = applyCommands(p, [
      { type: "clip/split", payload: { clipId: "screen", atUs: 2.5 * S, newClipId: "screen-b" } },
      { type: "clip/move", payload: { clipId: "screen-b", startUs: 4.5 * S } },
      { type: "marker/update", payload: { markerId: "marker-2", timeUs: 5 * S } },
    ]);
    expect(r.ok, JSON.stringify(!r.ok && r.error)).toBe(true);
    const d = p.getState().doc;
    const one = buildGuide(d, { title: "T", session, clipId: "screen" });
    expect(one.steps[1]!.action).toBeUndefined(); // only the first piece: the Save click is lost
    const all = buildGuide(d, { title: "T", session, clipIds: ["screen", "screen-b"], highlightPaddingPx: 0 });
    expect(all.steps[1]!.action).toEqual({ kind: "click", label: "Save" });
    expect(all.steps[1]!.timeUs).toBe(5.85 * S); // just before the click, on the moved piece
    expect(all.steps[1]!.highlight!.x).toBeCloseTo(400 / W, 5);
  });

  it("prefers the narration script's lines", () => {
    const guide = buildGuide(doc(), { title: "T", session, clipId: "screen", script: { segments: [{ text: "Enter your work email.", startUs: 0, markerId: "marker-1" }] } });
    expect(guide.steps[0]!.body).toBe("Enter your work email.");
  });
});

describe("formats", () => {
  const guide = {
    title: "Ship <it> *fast*",
    intro: "Two steps.",
    steps: [
      { id: "a", number: 1, title: "Click “Save”", body: "Then wait & see.", timeUs: 0, image: { src: "step 1.png", width: 640, height: 360, alt: "Step 1" } },
      { id: "b", number: 2, title: "Done", timeUs: 1 },
    ],
  };
  it("Markdown escapes and numbers", () => {
    expect(toMarkdown(guide, { imageBase: "img/" })).toBe(
      "# Ship \\<it\\> \\*fast\\*\n\nTwo steps.\n\n## 1. Click “Save”\n\nThen wait & see.\n\n![Step 1](img/step%201.png)\n\n## 2. Done\n",
    );
  });
  it("HTML is a standalone, escaped page (or a fragment)", () => {
    const html = toHtml(guide);
    expect(html).toContain("<title>Ship &lt;it&gt; *fast*</title>");
    expect(html).toContain('<img src="step 1.png" width="640" height="360" alt="Step 1" loading="lazy">');
    expect(html).toContain("Then wait &amp; see.");
    expect(toHtml(guide, { fragment: true })).toMatch(/^<article/);
  });
});

const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));
const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!browserPath || !hasFfmpeg)("annotated stills (real renderer)", () => {
  let render: Awaited<ReturnType<typeof import("@miraiclip/server-export").createRenderSession>>;
  beforeAll(async () => {
    const { createRenderSession } = await import("@miraiclip/server-export");
    const dir = mkdtempSync(path.join(tmpdir(), "mc-guides-"));
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `color=c=0x3060c0:size=${W}x${H}:rate=30:duration=6`, "-c:v", "libvpx-vp9", "-y", path.join(dir, "screen.webm")]);
    render = await createRenderSession({ assetsDir: dir, browser: { executablePath: browserPath!, swiftshader: true } });
  }, 120_000);
  afterAll(async () => {
    await render?.close();
  });

  it("outlines the control, dims the rest, and stores one image per step", async () => {
    const d = doc();
    const guide = buildGuide(d, { title: "T", session, clipId: "screen", highlightPaddingPx: 0 });
    const stored: { step: number; bytes: Uint8Array }[] = [];
    const out = await addStills(guide, d, (x, o) => render.renderStill(x, o), {
      store: async (img, step) => {
        stored.push({ step: step.number, bytes: img.data as Uint8Array });
        return `step-${step.number}.png`;
      },
    });
    expect(out.steps.map((s) => s.image?.src)).toEqual(["step-1.png", "step-2.png"]);
    const img = decodePng(stored[1]!.bytes);
    const inside = pixel(img, 450, 170); // the Save button's box: the recording, untouched
    const outside = pixel(img, 50, 300); // dimmed
    const edge = pixel(img, 450, 151); // the outline
    expect(inside[2]).toBeGreaterThan(150);
    expect(outside[2]).toBeLessThan(inside[2] * 0.8);
    expect(edge[0]).toBeGreaterThan(200); // yellow
    expect(edge[1]).toBeGreaterThan(180);
    expect(edge[2]).toBeLessThan(100);
  }, 120_000);
});
