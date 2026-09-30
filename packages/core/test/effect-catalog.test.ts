import { describe, expect, it } from "vitest";
import {
  EFFECT_CATALOG,
  EFFECT_CATEGORIES,
  builtinEffectParamSchemas,
  commandCatalog,
  createProject,
  defaultEffectParams,
  effectParamsSchema,
  getEffectInfo,
  toToolDefinitions,
  type ProjectDocument,
} from "../src/index.js";

function setup() {
  const project = createProject({ width: 1080, height: 1920, fps: 30 });
  project.transaction(() => {
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "text", id: "t", trackId: "v1", startUs: 0, durationUs: 1_000_000, text: "x" },
    });
  });
  return project;
}
const effects = (doc: ProjectDocument) => doc.clips["t"]!.effects ?? [];

describe("effect library catalog", () => {
  it("is large, unique, and every kind has a schema and a known category", () => {
    expect(EFFECT_CATALOG.length).toBeGreaterThanOrEqual(75);
    const kinds = EFFECT_CATALOG.map((e) => e.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    const cats = new Set(EFFECT_CATEGORIES.map((c) => c.id));
    for (const info of EFFECT_CATALOG) {
      expect(effectParamsSchema(info.kind), info.kind).toBeDefined();
      expect(cats.has(info.category), info.kind).toBe(true);
      expect(getEffectInfo(info.kind)).toBe(info);
    }
  });

  it("params are well-formed: defaults in range, colors are #rrggbb", () => {
    for (const info of EFFECT_CATALOG) {
      const keys = info.params.map((p) => p.key);
      expect(new Set(keys).size, info.kind).toBe(keys.length);
      for (const p of info.params) {
        if (p.type === "color") expect(p.default, `${info.kind}.${p.key}`).toMatch(/^#[0-9a-fA-F]{6}$/);
        else {
          expect(p.min, `${info.kind}.${p.key}`).toBeLessThanOrEqual(p.default);
          expect(p.default, `${info.kind}.${p.key}`).toBeLessThanOrEqual(p.max);
          expect(p.step).toBeGreaterThan(0);
        }
      }
    }
  });

  it("the catalog matches the hand-written built-in schemas' defaults", () => {
    for (const kind of Object.keys(builtinEffectParamSchemas)) {
      const parsed = effectParamsSchema(kind)!.parse({});
      expect(parsed, kind).toEqual(defaultEffectParams(kind));
    }
  });

  it("every kind adds with defaults filled in, updates, and rejects out-of-range params", () => {
    const project = setup();
    for (const info of EFFECT_CATALOG) {
      project.dispatch({ type: "effect/add", payload: { clipId: "t", kind: info.kind, effectId: info.kind } });
      const added = effects(project.toJSON()).find((e) => e.id === info.kind)!;
      expect(added.params, info.kind).toEqual(defaultEffectParams(info.kind));
    }
    expect(effects(project.toJSON())).toHaveLength(EFFECT_CATALOG.length);

    project.dispatch({ type: "effect/update", payload: { clipId: "t", effectId: "vignette", params: { intensity: 0.2 } } });
    expect(effects(project.toJSON()).find((e) => e.id === "vignette")!.params).toMatchObject({ intensity: 0.2, size: 0.5 });
    expect(() =>
      project.dispatch({ type: "effect/update", payload: { clipId: "t", effectId: "vignette", params: { intensity: 2 } } }),
    ).toThrow();
    expect(() =>
      project.dispatch({ type: "effect/update", payload: { clipId: "t", effectId: "duotone", params: { shadow: "red" } } }),
    ).toThrow();
    expect(() =>
      project.dispatch({ type: "effect/update", payload: { clipId: "t", effectId: "posterize", params: { levels: 3.5 } } }),
    ).toThrow(); // int params stay ints
  });

  it("length params are fractions of composition height", () => {
    const lengths = EFFECT_CATALOG.flatMap((e) => e.params.filter((p) => p.type === "number" && p.length));
    expect(lengths.length).toBeGreaterThan(10);
    for (const p of lengths) if (p.type === "number") expect(p.max).toBeLessThanOrEqual(0.25);
  });

  it("the AI tool for effect/add names the built-in kinds", () => {
    const tools = toToolDefinitions(commandCatalog()) as { name: string; description: string }[];
    const add = tools.find((t) => t.name === "effect_add")!;
    for (const kind of ["colorAdjust", "chromaKey", "sepia", "vignette", "kaleidoscope"]) expect(add.description).toContain(kind);
  });
});
