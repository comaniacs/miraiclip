import { describe, expect, it } from "vitest";
import { applyCommands, createProject, evaluateClipAt, evaluateEffectRegion, type Project } from "@miraiclip/core";
import { sessionCommands, type CaptureEvent, type CaptureSession } from "@miraiclip/capture";
import {
  framePointToCanvas,
  planCallouts,
  planClickEffects,
  planCursor,
  planRedactions,
  planScreencast,
  planZooms,
  redactionSpans,
  screenClip,
  zoomSegments,
} from "../src/index.js";

const S = 1_000_000;
const save = { selector: "#save", tag: "button", label: "Save", rect: { x: 900, y: 500, width: 120, height: 40 } };
const pw = { selector: "#pw", tag: "input", label: "Password", sensitive: true, rect: { x: 100, y: 800, width: 300, height: 40 } };
const corner = { selector: "#menu", tag: "button", label: "Menu", rect: { x: 1860, y: 10, width: 50, height: 40 } };

function makeSession(events: CaptureEvent[], durationUs = 20 * S): CaptureSession {
  return {
    format: 1,
    startedAt: "2026-10-17T00:00:00.000Z",
    durationUs,
    viewport: { width: 1920, height: 1080, devicePixelRatio: 1 },
    viewportInVideo: { x: 0, y: 0, width: 1, height: 1 },
    media: { screen: { mimeType: "video/webm", width: 1920, height: 1080, durationUs } },
    events: [{ tUs: 0, type: "navigate", url: "https://app.example.com/login" }, ...events],
  };
}

const session = makeSession([
  ...Array.from({ length: 40 }, (_, i): CaptureEvent => ({ tUs: 1 * S + i * 50_000, type: "move", x: 200 + i * 18, y: 300 + i * 5 })),
  { tUs: 3 * S, type: "click", x: 960, y: 520, button: 0, target: save },
  { tUs: 3.2 * S, type: "click", x: 962, y: 521, button: 0, target: save }, // fast second click
  { tUs: 7 * S, type: "click", x: 250, y: 820, button: 0, target: pw },
  { tUs: 7.1 * S, type: "focus", target: pw },
  { tUs: 7.5 * S, type: "input", target: pw },
  { tUs: 9 * S, type: "scroll", scrollX: 0, scrollY: 200 },
  { tUs: 12 * S, type: "click", x: 1885, y: 30, button: 0, target: corner },
  { tUs: 15 * S, type: "navigate", url: "https://app.example.com/home" },
]);

function projectFor(s: CaptureSession, clip: { trimStartUs?: number; speed?: number; durationUs?: number } = {}): Project {
  const p = createProject({ width: 1920, height: 1080, fps: 30 });
  const r = applyCommands(p, sessionCommands(s, { screenSrc: "screen.webm" }));
  expect(r.ok).toBe(true);
  if (clip.trimStartUs !== undefined || clip.durationUs !== undefined) {
    p.dispatch({ type: "clip/trim", payload: { clipId: "screen", ...(clip.trimStartUs !== undefined ? { trimStartUs: clip.trimStartUs } : {}), ...(clip.durationUs !== undefined ? { durationUs: clip.durationUs } : {}) } });
  }
  if (clip.speed !== undefined) p.dispatch({ type: "clip/set-speed", payload: { clipId: "screen", speed: clip.speed } });
  return p;
}

function apply(p: Project, commands: { type: string; payload: Record<string, unknown> }[]) {
  const r = applyCommands(p, commands);
  expect(r.ok, JSON.stringify(!r.ok && r.error)).toBe(true);
  return p.getState().doc;
}

