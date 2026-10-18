/**
 * The planners' output through the real renderer (headless Chromium): a
 * zoom changes the picture, the cursor is drawn where the click was, and a
 * redaction changes only the field's box.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyCommands, createProject, type ProjectDocument } from "@miraiclip/core";
import { sessionCommands, type CaptureSession } from "@miraiclip/capture";
import { createRenderSession, type RenderSession } from "@miraiclip/server-export";
import { framePointToCanvas, planCursor, planRedactions, planZooms, screenClip } from "../src/index.js";
import { decodePng, diff, pixel } from "./png.js";

const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));
const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const S = 1_000_000;
const W = 640;
const H = 360;
const session: CaptureSession = {
  format: 1,
  startedAt: "2026-10-17T00:00:00.000Z",
  durationUs: 4 * S,
  viewport: { width: W, height: H, devicePixelRatio: 1 },
  viewportInVideo: { x: 0, y: 0, width: 1, height: 1 },
  media: { screen: { mimeType: "video/webm", width: W, height: H, durationUs: 4 * S } },
  events: [
    { tUs: 0, type: "navigate", url: "https://example.com/" },
    { tUs: 500_000, type: "move", x: 100, y: 100 },
    { tUs: 2 * S, type: "click", x: 400, y: 150, button: 0 },
    { tUs: 2.1 * S, type: "focus", target: { selector: "#pw", tag: "input", sensitive: true, rect: { x: 170, y: 180, width: 140, height: 70 } } },
  ],
};

describe.skipIf(!browserPath || !hasFfmpeg)("screencast plans render", () => {
  let render: RenderSession;
  let dir: string;
  const base = (): ProjectDocument => {
    const p = createProject({ width: W, height: H, fps: 30 });
    const r = applyCommands(p, sessionCommands(session, { screenSrc: "screen.webm" }));
    expect(r.ok).toBe(true);
    return p.getState().doc;
  };
  const withPlan = (doc: ProjectDocument, commands: { type: string; payload: Record<string, unknown> }[]) => {
    const p = createProject(structuredClone(doc));
    const r = applyCommands(p, commands);
    expect(r.ok, JSON.stringify(!r.ok && r.error)).toBe(true);
    return p.getState().doc;
  };
  const still = async (doc: ProjectDocument, timeUs: number) => decodePng(await render.renderStill(doc, { timeUs, width: W, height: H }));

  beforeAll(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "mc-screencast-"));
    // A detailed, moving test picture stands in for a screen recording.
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `testsrc2=size=${W}x${H}:rate=30:duration=4`, "-c:v", "libvpx-vp9", "-b:v", "2M", "-y", path.join(dir, "screen.webm")]);
    render = await createRenderSession({ assetsDir: dir, browser: { executablePath: browserPath!, swiftshader: true } });
  }, 120_000);
  afterAll(async () => {
    await render?.close();
  });

  it("a zoom changes the frame; the clicked point moves to the centre", async () => {
    const doc = base();
    const zoomed = withPlan(doc, planZooms(doc, session, { clipId: "screen" }));
    const t = 2 * S;
    const [plain, z] = [await still(doc, t), await still(zoomed, t)];
    expect(diff(plain, z)).toBeGreaterThan(15);
    // The colour under the click in the plain frame is now near the canvas centre.
    const focus = framePointToCanvas(zoomed, screenClip(zoomed, "screen"), t, 400 / W, 150 / H);
    const before = pixel(plain, 400, 150);
    const after = pixel(z, focus.x * W, focus.y * H);
    expect(Math.max(...before.map((v, i) => Math.abs(v - after[i]!)))).toBeLessThan(60);
  }, 120_000);

  it("the cursor is drawn at the click", async () => {
    const doc = base();
    const withCursor = withPlan(doc, planCursor(doc, session, { clipId: "screen", fill: "#ff00ff", stroke: "#ff00ff", size: 6 }));
    const t = 2 * S;
    const [plain, c] = [await still(doc, t), await still(withCursor, t)];
    // Just below-right of the tip is cursor fill.
    const [r, g, b] = pixel(c, 400 + 6, 150 + 14);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(80);
    expect(b).toBeGreaterThan(200);
    // Far from the cursor, nothing changed.
    expect(diff(plain, c, { x: 0, y: 250, width: 200, height: 100 })).toBeLessThan(1);
  }, 120_000);

  it("a redaction changes the field's box and nothing else", async () => {
    const doc = base();
    const redacted = withPlan(doc, planRedactions(doc, session, { clipId: "screen", effect: "blur", paddingPx: 0, feather: 0, strength: 0.03 }));
    const t = 1 * S;
    const [plain, r] = [await still(doc, t), await still(redacted, t)];
    expect(diff(plain, r, { x: 180, y: 190, width: 120, height: 50 })).toBeGreaterThan(8);
    expect(diff(plain, r, { x: 360, y: 20, width: 260, height: 150 })).toBeLessThan(1);
  }, 120_000);
});
