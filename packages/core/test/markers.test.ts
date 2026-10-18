import { describe, expect, it } from "vitest";
import { createProject } from "../src/engine.js";
import { describeProject } from "../src/ai.js";
import { listMarkers, markerChapters, markersInRange } from "../src/markers.js";
import { toJsonPatches } from "../src/patches.js";

const S = 1_000_000;

function setup() {
  const project = createProject({ width: 640, height: 360, fps: 30 });
  project.dispatch({ type: "track/add", payload: { id: "t", kind: "video" } });
  project.dispatch({ type: "clip/add", payload: { kind: "text", id: "x", trackId: "t", startUs: 0, durationUs: 10 * S, text: "hi" } });
  return project;
}

describe("markers", () => {
  it("documents carry no markers key until one is added, and lose it when the last goes", () => {
    const p = setup();
    expect("markers" in p.getState().doc).toBe(false);
    p.dispatch({ type: "marker/add", payload: { id: "m1", timeUs: 2 * S, label: "Intro" } });
    expect(p.getState().doc.markers).toEqual({ m1: { id: "m1", timeUs: 2 * S, label: "Intro" } });
    p.dispatch({ type: "marker/remove", payload: { markerId: "m1" } });
    expect("markers" in p.getState().doc).toBe(false);
    p.undo();
    expect(p.getState().doc.markers?.m1?.label).toBe("Intro");
  });

  it("add/update/remove validate and keep data as plain JSON", () => {
    const p = setup();
    p.dispatch({ type: "marker/add", payload: { id: "s1", timeUs: S, label: "Click Save", durationUs: 2 * S, data: { kind: "step", n: 1 } } });
    expect(() => p.dispatch({ type: "marker/add", payload: { id: "s1", timeUs: 0, label: "dup" } })).toThrow(/duplicate-id|already exists/);
    p.dispatch({ type: "marker/update", payload: { markerId: "s1", label: "Click Save (⌘S)", durationUs: null } });
    expect(p.getState().doc.markers!.s1).toEqual({ id: "s1", timeUs: S, label: "Click Save (⌘S)", data: { kind: "step", n: 1 } });
    p.dispatch({ type: "marker/update", payload: { markerId: "s1", data: null, timeUs: 3 * S } });
    expect(p.getState().doc.markers!.s1).toEqual({ id: "s1", timeUs: 3 * S, label: "Click Save (⌘S)" });
    expect(() => p.dispatch({ type: "marker/update", payload: { markerId: "nope", label: "x" } })).toThrow(/marker-not-found/);
    expect(() => p.dispatch({ type: "marker/remove", payload: { markerId: "nope" } })).toThrow(/marker-not-found/);
  });

  it("emits JSON patches under /markers (collaboration and autosave see them)", () => {
    const p = setup();
    const seen: string[] = [];
    p.events.on("patches", ({ patches }) => seen.push(...patches.map((op) => op.path)));
    p.dispatch({ type: "marker/add", payload: { id: "m", timeUs: 0, label: "A" } });
    expect(seen.some((path) => path.startsWith("/markers"))).toBe(true);
    expect(typeof toJsonPatches).toBe("function");
  });

  it("lists, ranges and chapters", () => {
    const p = setup();
    p.dispatch({ type: "marker/add", payload: { id: "c", timeUs: 6 * S, label: "Wrap up" } });
    p.dispatch({ type: "marker/add", payload: { id: "a", timeUs: 0, label: "Intro" } });
    p.dispatch({ type: "marker/add", payload: { id: "b", timeUs: 2 * S, label: "Demo", durationUs: 3 * S } });
    const doc = p.getState().doc;
    expect(listMarkers(doc).map((m) => m.id)).toEqual(["a", "b", "c"]);
    expect(markersInRange(doc, S, 3 * S).map((m) => m.id)).toEqual(["b"]);
    expect(markersInRange(doc, 4 * S, 7 * S).map((m) => m.id)).toEqual(["b", "c"]);
    expect(markerChapters(doc)).toEqual([
      { id: "a", label: "Intro", startUs: 0, endUs: 2 * S },
      { id: "b", label: "Demo", startUs: 2 * S, endUs: 5 * S },
      { id: "c", label: "Wrap up", startUs: 6 * S, endUs: 10 * S },
    ]);
    expect(describeProject(doc)).toContain('markers:\n- a: "Intro" at 0');
  });
});
