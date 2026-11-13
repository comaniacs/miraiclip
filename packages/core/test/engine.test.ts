import { describe, expect, it } from "vitest";
import {
  CommandRejectedError,
  CommandValidationError,
  UnknownCommandError,
  applyJsonPatches,
  createProject,
  evaluateClipAt,
  frameToUs,
  snapToFrame,
  usToFrame,
  usToTimecode,
  type JsonPatchOp,
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

describe("clip/replace-asset", () => {
  function setup() {
    const p = createProject({ width: 1280, height: 720, fps: 30 });
    const asset = (id: string, kind: "video" | "image" | "audio", durationUs?: number) =>
      p.dispatch({ type: "asset/add", payload: { id, kind, src: `/${id}`, ...(durationUs ? { durationUs } : {}) } });
    asset("v1", "video", 10_000_000);
    asset("v2", "video", 20_000_000);
    asset("short", "video", 2_000_000);
    asset("i1", "image");
    asset("i2", "image");
    p.dispatch({ type: "track/add", payload: { id: "t", kind: "video" } });
    p.dispatch({
      type: "clip/add",
      payload: { kind: "video", id: "v", trackId: "t", assetId: "v1", startUs: 0, durationUs: 4_000_000, trimStartUs: 3_000_000, volume: 0.5, crop: { x: 0, y: 0, width: 0.5, height: 1 }, transform: { scale: 2 } },
    });
    p.dispatch({ type: "clip/add", payload: { kind: "image", id: "i", trackId: "t", assetId: "i1", startUs: 4_000_000, durationUs: 2_000_000 } });
    p.dispatch({ type: "clip/add", payload: { kind: "text", id: "x", trackId: "t", startUs: 6_000_000, durationUs: 1_000_000, text: "x" } });
    p.dispatch({ type: "keyframe/set", payload: { clipId: "v", property: "opacity", timeUs: 0, value: 0 } });
    p.dispatch({ type: "effect/add", payload: { clipId: "v", kind: "blur" } });
    return p;
  }
  const clip = (p: ReturnType<typeof setup>, id: string) => p.getState().doc.clips[id]! as Record<string, unknown>;

  it("swaps the source and keeps place, transform, crop, keyframes and effects; one undo step", () => {
    const p = setup();
    const before = clip(p, "v");
    p.dispatch({ type: "clip/replace-asset", payload: { clipId: "v", assetId: "v2" } });
    const after = clip(p, "v");
    expect(after).toEqual({ ...before, assetId: "v2", trimStartUs: 0 }); // new footage from its start
    expect(after.animations).toBeDefined();
    expect(after.effects).toHaveLength(1);
    p.undo();
    expect(clip(p, "v")).toEqual(before);
    p.dispatch({ type: "clip/replace-asset", payload: { clipId: "v", assetId: "v2", trimStartUs: 5_000_000, crop: "reset" } });
    expect(clip(p, "v")).toMatchObject({ assetId: "v2", trimStartUs: 5_000_000 });
    expect(clip(p, "v")).not.toHaveProperty("crop");
    p.dispatch({ type: "clip/replace-asset", payload: { clipId: "i", assetId: "i2" } });
    expect(clip(p, "i")).toMatchObject({ assetId: "i2", startUs: 4_000_000, durationUs: 2_000_000 });
  });

  it("a source too short for the clip shortens it (and respects speed)", () => {
    const p = setup();
    p.dispatch({ type: "clip/replace-asset", payload: { clipId: "v", assetId: "short" } });
    expect(clip(p, "v")).toMatchObject({ assetId: "short", trimStartUs: 0, durationUs: 2_000_000, startUs: 0 });
    const q = setup();
    q.dispatch({ type: "clip/set-speed", payload: { clipId: "v", speed: 0.5, keepDuration: true } }); // 4 s of timeline = 2 s of source
    q.dispatch({ type: "clip/replace-asset", payload: { clipId: "v", assetId: "short" } });
    expect(clip(q, "v")).toMatchObject({ durationUs: 4_000_000 }); // 2 s of source still fills it
  });

  it("rejects a clip without a source, a missing or wrong-kind asset, and a trim past the end", () => {
    const p = setup();
    const run = (payload: Record<string, unknown>) => () => p.dispatch({ type: "clip/replace-asset", payload });
    expect(run({ clipId: "x", assetId: "i1" })).toThrow(/no-source/);
    expect(run({ clipId: "v", assetId: "nope" })).toThrow(/asset-not-found/);
    expect(run({ clipId: "v", assetId: "i1" })).toThrow(/asset-kind-mismatch/);
    expect(run({ clipId: "i", assetId: "i2", trimStartUs: 1 })).toThrow(/no-trim/);
    expect(run({ clipId: "v", assetId: "short", trimStartUs: 2_000_000 })).toThrow(/out-of-range/);
    expect(clip(p, "v")).toMatchObject({ assetId: "v1", trimStartUs: 3_000_000 });
  });
});

describe("track volume", () => {
  function withTrack() {
    const project = createProject({ width: 1280, height: 720, fps: 30 });
    project.dispatch({ type: "track/add", payload: { id: "a1", kind: "audio" } });
    return project;
  }
  const track = (p: ReturnType<typeof withTrack>) => p.getState().doc.tracks["a1"]!;

  it("is absent until set, stored when not 1, and cleared by 1; one undo step", () => {
    const p = withTrack();
    expect(track(p)).not.toHaveProperty("volume");
    p.dispatch({ type: "track/set-property", payload: { trackId: "a1", volume: 0.25 } });
    expect(track(p).volume).toBe(0.25);
    p.dispatch({ type: "track/set-property", payload: { trackId: "a1", volume: 1 } });
    expect(track(p)).not.toHaveProperty("volume");
    p.undo();
    expect(track(p).volume).toBe(0.25);
  });

  it("leaves the other track flags alone and rejects values outside 0..4", () => {
    const p = withTrack();
    p.dispatch({ type: "track/set-property", payload: { trackId: "a1", muted: true } });
    p.dispatch({ type: "track/set-property", payload: { trackId: "a1", volume: 2 } });
    expect(track(p)).toMatchObject({ muted: true, volume: 2 });
    expect(() => p.dispatch({ type: "track/set-property", payload: { trackId: "a1", volume: -0.1 } })).toThrow(CommandValidationError);
    expect(() => p.dispatch({ type: "track/set-property", payload: { trackId: "a1", volume: 4.5 } })).toThrow(CommandValidationError);
  });

  it("survives a save and load", () => {
    const p = withTrack();
    p.dispatch({ type: "track/set-property", payload: { trackId: "a1", volume: 0.6 } });
    const reloaded = createProject(JSON.parse(JSON.stringify(p.toJSON())));
    expect(reloaded.getState().doc.tracks["a1"]!.volume).toBe(0.6);
  });
});

describe("replaceDocument", () => {
  function base() {
    const p = createProject({ width: 1280, height: 720, fps: 30 });
    p.dispatch({ type: "track/add", payload: { id: "t1", kind: "video" } });
    p.dispatch({ type: "clip/add", payload: { kind: "text", id: "a", trackId: "t1", startUs: 0, durationUs: 1_000_000, text: "a" } });
    p.dispatch({ type: "clip/add", payload: { kind: "text", id: "b", trackId: "t1", startUs: 1_000_000, durationUs: 1_000_000, text: "b" } });
    return p;
  }
  /** Another version of the same document: resized, `a` edited, `b` removed, `c` added. */
  function other(p: ReturnType<typeof base>) {
    const peer = createProject(JSON.parse(JSON.stringify(p.toJSON())));
    peer.dispatch({ type: "project/set-settings", payload: { width: 720, height: 1280 } });
    peer.dispatch({ type: "clip/set-property", payload: { clipId: "a", text: "A!" } });
    peer.dispatch({ type: "clip/remove", payload: { clipId: "b" } });
    peer.dispatch({ type: "clip/add", payload: { kind: "text", id: "c", trackId: "t1", startUs: 3_000_000, durationUs: 1_000_000, text: "c" } });
    return peer.toJSON();
  }

  it("swaps the document and emits one patch per changed entity, with a working inverse", () => {
    const p = base();
    const before = p.toJSON();
    const events: { paths: string[]; source: string; inverse: JsonPatchOp[] }[] = [];
    p.events.on("patches", (e) => events.push({ paths: e.patches.map((o) => `${o.op} ${o.path}`), source: e.source, inverse: e.inverse }));
    const next = other(p);
    expect(p.replaceDocument(next)).toBe(true);
    expect(p.toJSON()).toEqual(next);
    expect(events).toHaveLength(1);
    expect(events[0]!.source).toBe("replace");
    expect(events[0]!.paths.sort()).toEqual(["add /clips/c", "remove /clips/b", "replace /clips/a", "replace /settings"]);
    expect(applyJsonPatches(next, events[0]!.inverse)).toEqual(before);
  });

  it("is not an edit: no history entry, stacks kept by default and dropped with history: clear", () => {
    const p = base();
    /** Undo steps available (counted by undoing them all, then redoing). */
    const depth = () => {
      let n = 0;
      while (p.undo()) n++;
      for (let i = 0; i < n; i++) p.redo();
      return n;
    };
    const had = depth();
    const same = JSON.parse(JSON.stringify(p.toJSON())) as ReturnType<typeof p.toJSON>;
    expect(p.replaceDocument(same)).toBe(false);
    const edited = JSON.parse(JSON.stringify(p.toJSON())) as ReturnType<typeof p.toJSON>;
    (edited.clips["a"] as { text: string }).text = "remote";
    expect(p.replaceDocument(edited)).toBe(true);
    expect(depth()).toBe(had);
    const again = JSON.parse(JSON.stringify(edited)) as typeof edited; // the project owns `edited` now
    (again.clips["a"] as { text: string }).text = "remote 2";
    p.replaceDocument(again, { history: "clear" });
    expect(p.canUndo()).toBe(false);
    expect(p.canRedo()).toBe(false);
  });

  it("ends an open gesture first and refuses to run inside a transaction", () => {
    const p = base();
    const gesture = p.beginGesture("drag");
    p.dispatch({ type: "clip/set-property", payload: { clipId: "a", text: "mid" } });
    const next = JSON.parse(JSON.stringify(p.toJSON())) as ReturnType<typeof p.toJSON>;
    (next.clips["b"] as { text: string }).text = "peer";
    p.replaceDocument(next);
    expect(p.inGesture()).toBe(false);
    gesture.end();
    expect((p.getState().doc.clips["b"] as { text: string }).text).toBe("peer");
    expect(() => p.transaction(() => p.replaceDocument(next))).toThrow(/transaction/);
  });
});
