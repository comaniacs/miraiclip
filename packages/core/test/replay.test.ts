import { describe, expect, it } from "vitest";
import {
  applyJsonPatches,
  createProject,
  frameToUs,
  type Command,
  type JsonPatchOp,
  type ProjectDocument,
} from "../src/index.js";

const SETTINGS = { width: 1920, height: 1080, fps: 30 };

/** An edit session covering every mutating command namespace. */
const SCRIPT: Command[] = [
  {
    type: "asset/add",
    payload: { id: "a1", kind: "video", src: "/a.mp4", durationUs: 10_000_000 },
  },
  { type: "asset/add", payload: { id: "a2", kind: "audio", src: "/a.mp3" } },
  { type: "track/add", payload: { id: "v1", kind: "video" } },
  { type: "track/add", payload: { id: "v2", kind: "video" } },
  { type: "track/add", payload: { id: "au1", kind: "audio", index: 0 } },
  {
    type: "clip/add",
    payload: {
      kind: "video",
      id: "c1",
      trackId: "v1",
      assetId: "a1",
      startUs: 0,
      durationUs: 6_000_000,
    },
  },
  {
    type: "clip/add",
    payload: {
      kind: "text",
      id: "t1",
      trackId: "v2",
      startUs: 500_000,
      durationUs: 2_000_000,
      text: "Hello",
    },
  },
  { type: "clip/split", payload: { clipId: "c1", atUs: 2_000_000, newClipId: "c1b" } },
  { type: "clip/move", payload: { clipId: "c1b", startUs: 3_000_000, trackId: "v2" } },
  { type: "clip/duplicate", payload: { clipId: "t1", newClipId: "t2", startUs: 4_000_000 } },
  { type: "clip/trim", payload: { clipId: "c1", durationUs: 1_500_000, trimStartUs: 250_000 } },
  { type: "clip/set-property", payload: { clipId: "t1", text: "World", color: "#ff0000" } },
  { type: "track/reorder", payload: { trackId: "v2", index: 0 } },
  { type: "track/set-property", payload: { trackId: "au1", muted: true } },
  { type: "project/set-settings", payload: { name: "Replay cut" } },
  { type: "clip/remove", payload: { clipId: "t2" } },
];

describe("determinism & collaboration", () => {
  it("replaying the same command script yields an identical document", () => {
    const a = createProject(SETTINGS);
    const b = createProject(SETTINGS);
    for (const command of SCRIPT) a.dispatch(command);
    for (const command of SCRIPT) b.dispatch(command);
    expect(b.toJSON()).toEqual(a.toJSON());
  });

  it("applying emitted patches to a follower reproduces the leader's document", () => {
    const leader = createProject(SETTINGS);
    let follower: ProjectDocument = createProject(SETTINGS).toJSON();
    leader.events.on("patches", ({ patches }) => {
      follower = applyJsonPatches(follower, patches);
    });
    for (const command of SCRIPT) leader.dispatch(command);
    expect(follower).toEqual(leader.toJSON());
  });

  it("applying inverse patches walks the follower back", () => {
    const leader = createProject(SETTINGS);
    const forward: JsonPatchOp[][] = [];
    const backward: JsonPatchOp[][] = [];
    leader.events.on("patches", ({ patches, inverse, source }) => {
      if (source !== "dispatch") return;
      forward.push(patches);
      backward.push(inverse);
    });
    const before = leader.toJSON();
    for (const command of SCRIPT) leader.dispatch(command);

    let doc: ProjectDocument = before;
    for (const ops of forward) doc = applyJsonPatches(doc, ops);
    expect(doc).toEqual(leader.toJSON());
    for (const ops of [...backward].reverse()) doc = applyJsonPatches(doc, ops);
    expect(doc).toEqual(before);
  });

  it("undo/redo round-trips the full script", () => {
    const project = createProject(SETTINGS);
    for (const command of SCRIPT) project.dispatch(command);
    const final = project.toJSON();
    while (project.undo()) {
      /* walk all the way back */
    }
    expect(project.toJSON()).toEqual(createProject(SETTINGS).toJSON());
    while (project.redo()) {
      /* and forward again */
    }
    expect(project.toJSON()).toEqual(final);
  });
});

describe("edge cases", () => {
  it("caps history at the configured limit", () => {
    const project = createProject(SETTINGS, { historyLimit: 3 });
    project.dispatch({ type: "track/add", payload: { id: "t0", kind: "video" } });
    for (let i = 1; i <= 5; i++) {
      project.dispatch({ type: "track/rename", payload: { trackId: "t0", name: `n${i}` } });
    }
    let undone = 0;
    while (project.undo()) undone++;
    expect(undone).toBe(3);
    // Oldest entries were evicted: track t0 still exists, at an earlier name.
    expect(project.getState().doc.tracks["t0"]?.name).toBe("n2");
  });

  it("splits exactly on a frame boundary without drift", () => {
    const fps = 30;
    const project = createProject({ width: 1920, height: 1080, fps });
    project.dispatch({
      type: "asset/add",
      payload: { id: "a", kind: "video", src: "/a.mp4", durationUs: 10_000_000 },
    });
    project.dispatch({ type: "track/add", payload: { id: "v", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "video",
        id: "c",
        trackId: "v",
        assetId: "a",
        startUs: 0,
        durationUs: frameToUs(90, fps), // exactly 3s
      },
    });
    const cut = frameToUs(45, fps);
    project.dispatch({ type: "clip/split", payload: { clipId: "c", atUs: cut, newClipId: "c2" } });
    const { doc } = project.getState();
    expect(doc.clips["c"]?.durationUs).toBe(cut);
    expect(doc.clips["c2"]?.startUs).toBe(cut);
    expect(
      (doc.clips["c"]?.durationUs ?? 0) + (doc.clips["c2"]?.durationUs ?? 0),
    ).toBe(frameToUs(90, fps));
  });

  it("rejects splitting exactly at clip edges", () => {
    const project = createProject(SETTINGS);
    project.dispatch({
      type: "asset/add",
      payload: { id: "a", kind: "video", src: "/a.mp4" },
    });
    project.dispatch({ type: "track/add", payload: { id: "v", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "video", id: "c", trackId: "v", assetId: "a", startUs: 1_000_000, durationUs: 2_000_000 },
    });
    expect(() =>
      project.dispatch({ type: "clip/split", payload: { clipId: "c", atUs: 1_000_000 } }),
    ).toThrow(/out-of-range/);
    expect(() =>
      project.dispatch({ type: "clip/split", payload: { clipId: "c", atUs: 3_000_000 } }),
    ).toThrow(/out-of-range/);
  });

  it("handles JSON Pointer escaping in entity ids", () => {
    const project = createProject(SETTINGS);
    const weirdId = "track/with~specials";
    project.dispatch({ type: "track/add", payload: { id: weirdId, kind: "video" } });
    let captured: JsonPatchOp[] = [];
    project.events.on("patches", ({ patches }) => (captured = patches));
    project.dispatch({ type: "track/rename", payload: { trackId: weirdId, name: "ok" } });
    expect(captured[0]?.path).toBe("/tracks/track~1with~0specials/name");
    const follower = applyJsonPatches(
      JSON.parse(JSON.stringify(project.toJSON())) as ProjectDocument,
      captured,
    );
    expect(follower.tracks[weirdId]?.name).toBe("ok");
  });
});