describe("planZooms", () => {
  it("groups nearby clicks, zooms in before them and back out after", () => {
    const p = projectFor(session);
    const segs = zoomSegments(p.getState().doc, session, { clipId: "screen" });
    // 3 s + 3.2 s are one zoom; the password click (7 s) + its typing another; the corner click a third.
    expect(segs.map((s) => s.eventsUs.length)).toEqual([2, 2, 1]);
    const [a] = segs;
    expect(a!.inEndUs).toBe(2.7 * S);
    expect(a!.inStartUs).toBe(2.1 * S);
    expect(a!.outStartUs).toBe(4.8 * S);
    expect(a!.scale).toBe(1.8);
  });

  it("puts the focus at the centre when it can, and never shows the frame's edge", () => {
    const p = projectFor(session);
    const doc = apply(p, planZooms(p.getState().doc, session, { clipId: "screen" }));
    const clip = screenClip(doc, "screen");
    // Fully zoomed on the Save button: it sits at the canvas centre.
    const mid = framePointToCanvas(doc, clip, 3 * S, 960 / 1920, 520 / 1080);
    expect(mid.x).toBeCloseTo(0.5, 2);
    expect(mid.y).toBeCloseTo(0.5, 2);
    // Zoomed on the top-right corner: clamped, the frame still covers the canvas.
    const e = evaluateClipAt(clip, 12 * S);
    expect(e.scale).toBeCloseTo(1.8, 5);
    expect(e.x + e.scale / 2).toBeGreaterThanOrEqual(1 - 1e-6);
    expect(e.x - e.scale / 2).toBeLessThanOrEqual(1e-6);
    expect(e.y - e.scale / 2).toBeLessThanOrEqual(1e-6);
    // Between zooms it rests.
    expect(evaluateClipAt(clip, 0).scale).toBe(1);
    expect(evaluateClipAt(clip, 5.6 * S).scale).toBeCloseTo(1, 5);
  });

  it("chains zooms that would overlap into a pan, without zooming out between", () => {
    const s = makeSession([
      { tUs: 3 * S, type: "click", x: 300, y: 300, button: 0 },
      { tUs: 5.5 * S, type: "click", x: 1600, y: 800, button: 0 },
    ]);
    const p = projectFor(s);
    const doc = apply(p, planZooms(p.getState().doc, s, { clipId: "screen", mergeGapUs: 1 * S }));
    const clip = screenClip(doc, "screen");
    expect(zoomSegments(doc, s, { clipId: "screen", mergeGapUs: 1 * S })).toHaveLength(2);
    for (let t = 2.7 * S; t <= 5.2 * S; t += 100_000) expect(evaluateClipAt(clip, t).scale).toBeCloseTo(1.8, 5);
  });

  it("follows trims and speed changes", () => {
    const p = projectFor(session, { trimStartUs: 2 * S, durationUs: 16 * S });
    p.dispatch({ type: "clip/set-speed", payload: { clipId: "screen", speed: 2 } });
    const doc = p.getState().doc;
    const [a] = zoomSegments(doc, session, { clipId: "screen" });
    // Session 3 s = 1 s into the trimmed source = 0.5 s of timeline at 2×.
    expect(a!.eventsUs[0]).toBe(0.5 * S);
    expect(a!.inStartUs).toBe(0);
    apply(p, planZooms(doc, session, { clipId: "screen" }));
  });
});

describe("planCursor", () => {
  it("adds one cursor clip that lands exactly on every click, through the zoom", () => {
    const p = projectFor(session);
    apply(p, planZooms(p.getState().doc, session, { clipId: "screen" }));
    const doc = apply(p, planCursor(p.getState().doc, session, { clipId: "screen" }));
    const cursor = doc.clips["cursor"]!;
    expect(cursor.kind).toBe("html");
    expect(cursor.durationUs).toBe(doc.clips["screen"]!.durationUs);
    const clip = screenClip(doc, "screen");
    for (const [t, x, y] of [[3 * S, 960, 520], [12 * S, 1885, 30]] as const) {
      const want = framePointToCanvas(doc, clip, t, x / 1920, y / 1080);
      const got = evaluateClipAt(cursor, t);
      expect(got.x).toBeCloseTo(want.x, 4);
      expect(got.y).toBeCloseTo(want.y, 4);
    }
    // Grows with the zoom.
    expect(evaluateClipAt(cursor, 3 * S).scale).toBeGreaterThan(evaluateClipAt(cursor, 0).scale);
  });

  it("styles: each draws its own block, with only the colours it has", () => {
    for (const style of ["arrow", "highlight", "hand", "halo", "dot", "ring"] as const) {
      const p = projectFor(session);
      const doc = apply(p, planCursor(p.getState().doc, session, { clipId: "screen", style, fill: "#000000", highlight: "#ff0000" }));
      const html = JSON.stringify(doc.clips["cursor"]);
      if (style === "arrow" || style === "hand") expect(html).toContain("#000000");
      if (style !== "arrow" && style !== "hand") expect(html).toContain("#ff0000");
      else expect(html).not.toContain("#ff0000");
    }
  });

  it("highlight-only styles sit exactly on the recorded pointer (no smoothing lag)", () => {
    const s = makeSession(Array.from({ length: 30 }, (_, i): CaptureEvent => ({ tUs: i * 33_000, type: "move", x: 100 + (i % 2) * 400, y: 300 })));
    const p = projectFor(s);
    const doc = apply(p, planCursor(p.getState().doc, s, { clipId: "screen", style: "halo" }));
    const clip = screenClip(doc, "screen");
    const want = framePointToCanvas(doc, clip, 5 * 33_000, 500 / 1920, 300 / 1080);
    expect(evaluateClipAt(doc.clips["cursor"]!, 5 * 33_000).x).toBeCloseTo(want.x, 4);
  });

  it("hides while the pointer is outside the logged pages, and comes back where it moves next", () => {
    const s = makeSession([
      { tUs: 0, type: "move", x: 100, y: 100 },
      { tUs: 1 * S, type: "move", x: 200, y: 100 },
      { tUs: 2 * S, type: "leave" },
      { tUs: 5 * S, type: "move", x: 900, y: 500 },
      { tUs: 6 * S, type: "click", x: 900, y: 500, button: 0 },
    ]);
    const p = projectFor(s);
    const doc = apply(p, planCursor(p.getState().doc, s, { clipId: "screen" }));
    const cursor = doc.clips["cursor"]!;
    expect(evaluateClipAt(cursor, 1 * S).opacity).toBeCloseTo(1, 5);
    expect(evaluateClipAt(cursor, 3.5 * S).opacity).toBeCloseTo(0, 5);
    expect(evaluateClipAt(cursor, 5.5 * S).opacity).toBeCloseTo(1, 5);
  });

  it("simplifies a straight-line path to a few keyframes", () => {
    const s = makeSession(Array.from({ length: 100 }, (_, i): CaptureEvent => ({ tUs: i * 33_000, type: "move", x: i * 10, y: 100 })));
    const p = projectFor(s);
    const commands = planCursor(p.getState().doc, s, { clipId: "screen", smoothingUs: 0 });
    expect(commands.filter((c) => c.type === "keyframe/set").length).toBeLessThanOrEqual(6);
    apply(p, commands);
  });
});

