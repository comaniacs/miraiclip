import { describe, expect, it } from "vitest";
import { createProject, isHtmlClip, type HtmlClip, type Project } from "../src/index.js";

function setup(): Project {
  const project = createProject({ width: 640, height: 360, fps: 30 });
  project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
  return project;
}

describe("html clip kind", () => {
  it("adds with template + params, defaulting params to {}", () => {
    const project = setup();
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "html", id: "h1", trackId: "v1", startUs: 0, durationUs: 2_000_000,
        template: `<div style="color:{{color}}">{{name}}</div>`,
        params: { name: "Vinamra", color: "#fff" },
        widthPx: 400, heightPx: 100,
      },
    });
    const clip = project.toJSON().clips["h1"]!;
    expect(isHtmlClip(clip)).toBe(true);
    expect((clip as HtmlClip).params["name"]).toBe("Vinamra");
    expect((clip as HtmlClip).widthPx).toBe(400);

    project.dispatch({
      type: "clip/add",
      payload: { kind: "html", id: "h2", trackId: "v1", startUs: 0, durationUs: 1_000_000, template: "<b>x</b>" },
    });
    expect((project.toJSON().clips["h2"] as HtmlClip).params).toEqual({});
  });

  it("rejects on audio tracks and validates the payload", () => {
    const project = setup();
    project.dispatch({ type: "track/add", payload: { id: "a1", kind: "audio" } });
    expect(() =>
      project.dispatch({
        type: "clip/add",
        payload: { kind: "html", id: "h1", trackId: "a1", startUs: 0, durationUs: 1_000_000, template: "<b>x</b>" },
      }),
    ).toThrow(/does not accept html/);
    expect(() =>
      project.dispatch({
        type: "clip/add",
        payload: { kind: "html", id: "h1", trackId: "v1", startUs: 0, durationUs: 1_000_000, template: "" },
      }),
    ).toThrow(); // empty template fails the schema
  });

  it("merges params via clip/set-property (and only for html clips)", () => {
    const project = setup();
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "html", id: "h1", trackId: "v1", startUs: 0, durationUs: 2_000_000,
        template: "<div>{{a}}{{b}}</div>", params: { a: "1", b: "2" },
      },
    });
    project.dispatch({ type: "clip/set-property", payload: { clipId: "h1", params: { b: "3", c: true } } });
    expect((project.toJSON().clips["h1"] as HtmlClip).params).toEqual({ a: "1", b: "3", c: true });

    project.dispatch({
      type: "clip/add",
      payload: { kind: "text", id: "t1", trackId: "v1", startUs: 0, durationUs: 1_000_000, text: "x" },
    });
    expect(() =>
      project.dispatch({ type: "clip/set-property", payload: { clipId: "t1", params: { a: "1" } } }),
    ).toThrow(/only applies to html/);

    // Undo reverts the merge as one step.
    project.undo();
    expect((project.toJSON().clips["h1"] as HtmlClip).params).toEqual({ a: "1", b: "3", c: true });
    project.undo();
    expect((project.toJSON().clips["h1"] as HtmlClip).params).toEqual({ a: "1", b: "2" });
  });

  it("html is a reserved built-in kind and appears in the catalog", () => {
    const project = setup();
    const catalog = project.commandCatalog();
    expect(JSON.stringify(catalog["clip/add"])).toContain('"html"');
  });
});
