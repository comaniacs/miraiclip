import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createProject } from "../src/engine.js";
import { registerClipKind, registerEffectKind } from "../src/registry.js";
import { commandCatalog } from "../src/commands/schemas.js";
import type { CaptionClip, Transition, VideoClip } from "../src/types.js";

/** Two adjacent video clips with generous source headroom on both sides. */
function setup() {
  const project = createProject({ width: 1280, height: 720, fps: 30 });
  project.transaction(() => {
    project.dispatch({
      type: "asset/add",
      payload: { id: "a", kind: "video", src: "x.mp4", durationUs: 60_000_000 },
    });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "video", id: "left", trackId: "v1", assetId: "a", startUs: 0, durationUs: 5_000_000, trimStartUs: 2_000_000 },
    });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "video", id: "right", trackId: "v1", assetId: "a", startUs: 5_000_000, durationUs: 5_000_000, trimStartUs: 20_000_000 },
    });
  });
  return project;
}

describe("effects", () => {
  it("effect/add validates params against the kind's schema and applies defaults", () => {
    const project = setup();
    project.dispatch({
      type: "effect/add",
      payload: { clipId: "left", kind: "chromaKey", effectId: "fx1", params: { similarity: 0.6 } },
    });
    const clip = project.getState().doc.clips["left"]!;
    expect(clip.effects![0]).toMatchObject({
      id: "fx1",
      kind: "chromaKey",
      enabled: true,
      params: { color: "#00ff00", similarity: 0.6, smoothness: 0.1, spill: 0.1 },
    });
    expect(() =>
      project.dispatch({ type: "effect/add", payload: { clipId: "left", kind: "nope" } }),
    ).toThrow(/unknown-kind|no registered effect/);
    expect(() =>
      project.dispatch({
        type: "effect/add",
        payload: { clipId: "left", kind: "blur", params: { amount: 9 } },
      }),
    ).toThrow(/invalid blur params/);
  });

  it("effect/update merges then re-validates; remove and reorder keep the stack sane", () => {
    const project = setup();
    project.dispatch({ type: "effect/add", payload: { clipId: "left", kind: "blur", effectId: "b" } });
    project.dispatch({ type: "effect/add", payload: { clipId: "left", kind: "colorAdjust", effectId: "c" } });
    project.dispatch({ type: "effect/update", payload: { clipId: "left", effectId: "b", params: { amount: 0.1 }, enabled: false } });
    let effects = project.getState().doc.clips["left"]!.effects!;
    expect(effects[0]).toMatchObject({ id: "b", enabled: false, params: { amount: 0.1 } });
    expect(() =>
      project.dispatch({ type: "effect/update", payload: { clipId: "left", effectId: "b", params: { amount: -1 } } }),
    ).toThrow(/invalid blur params/);
    project.dispatch({ type: "effect/reorder", payload: { clipId: "left", effectId: "b", index: 1 } });
    effects = project.getState().doc.clips["left"]!.effects!;
    expect(effects.map((e) => e.id)).toEqual(["c", "b"]);
    project.dispatch({ type: "effect/remove", payload: { clipId: "left", effectId: "b" } });
    project.dispatch({ type: "effect/remove", payload: { clipId: "left", effectId: "c" } });
    expect(project.getState().doc.clips["left"]!.effects).toBeUndefined();
  });

  it("registerEffectKind makes a custom kind dispatchable", () => {
    registerEffectKind("test/pixelate", z.object({ size: z.number().min(0).max(1).default(0.05) }));
    const project = setup();
    project.dispatch({ type: "effect/add", payload: { clipId: "left", kind: "test/pixelate" } });
    expect(project.getState().doc.clips["left"]!.effects![0]!.params).toEqual({ size: 0.05 });
  });
});

