import { describe, expect, it } from "vitest";
import {
  CommandRejectedError,
  CommandValidationError,
  UnknownCommandError,
  createProject,
  frameToUs,
  snapToFrame,
  usToFrame,
  usToTimecode,
} from "../src/index.js";
import { z } from "zod";

function projectWithMedia() {
  const project = createProject({ width: 1920, height: 1080, fps: 30 });
  project.dispatch({
    type: "asset/add",
    payload: { id: "intro", kind: "video", src: "/media/intro.mp4", durationUs: 12_000_000 },
  });
  project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
  project.dispatch({
    type: "clip/add",
    payload: {
      kind: "video",
      id: "c1",
      trackId: "v1",
      assetId: "intro",
      startUs: 0,
      durationUs: 5_000_000,
    },
  });
  return project;
}

describe("commands", () => {
  it("adds tracks and clips through commands", () => {
    const project = projectWithMedia();
    const { doc } = project.getState();
    expect(doc.trackOrder).toEqual(["v1"]);
    expect(doc.clips["c1"]).toMatchObject({
      kind: "video",
      startUs: 0,
      durationUs: 5_000_000,
      trimStartUs: 0,
      volume: 1,
    });
    expect(doc.clips["c1"]?.transform.opacity).toBe(1);
  });

  it("rejects invalid payloads without touching state", () => {
    const project = projectWithMedia();
    const before = project.getState().doc;
    expect(() =>
      project.dispatch({ type: "clip/move", payload: { clipId: "c1", startUs: -5 } }),
    ).toThrow(CommandValidationError);
    expect(project.getState().doc).toBe(before);
    expect(project.canUndo()).toBe(true); // setup commands only
  });

  it("rejects semantically impossible commands", () => {
    const project = projectWithMedia();
    expect(() =>
      project.dispatch({ type: "clip/move", payload: { clipId: "nope", startUs: 0 } }),
    ).toThrow(CommandRejectedError);
    expect(() =>
      project.dispatch({ type: "asset/remove", payload: { id: "intro" } }),
    ).toThrow(/asset-in-use/);
    expect(() => project.dispatch({ type: "wat/wat", payload: {} })).toThrow(
      UnknownCommandError,
    );
  });

  it("enforces track kind constraints", () => {
    const project = projectWithMedia();
    project.dispatch({ type: "track/add", payload: { id: "a1", kind: "audio" } });
    expect(() =>
      project.dispatch({ type: "clip/move", payload: { clipId: "c1", trackId: "a1" } }),
    ).toThrow(/kind-mismatch/);
  });

  it("splits a clip and preserves source trim continuity", () => {
    const project = projectWithMedia();
    project.dispatch({
      type: "clip/split",
      payload: { clipId: "c1", atUs: 2_000_000, newClipId: "c1b" },
    });
    const { doc } = project.getState();
    expect(doc.clips["c1"]).toMatchObject({ startUs: 0, durationUs: 2_000_000 });
    expect(doc.clips["c1b"]).toMatchObject({
      startUs: 2_000_000,
      durationUs: 3_000_000,
      trimStartUs: 2_000_000,
    });
  });

  it("removes a track together with its clips", () => {
    const project = projectWithMedia();
    project.dispatch({ type: "track/remove", payload: { id: "v1" } });
    const { doc } = project.getState();
    expect(doc.tracks["v1"]).toBeUndefined();
    expect(doc.clips["c1"]).toBeUndefined();
    expect(doc.trackOrder).toEqual([]);
  });
});

