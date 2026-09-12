import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import {
  blurStrengthPx,
  chromaKeyUniforms,
  colorAdjustSteps,
  hexToRgbNorm,
  rgbToChroma,
} from "../src/effects/params.js";
import { Compositor } from "../src/compositor/compositor.js";
import { FakeBackend } from "./scene-fakes.js";

describe("effect param math (pure)", () => {
  it("colorAdjust maps -1..1 onto Pixi's multiplier conventions", () => {
    expect(colorAdjustSteps({})).toEqual({ brightness: 1, contrast: 0, saturation: 0, hueDeg: 0 });
    expect(colorAdjustSteps({ brightness: -1 }).brightness).toBe(0); // black
    expect(colorAdjustSteps({ brightness: 1 }).brightness).toBe(2);
    expect(colorAdjustSteps({ hue: 999 }).hueDeg).toBe(180); // clamped
  });

  it("blur is resolution-independent: px scales with composition height", () => {
    expect(blurStrengthPx({ amount: 0.02 }, 720)).toBeCloseTo(14.4, 6);
    expect(blurStrengthPx({ amount: 0.02 }, 2160)).toBeCloseTo(43.2, 6); // same LOOK at 4K
    expect(blurStrengthPx({ amount: 99 }, 720)).toBeCloseTo(0.25 * 720, 6); // clamped
  });

  it("chroma key reduces the key color to its chroma vector; green keys green", () => {
    expect(hexToRgbNorm("#00ff00")).toEqual([0, 1, 0]);
    expect(hexToRgbNorm("nonsense")).toEqual([0, 1, 0]); // safe fallback
    const uniforms = chromaKeyUniforms({ color: "#00ff00", similarity: 0.4 });
    // A pure green pixel sits AT the key chroma → distance 0 → keyed out.
    const [cb, cr] = rgbToChroma(0, 1, 0);
    expect(Math.hypot(cb - uniforms.keyChroma[0], cr - uniforms.keyChroma[1])).toBeCloseTo(0, 6);
    // A red pixel is far away in chroma → kept.
    const [rb, rr] = rgbToChroma(1, 0, 0);
    expect(Math.hypot(rb - uniforms.keyChroma[0], rr - uniforms.keyChroma[1])).toBeGreaterThan(
      uniforms.similarity + uniforms.smoothness,
    );
  });
});

describe("compositor → node effect wiring", () => {
  function setup() {
    const project = createProject({ width: 1280, height: 720, fps: 30 });
    project.transaction(() => {
      project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
      project.dispatch({
        type: "clip/add",
        payload: { kind: "text", id: "t", trackId: "v1", startUs: 0, durationUs: 2_000_000, text: "x" },
      });
    });
    const backend = new FakeBackend();
    const compositor = new Compositor(project, backend);
    return { project, backend, compositor };
  }

  it("passes the stack on add/update/reorder/remove, in array order", () => {
    const { project, backend } = setup();
    const node = backend.nodes[0]!;
    expect(node.effects).toEqual([]); // synced at creation

    project.dispatch({ type: "effect/add", payload: { clipId: "t", kind: "blur", effectId: "b" } });
    project.dispatch({ type: "effect/add", payload: { clipId: "t", kind: "colorAdjust", effectId: "c" } });
    expect(node.effects!.map((e) => (e as { id: string }).id)).toEqual(["b", "c"]);

    project.dispatch({ type: "effect/update", payload: { clipId: "t", effectId: "b", params: { amount: 0.1 } } });
    expect((node.effects![0] as { params: { amount: number } }).params.amount).toBe(0.1);

    project.dispatch({ type: "effect/reorder", payload: { clipId: "t", effectId: "b", index: 1 } });
    expect(node.effects!.map((e) => (e as { id: string }).id)).toEqual(["c", "b"]);

    project.dispatch({ type: "effect/remove", payload: { clipId: "t", effectId: "b" } });
    project.dispatch({ type: "effect/remove", payload: { clipId: "t", effectId: "c" } });
    expect(node.effects).toEqual([]);
  });

  it("disabled state rides along (the backend decides to skip it)", () => {
    const { project, backend } = setup();
    project.dispatch({ type: "effect/add", payload: { clipId: "t", kind: "blur", effectId: "b", enabled: false } });
    expect((backend.nodes[0]!.effects![0] as { enabled: boolean }).enabled).toBe(false);
  });

  it("undo restores the previous stack on the node", () => {
    const { project, backend } = setup();
    project.dispatch({ type: "effect/add", payload: { clipId: "t", kind: "chromaKey", effectId: "k" } });
    expect(backend.nodes[0]!.effects!.length).toBe(1);
    project.undo();
    expect(backend.nodes[0]!.effects).toEqual([]);
  });
});
