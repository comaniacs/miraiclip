import { describe, expect, it } from "vitest";
import {
  TYPOGRAPHY_DEFAULTS,
  createProject,
  describeProject,
  type CaptionClip,
  type Project,
  type TextClip,
} from "../src/index.js";

function setup(): Project {
  const project = createProject({ width: 1280, height: 720, fps: 30 });
  project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
  return project;
}

const addText = (project: Project, extra: Record<string, unknown> = {}) =>
  project.dispatch({
    type: "clip/add",
    payload: { kind: "text", id: "t1", trackId: "v1", startUs: 0, durationUs: 1_000_000, text: "Hi", ...extra },
  } as never);

const addCaption = (project: Project, style: Record<string, unknown> = {}) =>
  project.dispatch({
    type: "clip/add",
    payload: {
      kind: "caption", id: "c1", trackId: "v1", startUs: 0, durationUs: 1_000_000,
      words: [{ text: "hello", startUs: 0, durationUs: 500_000 }],
      style,
    },
  } as never);

const text = (project: Project) => project.toJSON().clips["t1"] as TextClip;
const caption = (project: Project) => project.toJSON().clips["c1"] as CaptionClip;

describe("typography — text clips", () => {
  it("absent fields leave no keys (old documents serialize unchanged)", () => {
    const project = setup();
    addText(project);
    const clip = text(project);
    for (const key of ["fontWeight", "fontStyle", "lineHeight", "letterSpacing", "textAlign"]) {
      expect(key in clip).toBe(false);
    }
  });

  it("clip/add stores every field", () => {
    const project = setup();
    addText(project, { fontWeight: 700, fontStyle: "italic", lineHeight: 1.1, letterSpacing: 0.05, textAlign: "center" });
    expect(text(project)).toMatchObject({
      fontWeight: 700, fontStyle: "italic", lineHeight: 1.1, letterSpacing: 0.05, textAlign: "center",
    });
  });

  it.each([
    ["fontWeight", 450],
    ["fontWeight", 950],
    ["fontWeight", 50],
    ["fontStyle", "oblique"],
    ["lineHeight", 0],
    ["letterSpacing", 3],
    ["textAlign", "justify"],
  ])("rejects %s = %j", (key, value) => {
    const project = setup();
    expect(() => addText(project, { [key]: value })).toThrow();
    expect(project.toJSON().clips["t1"]).toBeUndefined();
  });

  it("set-property sets, null clears, undo restores", () => {
    const project = setup();
    addText(project, { fontWeight: 300 });
    project.dispatch({ type: "clip/set-property", payload: { clipId: "t1", fontWeight: 800, textAlign: "right" } });
    expect(text(project)).toMatchObject({ fontWeight: 800, textAlign: "right" });

    project.dispatch({ type: "clip/set-property", payload: { clipId: "t1", fontWeight: null, textAlign: null } });
    expect("fontWeight" in text(project)).toBe(false);
    expect("textAlign" in text(project)).toBe(false);

    project.undo();
    expect(text(project)).toMatchObject({ fontWeight: 800, textAlign: "right" });
  });

  it("set-property rejects typography on non-text clips", () => {
    const project = setup();
    addCaption(project);
    expect(() =>
      project.dispatch({ type: "clip/set-property", payload: { clipId: "c1", fontWeight: 700 } }),
    ).toThrow(/only applies to text clips/);
  });
});

describe("typography — caption styles", () => {
  it("absent fields leave no keys; existing style defaults still apply", () => {
    const project = setup();
    addCaption(project);
    const style = caption(project).style;
    expect(style.preset).toBe("highlight");
    for (const key of ["fontWeight", "fontStyle", "lineHeight", "letterSpacing"]) {
      expect(key in style).toBe(false);
    }
  });

  it("stores typography; set-property merges and null clears only that key", () => {
    const project = setup();
    addCaption(project, { fontWeight: 900, letterSpacing: 0.02 });
    expect(caption(project).style).toMatchObject({ fontWeight: 900, letterSpacing: 0.02 });

    project.dispatch({
      type: "clip/set-property",
      payload: { clipId: "c1", style: { fontWeight: null, lineHeight: 1.5, color: "#ff0000" } },
    });
    const style = caption(project).style;
    expect("fontWeight" in style).toBe(false);
    expect(style).toMatchObject({ lineHeight: 1.5, letterSpacing: 0.02, color: "#ff0000", preset: "highlight" });
  });

  it("captions take no textAlign (lines are always centered)", () => {
    const project = setup();
    addCaption(project, { textAlign: "left" });
    expect("textAlign" in caption(project).style).toBe(false);
  });
});

describe("typography — font asset descriptors", () => {
  it("stores weight/style on font assets", () => {
    const project = setup();
    project.dispatch({
      type: "asset/add",
      payload: { id: "f-bold", kind: "font", src: "/Inter-Bold.woff2", family: "Inter", weight: 700 },
    });
    project.dispatch({
      type: "asset/add",
      payload: { id: "f-it", kind: "font", src: "/Inter-Italic.woff2", family: "Inter", style: "italic" },
    });
    const { assets } = project.toJSON();
    expect(assets["f-bold"]).toMatchObject({ family: "Inter", weight: 700 });
    expect("style" in assets["f-bold"]!).toBe(false);
    expect(assets["f-it"]).toMatchObject({ family: "Inter", style: "italic" });
  });

  it("rejects descriptors on non-font assets", () => {
    const project = setup();
    expect(() =>
      project.dispatch({ type: "asset/add", payload: { id: "v", kind: "video", src: "/a.mp4", weight: 700 } }),
    ).toThrow(/only apply to font assets/);
  });
});

describe("typography — AI surface", () => {
  it("describeProject shows only fields that were set", () => {
    const project = setup();
    addText(project);
    expect(describeProject(project.toJSON())).not.toContain("{");

    project.dispatch({ type: "clip/set-property", payload: { clipId: "t1", fontWeight: 700, letterSpacing: 0.1 } });
    expect(describeProject(project.toJSON())).toContain(`"Hi" {weight 700, letterSpacing 0.1em}`);
  });

  it("the command catalog exposes the constraints to tools and property panels", () => {
    const catalog = setup().commandCatalog() as Record<string, { properties: Record<string, any>; anyOf?: any[] }>;
    const set = catalog["clip/set-property"]!.properties;
    const weight = JSON.stringify(set["fontWeight"]);
    expect(weight).toContain(`"multipleOf":100`);
    expect(weight).toContain(`"null"`);
    expect(JSON.stringify(set["textAlign"])).toContain("center");
    expect(JSON.stringify(set["style"])).toContain("letterSpacing");
    expect(JSON.stringify(catalog["asset/add"])).toContain(`"weight"`);
  });

  it("exports the defaults renderers read", () => {
    expect(TYPOGRAPHY_DEFAULTS).toEqual({
      fontWeight: 400, fontStyle: "normal", letterSpacing: 0, textAlign: "left", captionLineHeight: 1.3,
    });
  });
});
