import { describe, expect, it } from "vitest";
import {
  CommandRejectedError,
  CommandValidationError,
  UnknownCommandError,
  createProject,
  evaluateClipAt,
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

describe("per-axis scale and flip (scaleX / scaleY)", () => {
  function withClip(transform?: Record<string, number>) {
    const project = createProject({ width: 1920, height: 1080, fps: 30 });
    project.dispatch({ type: "track/add", payload: { id: "t1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "text", id: "c", trackId: "t1", startUs: 0, durationUs: 1_000_000, text: "x", ...(transform ? { transform } : {}) },
    });
    return project;
  }
  const tf = (p: ReturnType<typeof withClip>) => p.getState().doc.clips["c"]!.transform;

  it("documents stay minimal: no scaleX/scaleY until used, none stored at 1", () => {
    const p = withClip();
    expect(tf(p)).not.toHaveProperty("scaleX");
    p.dispatch({ type: "clip/set-property", payload: { clipId: "c", transform: { scaleX: 2 } } });
    expect(tf(p).scaleX).toBe(2);
    p.dispatch({ type: "clip/set-property", payload: { clipId: "c", transform: { scaleX: 1 } } });
    expect(tf(p)).not.toHaveProperty("scaleX");
    expect(withClip({ scaleY: 1 })["getState"]().doc.clips["c"]!.transform).not.toHaveProperty("scaleY");
  });

  it("accepts negative values (a flip) and undoes in one step", () => {
    const p = withClip({ scaleX: -1 });
    expect(tf(p).scaleX).toBe(-1);
    p.dispatch({ type: "clip/set-property", payload: { clipId: "c", transform: { scaleY: -1 } } });
    p.undo();
    expect(tf(p)).not.toHaveProperty("scaleY");
    expect(tf(p).scaleX).toBe(-1);
  });

  it("rejects 0, which would collapse the clip", () => {
    const p = withClip();
    expect(() =>
      p.dispatch({ type: "clip/set-property", payload: { clipId: "c", transform: { scaleX: 0 } } }),
    ).toThrow(CommandValidationError);
  });

  it("evaluation carries the stretch (default 1) and it survives a save and load", () => {
    const p = withClip({ scaleX: 2 });
    const ev = evaluateClipAt(p.getState().doc.clips["c"]!, 0);
    expect([ev.scaleX, ev.scaleY]).toEqual([2, 1]);
    const reloaded = createProject(JSON.parse(JSON.stringify(p.toJSON())));
    expect(reloaded.getState().doc.clips["c"]!.transform.scaleX).toBe(2);
  });
});

describe("crop (video and image clips)", () => {
  function withImage() {
    const project = createProject({ width: 1920, height: 1080, fps: 30 });
    project.dispatch({ type: "asset/add", payload: { id: "img", kind: "image", src: "/a.png" } });
    project.dispatch({ type: "track/add", payload: { id: "t1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "image", id: "c", trackId: "t1", assetId: "img", startUs: 0, durationUs: 1_000_000 },
    });
    return project;
  }
  const clip = (p: ReturnType<typeof withImage>) => p.getState().doc.clips["c"]! as { crop?: unknown };
  const half = { x: 0.25, y: 0, width: 0.5, height: 1 };

  it("sets and clears a crop, one undo step each; documents stay minimal", () => {
    const p = withImage();
    expect(clip(p)).not.toHaveProperty("crop");
    p.dispatch({ type: "clip/set-property", payload: { clipId: "c", crop: half } });
    expect(clip(p).crop).toEqual(half);
    p.dispatch({ type: "clip/set-property", payload: { clipId: "c", crop: null } });
    expect(clip(p)).not.toHaveProperty("crop");
    p.undo();
    expect(clip(p).crop).toEqual(half);
    p.dispatch({ type: "clip/set-property", payload: { clipId: "c", crop: { x: 0, y: 0, width: 1, height: 1 } } });
    expect(clip(p)).not.toHaveProperty("crop"); // the whole picture is the default
  });

  it("can be given when the clip is added", () => {
    const p = withImage();
    p.dispatch({
      type: "clip/add",
      payload: { kind: "image", id: "d", trackId: "t1", assetId: "img", startUs: 1_000_000, durationUs: 1_000_000, crop: half },
    });
    expect((p.getState().doc.clips["d"] as { crop?: unknown }).crop).toEqual(half);
  });

  it("rejects an empty or out-of-picture crop, and non-picture clips", () => {
    const p = withImage();
    for (const crop of [
      { x: 0.6, y: 0, width: 0.5, height: 1 },
      { x: 0, y: 0, width: 0, height: 1 },
      { x: -0.1, y: 0, width: 0.5, height: 1 },
      { x: 0, y: 0, width: 1.2, height: 1 },
    ]) {
      expect(() => p.dispatch({ type: "clip/set-property", payload: { clipId: "c", crop } })).toThrow(CommandValidationError);
    }
    p.dispatch({ type: "track/add", payload: { id: "t2", kind: "video" } });
    p.dispatch({ type: "clip/add", payload: { kind: "text", id: "tx", trackId: "t2", startUs: 0, durationUs: 1_000_000, text: "x" } });
    expect(() => p.dispatch({ type: "clip/set-property", payload: { clipId: "tx", crop: half } })).toThrow(CommandRejectedError);
  });

  it("a split keeps the crop on both halves, and the document round-trips", () => {
    const p = withImage();
    p.dispatch({ type: "clip/set-property", payload: { clipId: "c", crop: half } });
    p.dispatch({ type: "clip/split", payload: { clipId: "c", atUs: 500_000, newClipId: "c2" } });
    expect((p.getState().doc.clips["c2"] as { crop?: unknown }).crop).toEqual(half);
    const again = createProject(JSON.parse(JSON.stringify(p.toJSON())));
    expect((again.getState().doc.clips["c"] as { crop?: unknown }).crop).toEqual(half);
  });
});

describe("text decoration (outline, shadow / glow on text clips)", () => {
  function withText() {
    const project = createProject({ width: 1920, height: 1080, fps: 30 });
    project.dispatch({ type: "track/add", payload: { id: "t1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "text", id: "c", trackId: "t1", startUs: 0, durationUs: 1_000_000, text: "Hi" },
    });
    return project;
  }
  const clip = (p: ReturnType<typeof withText>) => p.getState().doc.clips["c"]! as Record<string, unknown>;

  it("sets and clears each field, one undo step; documents stay minimal", () => {
    const p = withText();
    for (const k of ["strokeColor", "strokeWidthFrac", "shadowColor", "shadowBlurFrac", "shadowOffsetFrac"])
      expect(clip(p)).not.toHaveProperty(k);
    p.clearHistory();
    p.dispatch({
      type: "clip/set-property",
      payload: { clipId: "c", shadowColor: "#000000", shadowBlurFrac: 0.3, shadowOffsetFrac: 0, strokeColor: "#ff0000", strokeWidthFrac: 0.1 },
    });
    expect(clip(p)).toMatchObject({ shadowColor: "#000000", shadowBlurFrac: 0.3, shadowOffsetFrac: 0, strokeColor: "#ff0000", strokeWidthFrac: 0.1 });
    p.undo();
    expect(clip(p)).not.toHaveProperty("shadowColor");
    expect(p.canUndo()).toBe(false);
    p.redo();
    p.dispatch({
      type: "clip/set-property",
      payload: { clipId: "c", shadowColor: null, shadowBlurFrac: null, shadowOffsetFrac: null, strokeColor: null, strokeWidthFrac: null },
    });
    for (const k of ["strokeColor", "strokeWidthFrac", "shadowColor", "shadowBlurFrac", "shadowOffsetFrac"])
      expect(clip(p)).not.toHaveProperty(k);
  });

  it("can be given when the clip is added", () => {
    const p = withText();
    p.dispatch({
      type: "clip/add",
      payload: { kind: "text", id: "d", trackId: "t1", startUs: 0, durationUs: 1_000_000, text: "x", strokeColor: "#fff", strokeWidthFrac: 0.05 },
    });
    expect(p.getState().doc.clips["d"]).toMatchObject({ strokeColor: "#fff", strokeWidthFrac: 0.05 });
  });

  it("rejects out-of-range sizes and non-text clips", () => {
    const p = withText();
    expect(() =>
      p.dispatch({ type: "clip/set-property", payload: { clipId: "c", strokeWidthFrac: 0.9 } }),
    ).toThrow();
    expect(() =>
      p.dispatch({ type: "clip/set-property", payload: { clipId: "c", shadowOffsetFrac: -1 } }),
    ).toThrow();
    p.dispatch({ type: "asset/add", payload: { id: "img", kind: "image", src: "/a.png" } });
    p.dispatch({
      type: "clip/add",
      payload: { kind: "image", id: "i", trackId: "t1", assetId: "img", startUs: 0, durationUs: 1_000_000 },
    });
    expect(() =>
      p.dispatch({ type: "clip/set-property", payload: { clipId: "i", shadowColor: "#000" } }),
    ).toThrow(/not-text|only applies to text/);
  });
});