describe("planClickEffects", () => {
  it("adds a ripple per click, shortening one that a fast second click would overlap", () => {
    const p = projectFor(session);
    const doc = apply(p, planClickEffects(p.getState().doc, session, { clipId: "screen" }));
    const ripples = Object.values(doc.clips).filter((c) => c.trackId === "clicks");
    expect(ripples).toHaveLength(4);
    expect(ripples.find((c) => c.startUs === 3 * S)!.durationUs).toBe(200_000);
    expect(ripples.find((c) => c.startUs === 7 * S)!.durationUs).toBe(600_000);
  });
});

describe("planRedactions", () => {
  it("covers the password field from page load until the next navigation, following the scroll", () => {
    const [span] = redactionSpans(session);
    expect(span).toMatchObject({ selector: "#pw", fromUs: 0, toUs: 15 * S });
    const p = projectFor(session);
    const doc = apply(p, planRedactions(p.getState().doc, session, { clipId: "screen", paddingPx: 0 }));
    const effect = doc.clips["screen"]!.effects![0]!;
    expect(effect.kind).toBe("pixelate");
    const at = (t: number) => evaluateEffectRegion(effect.region!, t);
    expect(at(1 * S).x).toBeCloseTo(100 / 1920, 4);
    expect(at(1 * S).width).toBeCloseTo(300 / 1920, 4);
    expect(at(1 * S).y).toBeCloseTo(800 / 1080, 4);
    expect(at(10 * S).y).toBeCloseTo(600 / 1080, 4); // scrolled 200 px up
    expect(at(16 * S).x + at(16 * S).width).toBeLessThan(0); // off-frame after navigating away
  });

  it("can hide extra selectors and use blur", () => {
    const p = projectFor(session);
    const commands = planRedactions(p.getState().doc, session, { clipId: "screen", effect: "blur", selectors: ["#menu"] });
    expect(commands.filter((c) => c.type === "effect/add").map((c) => c.payload["kind"])).toEqual(["blur", "blur"]);
    apply(p, commands);
  });
});

describe("planCallouts", () => {
  it("labels clicks, skips sensitive ones and puts the tooltip on the roomier side", () => {
    const p = projectFor(session);
    const doc = apply(p, planCallouts(p.getState().doc, session, { clipId: "screen" }));
    const callouts = Object.values(doc.clips).filter((c) => c.trackId === "callouts");
    expect(callouts.map((c) => (c as { params: Record<string, unknown> }).params["text"])).toEqual(["Click “Save”", "Click “Menu”"]);
    const menu = callouts[1] as { params: Record<string, unknown>; transform: { x: number } };
    expect(menu.params["side"]).toBe("right"); // target at the right edge → tooltip to its left
    expect(menu.transform.x).toBeLessThan(0.9);
  });
});

describe("planScreencast", () => {
  it("runs every step against the result of the previous ones, without touching the input", () => {
    const p = projectFor(session);
    const before = JSON.stringify(p.getState().doc);
    const plan = planScreencast(p.getState().doc, session, { clipId: "screen", callouts: true });
    expect(JSON.stringify(p.getState().doc)).toBe(before);
    expect(plan.steps.zooms.length).toBeGreaterThan(0);
    expect(plan.steps.cursor.length).toBeGreaterThan(0);
    expect(plan.steps.redactions.length).toBeGreaterThan(0);
    expect(plan.steps.callouts.length).toBeGreaterThan(0);
    const doc = apply(p, plan.commands);
    expect(doc).toEqual(plan.doc);
    // One undo removes it all.
    p.undo();
    expect(JSON.stringify(p.getState().doc)).toBe(before);
  });
});
