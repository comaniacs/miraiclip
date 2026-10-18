import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createProject } from "../src/engine.js";
import { registerClipKind, unregisterClipKind } from "../src/registry.js";

const S = 1_000_000;

function setup() {
  const p = createProject({ width: 640, height: 360, fps: 30 });
  p.transaction(() => {
    p.dispatch({ type: "asset/add", payload: { id: "a", kind: "video", src: "x.mp4", durationUs: 60 * S } });
    p.dispatch({ type: "track/add", payload: { id: "v", kind: "video" } });
    p.dispatch({ type: "clip/add", payload: { kind: "video", id: "l", trackId: "v", assetId: "a", startUs: 0, durationUs: 5 * S, trimStartUs: 5 * S } });
    p.dispatch({ type: "clip/add", payload: { kind: "video", id: "r", trackId: "v", assetId: "a", startUs: 5 * S, durationUs: 5 * S, trimStartUs: 20 * S } });
    p.dispatch({ type: "transition/add", payload: { id: "t", kind: "crossDissolve", fromClipId: "l", toClipId: "r", durationUs: S } });
  });
  return p;
}

describe("gestures (core)", () => {
  it("coalesces many dispatches spread over time into one undo step", async () => {
    const p = setup();
    const g = p.beginGesture("drag x");
    expect(p.inGesture()).toBe(true);
    for (const x of [0.4, 0.3, 0.2]) {
      await Promise.resolve();
      p.dispatch({ type: "clip/set-property", payload: { clipId: "l", transform: { x } } });
    }
    p.transaction(() => p.dispatch({ type: "clip/set-property", payload: { clipId: "l", transform: { y: 0.1 } } }));
    const labels: (string | undefined)[] = [];
    p.events.on("history", (e) => labels.push(e.label));
    g.end();
    g.end();
    expect(labels).toEqual(["drag x"]);
    expect(p.getState().doc.clips["l"]!.transform).toMatchObject({ x: 0.2, y: 0.1 });
    p.undo();
    expect(p.getState().doc.clips["l"]!.transform).toMatchObject({ x: 0.5, y: 0.5 });
    expect(p.canUndo()).toBe(true); // the setup transaction is still there
    p.redo();
    expect(p.getState().doc.clips["l"]!.transform.x).toBe(0.2);
  });

  it("cancel reverts the gesture; empty gestures leave no entry; nested joins", () => {
    const p = setup();
    const g = p.beginGesture();
    p.dispatch({ type: "clip/set-property", payload: { clipId: "l", transform: { x: 0.1 } } });
    const inner = p.beginGesture("inner");
    p.dispatch({ type: "clip/set-property", payload: { clipId: "l", transform: { y: 0.9 } } });
    inner.end();
    expect(p.inGesture()).toBe(true);
    g.cancel();
    expect(p.getState().doc.clips["l"]!.transform).toMatchObject({ x: 0.5, y: 0.5 });
    let commits = 0;
    p.events.on("history", () => commits++);
    p.beginGesture().end();
    expect(commits).toBe(0);
  });

  it("undo during an open gesture ends it first", () => {
    const p = setup();
    p.beginGesture("g");
    p.dispatch({ type: "clip/set-property", payload: { clipId: "l", transform: { x: 0.1 } } });
    p.undo();
    expect(p.inGesture()).toBe(false);
    expect(p.getState().doc.clips["l"]!.transform.x).toBe(0.5);
  });
});

describe("custom clip props via clip/set-property", () => {
  it("merges, unsets and re-validates props; rejects props on built-in clips", () => {
    registerClipKind("t/counter", {
      propsSchema: z.object({ from: z.number().default(0), to: z.number().default(100), label: z.string().optional() }),
      trackKinds: ["video"],
    });
    try {
      const p = setup();
      p.dispatch({ type: "clip/add", payload: { kind: "t/counter", id: "c", trackId: "v", startUs: 10 * S, durationUs: S, props: { to: 50, label: "Users" } } });
      p.dispatch({ type: "clip/set-property", payload: { clipId: "c", props: { from: 10 }, unsetProps: ["label"] } });
      expect((p.getState().doc.clips["c"] as { props: unknown }).props).toEqual({ from: 10, to: 50 });
      expect(() => p.dispatch({ type: "clip/set-property", payload: { clipId: "c", props: { to: "lots" } } })).toThrow(/invalid-props|invalid t\/counter/);
      expect(() => p.dispatch({ type: "clip/set-property", payload: { clipId: "l", props: { x: 1 } } })).toThrow(/not-custom/);
      p.undo();
      expect((p.getState().doc.clips["c"] as { props: unknown }).props).toEqual({ from: 0, to: 50, label: "Users" });
    } finally {
      unregisterClipKind("t/counter");
    }
  });
});

describe("transitions survive edits that change nothing", () => {
  it("a zero-distance move or a same-value trim keeps the transition; a real move drops it", () => {
    const p = setup();
    p.dispatch({ type: "clip/move", payload: { clipId: "r", startUs: 5 * S, trackId: "v" } });
    p.dispatch({ type: "clip/trim", payload: { clipId: "l", durationUs: 5 * S, trimStartUs: 5 * S } });
    expect(p.getState().doc.transitions["t"]).toBeDefined();
    p.dispatch({ type: "clip/move", payload: { clipId: "r", startUs: 6 * S } });
    expect(p.getState().doc.transitions["t"]).toBeUndefined();
  });
});