describe("history", () => {
  it("undoes and redoes single commands", () => {
    const project = projectWithMedia();
    project.dispatch({ type: "clip/move", payload: { clipId: "c1", startUs: 1_000_000 } });
    expect(project.getState().doc.clips["c1"]?.startUs).toBe(1_000_000);
    expect(project.undo()).toBe(true);
    expect(project.getState().doc.clips["c1"]?.startUs).toBe(0);
    expect(project.redo()).toBe(true);
    expect(project.getState().doc.clips["c1"]?.startUs).toBe(1_000_000);
  });

  it("treats a transaction as one history entry", () => {
    const project = projectWithMedia();
    project.transaction(() => {
      project.dispatch({
        type: "clip/split",
        payload: { clipId: "c1", atUs: 2_000_000, newClipId: "c1b" },
      });
      project.dispatch({ type: "clip/remove", payload: { clipId: "c1b" } });
    }, "split & clean");
    expect(project.getState().doc.clips["c1b"]).toBeUndefined();
    project.undo();
    const { doc } = project.getState();
    expect(doc.clips["c1"]?.durationUs).toBe(5_000_000);
    expect(doc.clips["c1b"]).toBeUndefined();
  });

  it("rolls back a failed transaction atomically", () => {
    const project = projectWithMedia();
    expect(() =>
      project.transaction(() => {
        project.dispatch({
          type: "clip/move",
          payload: { clipId: "c1", startUs: 3_000_000 },
        });
        project.dispatch({ type: "clip/remove", payload: { clipId: "ghost" } });
      }),
    ).toThrow(CommandRejectedError);
    expect(project.getState().doc.clips["c1"]?.startUs).toBe(0);
    project.undo(); // undoes clip/add from setup, not the failed transaction
    expect(project.getState().doc.clips["c1"]).toBeUndefined();
  });

  it("dispatch clears the redo stack", () => {
    const project = projectWithMedia();
    project.dispatch({ type: "clip/move", payload: { clipId: "c1", startUs: 1 } });
    project.undo();
    expect(project.canRedo()).toBe(true);
    project.dispatch({ type: "clip/move", payload: { clipId: "c1", startUs: 2 } });
    expect(project.canRedo()).toBe(false);
  });

  it("keeps the playhead out of history", () => {
    const project = createProject({ width: 1280, height: 720, fps: 30 });
    project.setPlayhead(42);
    expect(project.canUndo()).toBe(false);
    expect(project.getState().playheadUs).toBe(42);
  });
});

describe("patches & events", () => {
  it("emits RFC-6902 patches with inverses", () => {
    const project = projectWithMedia();
    const seen: unknown[] = [];
    project.events.on("patches", (e) => seen.push(e));
    project.dispatch({ type: "clip/move", payload: { clipId: "c1", startUs: 1_000_000 } });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      source: "dispatch",
      patches: [{ op: "replace", path: "/clips/c1/startUs", value: 1_000_000 }],
      inverse: [{ op: "replace", path: "/clips/c1/startUs", value: 0 }],
    });
  });

  it("supports selector subscriptions", () => {
    const project = projectWithMedia();
    const values: number[] = [];
    project.subscribe(
      (s) => s.doc.clips["c1"]?.startUs,
      (v) => values.push(v ?? -1),
    );
    project.dispatch({ type: "clip/move", payload: { clipId: "c1", startUs: 7 } });
    project.dispatch({ type: "track/rename", payload: { trackId: "v1", name: "Main" } });
    expect(values).toEqual([7]); // unrelated change did not notify
  });
});

describe("serialization", () => {
  it("round-trips through toJSON", () => {
    const project = projectWithMedia();
    const restored = createProject(project.toJSON());
    expect(restored.toJSON()).toEqual(project.toJSON());
    // restored project is fully functional
    restored.dispatch({ type: "clip/move", payload: { clipId: "c1", startUs: 9 } });
    expect(restored.getState().doc.clips["c1"]?.startUs).toBe(9);
  });

  it("refuses unknown schema versions", () => {
    const doc = projectWithMedia().toJSON();
    (doc as { schemaVersion: number }).schemaVersion = 99;
    expect(() => createProject(doc)).toThrow(/schemaVersion/);
  });
});

describe("custom commands & catalog", () => {
  it("registers custom commands with history support", () => {
    const project = projectWithMedia();
    project.registerCommand({
      type: "project/rename",
      schema: z.object({ name: z.string().min(1) }),
      handler: (doc, p) => {
        doc.settings.name = p.name;
      },
    });
    project.dispatch({ type: "project/rename", payload: { name: "My cut" } });
    expect(project.getState().doc.settings.name).toBe("My cut");
    project.undo();
    expect(project.getState().doc.settings.name).toBeUndefined();
  });

  it("exposes a JSON Schema catalog including custom commands", () => {
    const project = projectWithMedia();
    project.registerCommand({
      type: "project/rename",
      schema: z.object({ name: z.string() }),
      handler: () => undefined,
    });
    const catalog = project.commandCatalog();
    expect(Object.keys(catalog)).toContain("clip/split");
    expect(Object.keys(catalog)).toContain("project/rename");
    const split = catalog["clip/split"] as { properties: Record<string, unknown> };
    expect(split.properties).toHaveProperty("atUs");
  });
});

describe("timeline utils", () => {
  it("converts between µs, frames, and timecode", () => {
    expect(usToFrame(1_000_000, 30)).toBe(30);
    expect(frameToUs(30, 30)).toBe(1_000_000);
    expect(snapToFrame(1_016_000, 30)).toBe(1_000_000);
    expect(usToTimecode(3_661_500_000, 30)).toBe("01:01:01:15");
  });
});
