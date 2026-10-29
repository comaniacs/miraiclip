/**
 * Canvas-painted sequences (tl.frame) through the shot check and the still renderer: subjects that leave the
 * frame or shrink away (tl.subject), rests that a painted picture breaks, and painters held to the frame grid so
 * motion-blur samples of one frame agree.
 */
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { checkShot } from "../src/check-shot.js";
import { createRenderSession, type RenderSession } from "../src/render-session.js";

const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));
const W = 320, H = 180;

// a dot (radius 6) painted on a canvas, moving right at 200 px/s from x = 50: it is wholly out of the 320 px frame
// once x - 6 > 320, at t = 1.38 s
const canvasSeq = (script: string, dur = 2, extra = "") =>
  `<div class="stage" data-libs="stage" data-duration="${dur}" data-stage-version="2"${extra} style="position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#000">` +
  `<canvas id="c" width="${W}" height="${H}" style="position:absolute;left:0;top:0"></canvas><div id="txt" style="position:absolute;left:8px;top:8px;color:#fff;font:20px sans-serif">0</div></div>` +
  `<script>stage.build((tl, S) => { var g = document.getElementById("c").getContext("2d"); var dotX = function (t) { return 50 + 200 * t; };` +
  `var paint = function (t) { g.fillStyle = "#000"; g.fillRect(0, 0, ${W}, ${H}); g.fillStyle = "#fff"; g.beginPath(); g.arc(dotX(t), 90, 6, 0, 7); g.fill(); };` +
  `tl.label("a", 0.5).label("b", 1.5); ${script} });</script>`;

const docOf = (template: string, dur = 2) => {
  const project = createProject({ width: W, height: H, fps: 30 });
  project.dispatch({ type: "track/add", payload: { id: "t", kind: "video" } });
  project.dispatch({ type: "clip/add", payload: { kind: "html", id: "s", trackId: "t", startUs: 0, durationUs: dur * 1_000_000, template, scripted: true } });
  return project.toJSON();
};
const reportOf = async (template: string) => {
  const res = await checkShot(docOf(template), { browser: { executablePath: browserPath } });
  return res.clips[0]!;
};

describe.runIf(browserPath)("canvas subjects, rests and held painters", () => {
  it("reports a canvas subject that leaves the frame, and when", async () => {
    const clip = await reportOf(canvasSeq(`tl.frame(paint, { motion: function (a, b) { return Math.abs(b - a) * 200; } }); tl.subject("dot", function (t) { return { x: dotX(t), y: 90, r: 6 }; });`));
    const out = clip.report!.framing.find((f) => f.subject === "dot" && f.kind === "out of frame");
    expect(out).toBeDefined();
    expect(out!.from).toBeGreaterThanOrEqual(1.38);
    expect(out!.from).toBeLessThanOrEqual(1.4 + 1e-9); // the first 1/30 s sample after 1.38
    expect(clip.report!.findings.some((f) => f.rule === "framing" && /dot is out of frame/.test(f.message))).toBe(true);
  }, 60_000);

  it("reports a subject that shrinks below minPx, and stays quiet for one that holds", async () => {
    const small = await reportOf(canvasSeq(`tl.frame(paint, { motion: function () { return 0; } }); tl.subject("speck", function (t) { return { x: 100, y: 90, r: 20 - 15 * t }; }, { minPx: 8, to: 1.2 });`));
    const lost = small.report!.framing.find((f) => f.kind === "too small");
    expect(lost?.from).toBeGreaterThan(0.75); // r drops under 8 at t = 0.8
    const steady = await reportOf(canvasSeq(`tl.frame(paint, { motion: function () { return 0; } }); tl.subject("steady", function () { return { x: 100, y: 90, r: 10 }; }, { minPx: 8 });`));
    expect(steady.report!.framing).toEqual([]);
  }, 60_000);

  it("fails a declared rest when the painted picture moves through it, and passes one where it holds", async () => {
    const moving = await reportOf(canvasSeq(`tl.frame(paint, { motion: function (a, b) { return Math.abs(b - a) * 200; } }); tl.rest(0.6, 1.0);`));
    expect(moving.report).toBeNull();
    expect(moving.skipped).toMatch(/painted frame/);
    const still = await reportOf(canvasSeq(`tl.frame(paint, { motion: function (a, b) { var c = function (t) { return Math.min(t, 0.6); }; return Math.abs(c(b) - c(a)) * 200; } }); tl.rest(0.6, 1.0);`));
    expect(still.report).not.toBeNull();
  }, 60_000);

  it("warns that a rest can't be verified when a painter reports no motion", async () => {
    const clip = await reportOf(canvasSeq(`tl.frame(paint); tl.rest(0.6, 1.0);`));
    expect(clip.report!.findings.some((f) => f.rule === "rest-unverified")).toBe(true);
  }, 60_000);

  describe("held painters", () => {
    let session: RenderSession;
    beforeAll(async () => { session = await createRenderSession({ browser: { executablePath: browserPath } }); });
    afterAll(async () => { await session?.close(); });
    // the text shows the time it was painted for; two instants inside one 30 fps frame (1.000–1.033 s)
    const stills = async (hold: boolean) => {
      const doc = docOf(canvasSeq(`tl.frame(function (t) { document.getElementById("txt").textContent = t.toFixed(3); }, { hold: ${hold} });`));
      return Promise.all([1_005_000, 1_025_000].map(async (timeUs) => Buffer.from(await session.renderStill(doc, { timeUs })).toString("base64")));
    };
    it("paints every instant of one output frame the same when held", async () => {
      const [a, b] = await stills(true);
      expect(a).toBe(b);
    }, 60_000);
    it("paints each instant when not held", async () => {
      const [a, b] = await stills(false);
      expect(a).not.toBe(b);
    }, 60_000);
  });
});
