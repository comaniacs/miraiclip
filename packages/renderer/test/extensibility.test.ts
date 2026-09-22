/**
 * The public extensibility surface: registerEffectRenderer and
 * registerTransitionRenderer. Custom kinds registered through the same
 * contract the built-ins use render through the real compositor path here
 * (FakeBackend), exactly as the built-in transition tests do.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createProject,
  registerEffectKind,
  registerTransitionKind,
  type Project,
} from "@miraiclip/core";
import { Compositor } from "../src/compositor/compositor.js";
import {
  getEffectRenderer,
  registerEffectRenderer,
  type ActiveEffect,
} from "../src/effects/pixi-effects.js";
import {
  getTransitionRenderer,
  registerTransitionRenderer,
} from "../src/transitions/registry.js";
import { rendersBothClips } from "../src/transitions/timing.js";
import { FakeBackend } from "./scene-fakes.js";

const SEC = 1_000_000;

function imageProject(): Project {
  const project = createProject({ width: 1000, height: 500, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "asset/add", payload: { id: "img", kind: "image", src: "/a.png" } });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "image", id: "a", trackId: "v1", assetId: "img", startUs: 0, durationUs: 2 * SEC },
    });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "image", id: "b", trackId: "v1", assetId: "img", startUs: 2 * SEC, durationUs: 2 * SEC },
    });
  });
  return project;
}

// Module-global registries: register each custom kind ONCE for the whole file.
registerTransitionKind("test/flash", z.object({ color: z.number().int().default(0xffffff) }));
registerTransitionRenderer("test/flash", {
  rendersBothClips: false,
  frame: (role, progress, params) =>
    role === "from"
      ? {
          overlay: {
            color: (params?.["color"] as number | undefined) ?? 0xffffff,
            alpha: 1 - Math.abs(2 * progress - 1),
          },
        }
      : null,
});

registerTransitionKind("test/fadePush", z.object({}));
registerTransitionRenderer("test/fadePush", {
  rendersBothClips: true,
  frame: (role, progress, _params, context) =>
    role === "to"
      ? { opacity: progress, offsetXPx: (1 - progress) * context.compositionSize.width * 0.5 }
      : null,
});

registerTransitionKind("test/mystery", z.object({})); // valid in commands, NO renderer

describe("registerTransitionRenderer", () => {
  it("rejects duplicate kinds (built-ins included)", () => {
    expect(() => registerTransitionRenderer("crossDissolve", getTransitionRenderer("wipe")!)).toThrow(
      /already registered/,
    );
    expect(() => registerTransitionRenderer("test/flash", getTransitionRenderer("wipe")!)).toThrow(
      /already registered/,
    );
  });

  it("rendersBothClips is answered by the registered renderer", () => {
    expect(rendersBothClips("test/fadePush")).toBe(true);
    expect(rendersBothClips("test/flash")).toBe(false);
    expect(rendersBothClips("test/unregistered")).toBe(false);
  });

  it("a custom overlay transition drives the compositor's overlay", () => {
    const project = imageProject();
    project.dispatch({
      type: "transition/add",
      payload: {
        id: "t1", kind: "test/flash", fromClipId: "a", toClipId: "b",
        durationUs: SEC, params: { color: 0x123456 },
      },
    });
    const backend = new FakeBackend();
    const compositor = new Compositor(project, backend);

    compositor.renderAt(2 * SEC); // the cut: overlay fully opaque
    const overlay = backend.solids[0]!;
    expect(overlay.visible).toBe(true);
    expect(overlay.colorRgb).toBe(0x123456);
    expect(overlay.alpha).toBe(1);

    compositor.renderAt(3 * SEC); // window over
    expect(overlay.visible).toBe(false);
    compositor.destroy();
  });

  it("a custom blend transition drives opacity and offset through the window", () => {
    const project = imageProject();
    project.dispatch({
      type: "transition/add",
      payload: { id: "t1", kind: "test/fadePush", fromClipId: "a", toClipId: "b", durationUs: SEC },
    });
    const backend = new FakeBackend();
    const compositor = new Compositor(project, backend);
    const a = backend.nodes[0]!;
    const b = backend.nodes[1]!;

    compositor.renderAt(1_750_000); // p = 0.25
    expect(a.visible).toBe(true); // outgoing renders through the window
    expect(b.visible).toBe(true); // incoming starts early
    expect(b.placement!.opacity).toBeCloseTo(0.25, 6);
    const baseXPx = 500; // centered in the 1000px composition
    expect(b.placement!.xPx).toBeCloseTo(baseXPx + 0.75 * 1000 * 0.5, 3);

    compositor.renderAt(2_600_000); // after the window: adjustments cleared
    expect(a.visible).toBe(false);
    expect(b.placement!.opacity).toBe(1);
    expect(b.placement!.xPx).toBeCloseTo(baseXPx, 3);
    compositor.destroy();
  });

  it("a kind without a renderer draws as a hard cut (no throw, no extension)", () => {
    const project = imageProject();
    project.dispatch({
      type: "transition/add",
      payload: { id: "t1", kind: "test/mystery", fromClipId: "a", toClipId: "b", durationUs: SEC },
    });
    const backend = new FakeBackend();
    const compositor = new Compositor(project, backend);
    const a = backend.nodes[0]!;
    const b = backend.nodes[1]!;

    compositor.renderAt(1_900_000); // just before the cut
    expect(a.visible).toBe(true);
    expect(b.visible).toBe(false);
    compositor.renderAt(2_100_000); // just after
    expect(a.visible).toBe(false);
    expect(b.visible).toBe(true);
    compositor.destroy();
  });
});

describe("registerEffectRenderer", () => {
  it("registers a custom kind, rejects duplicates (built-ins included)", () => {
    const factory = (params: Record<string, unknown>): ActiveEffect => {
      const state = { ...params };
      return {
        kind: "test/pixelate",
        filter: { destroy: () => undefined } as unknown as ActiveEffect["filter"],
        update: (p) => Object.assign(state, p),
      };
    };
    registerEffectRenderer("test/pixelate", factory);
    expect(getEffectRenderer("test/pixelate")).toBe(factory);
    expect(() => registerEffectRenderer("test/pixelate", factory)).toThrow(/already registered/);
    expect(() => registerEffectRenderer("blur", factory)).toThrow(/already registered/);
  });

  it("a registered custom kind flows through commands to the clip's node", () => {
    registerEffectKind("test/pixelate", z.object({ size: z.number().min(1).default(8) }));
    const project = imageProject();
    project.dispatch({
      type: "effect/add",
      payload: { clipId: "a", kind: "test/pixelate", effectId: "px", params: { size: 12 } },
    });
    const backend = new FakeBackend();
    const compositor = new Compositor(project, backend);
    const effect = backend.nodes[0]!.effects![0] as {
      kind: string;
      params: { size: number };
    };
    expect(effect.kind).toBe("test/pixelate");
    expect(effect.params.size).toBe(12);

    // Invalid params are rejected by the kind's registered schema.
    expect(() =>
      project.dispatch({
        type: "effect/update",
        payload: { clipId: "a", effectId: "px", params: { size: 0 } },
      }),
    ).toThrow();
    compositor.destroy();
  });
});
