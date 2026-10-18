import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createProject } from "../src/engine.js";
import {
  clipKindRegistration,
  effectParamsSchema,
  registerClipKind,
  registerEffectKind,
  registerTransitionKind,
  transitionParamsSchema,
  unregisterClipKind,
  unregisterEffectKind,
  unregisterTransitionKind,
} from "../src/registry.js";
import { definePlugin, documentPlugins, pluginFromModule, trackedCorePluginApi, unregisterPluginKinds } from "../src/plugins.js";

describe("registries: idempotent, replaceable, unregisterable", () => {
  it("same definition again is a no-op; a different one throws unless replace", () => {
    const schema = z.object({ a: z.number().default(1) });
    registerEffectKind("t/idem", schema);
    expect(() => registerEffectKind("t/idem", schema)).not.toThrow();
    expect(() => registerEffectKind("t/idem", z.object({}))).toThrow(/already registered/);
    const next = z.object({ b: z.number().default(2) });
    registerEffectKind("t/idem", next, { replace: true });
    expect(effectParamsSchema("t/idem")).toBe(next);
    expect(unregisterEffectKind("t/idem")).toBe(true);
    expect(unregisterEffectKind("t/idem")).toBe(false);
  });

  it("built-ins can't be replaced or removed", () => {
    expect(() => registerEffectKind("blur", z.object({}), { replace: true })).toThrow(/built-in/);
    expect(() => unregisterEffectKind("blur")).toThrow(/built-in/);
    expect(() => registerTransitionKind("wipe", z.object({}), { replace: true })).toThrow(/built-in/);
    expect(() => unregisterTransitionKind("wipe")).toThrow(/built-in/);
    expect(() => registerClipKind("video", { propsSchema: z.object({}), trackKinds: ["video"] })).toThrow(/built-in/);
    expect(() => unregisterClipKind("text")).toThrow(/built-in/);
  });

  it("clip and transition kinds behave the same", () => {
    const reg = { propsSchema: z.object({}), trackKinds: ["video"] as const };
    registerClipKind("t/clip", reg);
    registerClipKind("t/clip", reg);
    expect(clipKindRegistration("t/clip")).toBe(reg);
    unregisterClipKind("t/clip");
    const ts = z.object({});
    registerTransitionKind("t/tr", ts);
    registerTransitionKind("t/tr", ts);
    expect(transitionParamsSchema("t/tr")).toBe(ts);
    unregisterTransitionKind("t/tr");
  });
});

describe("plugin manifest and contract", () => {
  it("plugin/add / plugin/remove keep a minimal manifest and reject duplicates", () => {
    const p = createProject({ width: 640, height: 360, fps: 30 });
    expect("plugins" in p.getState().doc).toBe(false);
    p.dispatch({ type: "plugin/add", payload: { name: "@acme/charts", version: "1.0.0", url: "https://cdn.acme.test/charts.mjs" } });
    expect(documentPlugins(p.getState().doc)).toEqual([{ name: "@acme/charts", version: "1.0.0", url: "https://cdn.acme.test/charts.mjs" }]);
    expect(() =>
      p.dispatch({ type: "plugin/add", payload: { name: "@acme/charts", version: "1.1.0", url: "x" } }),
    ).toThrow(/duplicate-plugin/);
    p.dispatch({ type: "plugin/add", payload: { name: "@acme/charts", version: "1.1.0", url: "https://cdn.acme.test/charts@1.1.mjs", integrity: "sha384-abc=", replace: true } });
    expect(p.getState().doc.plugins).toHaveLength(1);
    expect(p.getState().doc.plugins![0]!.version).toBe("1.1.0");
    expect(() => p.dispatch({ type: "plugin/add", payload: { name: "x", version: "1", url: "y", integrity: "md5-zz" } })).toThrow();
    p.dispatch({ type: "plugin/remove", payload: { name: "@acme/charts" } });
    expect("plugins" in p.getState().doc).toBe(false);
    expect(() => p.dispatch({ type: "plugin/remove", payload: { name: "@acme/charts" } })).toThrow(/plugin-not-found/);
  });

  it("a tracked core API records and undoes a plugin's registrations", async () => {
    const plugin = definePlugin({
      name: "p",
      register({ z: zz, core }) {
        core.registerEffectKind("p/glow", zz.object({}));
        core.registerClipKind("p/chart", { propsSchema: zz.object({}), trackKinds: ["video"] });
      },
    });
    const ref = { name: "p", version: "1", url: "u" };
    const resolved = pluginFromModule({ default: plugin }, ref);
    const tracked = trackedCorePluginApi();
    await resolved.register({ environment: "node", z, core: tracked.api });
    expect(tracked.registrations).toEqual({ clipKinds: ["p/chart"], effectKinds: ["p/glow"], transitionKinds: [] });
    unregisterPluginKinds(tracked.registrations);
    expect(effectParamsSchema("p/glow")).toBeUndefined();
    expect(() => pluginFromModule({ nope: 1 }, ref)).toThrow(/register/);
  });
});