describe("transitions", () => {
  it("transition/add validates adjacency, headroom, and one-per-boundary", () => {
    const project = setup();
    project.dispatch({
      type: "transition/add",
      payload: { id: "tr", kind: "crossDissolve", fromClipId: "left", toClipId: "right", durationUs: 1_000_000 },
    });
    const transition = project.getState().doc.transitions["tr"] as Transition;
    expect(transition).toMatchObject({ trackId: "v1", alignment: "centered", kind: "crossDissolve" });
    expect(() =>
      project.dispatch({
        type: "transition/add",
        payload: { kind: "crossDissolve", fromClipId: "left", toClipId: "right", durationUs: 500_000 },
      }),
    ).toThrow(/duplicate-boundary|already has/);
    expect(() =>
      project.dispatch({
        type: "transition/add",
        payload: { kind: "crossDissolve", fromClipId: "right", toClipId: "left", durationUs: 500_000 },
      }),
    ).toThrow(/not-adjacent|must start exactly/);
  });

  it("insufficient trim headroom is rejected with a fix hint", () => {
    const project = setup();
    // "right" has trimStartUs 20s in a 60s asset; "left" ends at source 7s.
    // Left's OUT headroom = 60 - 7 = 53s (fine). Make a clip with zero in-headroom:
    project.transaction(() => {
      project.dispatch({
        type: "clip/add",
        payload: { kind: "video", id: "third", trackId: "v1", assetId: "a", startUs: 10_000_000, durationUs: 5_000_000, trimStartUs: 0 },
      });
    });
    expect(() =>
      project.dispatch({
        type: "transition/add",
        payload: { kind: "wipe", fromClipId: "right", toClipId: "third", durationUs: 1_000_000 },
      }),
    ).toThrow(/insufficient-handles|no source media before/);
  });

  it("editing or removing a participating clip drops the transition", () => {
    const project = setup();
    project.dispatch({
      type: "transition/add",
      payload: { id: "tr", kind: "slide", fromClipId: "left", toClipId: "right", durationUs: 600_000 },
    });
    project.dispatch({ type: "clip/move", payload: { clipId: "right", startUs: 6_000_000 } });
    expect(project.getState().doc.transitions["tr"]).toBeUndefined();
  });

  it("transition/update re-validates duration and params; remove deletes", () => {
    const project = setup();
    project.dispatch({
      type: "transition/add",
      payload: { id: "tr", kind: "wipe", fromClipId: "left", toClipId: "right", durationUs: 600_000 },
    });
    project.dispatch({ type: "transition/update", payload: { transitionId: "tr", params: { direction: "up" } } });
    expect(project.getState().doc.transitions["tr"]!.params).toEqual({ direction: "up" });
    expect(() =>
      project.dispatch({ type: "transition/update", payload: { transitionId: "tr", params: { direction: "diagonal" } } }),
    ).toThrow(/invalid wipe params/);
    project.dispatch({ type: "transition/remove", payload: { transitionId: "tr" } });
    expect(project.getState().doc.transitions["tr"]).toBeUndefined();
  });
});

describe("caption clips, font assets, custom kinds", () => {
  it("clip/add caption applies style defaults; clip/set-property merges style", () => {
    const project = setup();
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "caption", id: "cap", trackId: "v1", startUs: 0, durationUs: 2_000_000,
        words: [{ text: "hello", startUs: 0, durationUs: 1_000_000 }],
      },
    });
    let caption = project.getState().doc.clips["cap"] as CaptionClip;
    expect(caption.style).toMatchObject({ preset: "highlight", fontSizeFrac: 0.06, color: "#ffffff" });
    project.dispatch({ type: "clip/set-property", payload: { clipId: "cap", style: { preset: "karaoke" } } });
    caption = project.getState().doc.clips["cap"] as CaptionClip;
    expect(caption.style.preset).toBe("karaoke");
    expect(() =>
      project.dispatch({ type: "clip/set-property", payload: { clipId: "left", style: { preset: "pop" } } }),
    ).toThrow(/not-caption|only applies to caption/);
  });

  it("font assets require a family; clip/add rejects asset-kind mismatches", () => {
    const project = setup();
    expect(() =>
      project.dispatch({ type: "asset/add", payload: { id: "f", kind: "font", src: "brand.woff2" } }),
    ).toThrow(/font-needs-family|family/);
    project.dispatch({
      type: "asset/add",
      payload: { id: "f", kind: "font", src: "brand.woff2", family: "Brand Sans" },
    });
    expect(project.getState().doc.assets["f"]!.family).toBe("Brand Sans");
    expect(() =>
      project.dispatch({
        type: "clip/add",
        payload: { kind: "video", id: "bad", trackId: "v1", assetId: "f", startUs: 0, durationUs: 1_000 },
      }),
    ).toThrow(/asset-kind-mismatch|is font, not video/);
  });

  it("registerClipKind enables custom kinds with validated props and track gating", () => {
    registerClipKind("test/counter", {
      propsSchema: z.object({ from: z.number().default(0), to: z.number() }),
      trackKinds: ["video"],
    });
    const project = setup();
    project.dispatch({
      type: "clip/add",
      payload: { kind: "test/counter", id: "n", trackId: "v1", startUs: 0, durationUs: 1_000_000, props: { to: 10 } },
    });
    const clip = project.getState().doc.clips["n"]!;
    expect(clip).toMatchObject({ kind: "test/counter", props: { from: 0, to: 10 } });
    expect(() =>
      project.dispatch({
        type: "clip/add",
        payload: { kind: "test/unregistered", id: "u", trackId: "v1", startUs: 0, durationUs: 1_000 },
      }),
    ).toThrow(/unknown-kind|no registered clip kind/);
    expect(() =>
      project.dispatch({
        type: "clip/add",
        payload: { kind: "test/counter", id: "bad", trackId: "v1", startUs: 0, durationUs: 1_000, props: {} },
      }),
    ).toThrow(/invalid test\/counter props/);
  });

  it("old documents hydrate with an empty transitions map", () => {
    const project = setup();
    const doc = JSON.parse(JSON.stringify(project.getState().doc));
    delete doc.transitions; // a document serialized before v4
    const rehydrated = createProject(doc);
    expect(rehydrated.getState().doc.transitions).toEqual({});
  });

  it("the AI command catalog includes every v4 command", () => {
    const catalog = commandCatalog();
    for (const type of ["keyframe/set", "effect/add", "transition/add"]) {
      expect(catalog[type], type).toBeDefined();
    }
  });
});
