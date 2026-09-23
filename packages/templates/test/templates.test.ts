import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import {
  defineTemplate,
  describeTemplate,
  extractFields,
  hydrate,
  parseTemplate,
  TemplateValidationError,
  toFieldToolDefinition,
  tryHydrate,
  type Template,
  type TemplateField,
} from "../src/index.js";

/** A doc exercising every binding site: text clip, caption words, html params, asset slot. */
function fixtureDoc() {
  const project = createProject({ width: 640, height: 360, fps: 30 });
  project.transaction(() => {
    project.dispatch({
      type: "asset/add",
      payload: { id: "logo", kind: "image", src: "placeholder-logo.png" },
    });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "text", id: "title", trackId: "v1", startUs: 0, durationUs: 2_000_000,
        text: "Hello {{name}}!",
      },
    });
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "caption", id: "cap", trackId: "v1", startUs: 0, durationUs: 2_000_000,
        words: [
          { text: "{{name}}", startUs: 0, durationUs: 1_000_000 },
          { text: "rocks", startUs: 1_000_000, durationUs: 1_000_000 },
        ],
      },
    });
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "html", id: "card", trackId: "v1", startUs: 0, durationUs: 2_000_000,
        template: `<div style="background:{{bg}};font-size:{{size}}px">{{copy}}</div>`,
        params: { bg: "{{accent}}", size: "{{fontSize}}", copy: "{{name}} from {{company}}" },
      },
    });
  });
  return project.toJSON();
}

const FIELDS: TemplateField[] = [
  { name: "name", type: "text", maxLength: 40 },
  { name: "company", type: "text", default: "Acme" },
  { name: "accent", type: "color", default: "#ff8c32" },
  { name: "fontSize", type: "number", integer: true, min: 8, max: 96 },
  { name: "logo", type: "asset", assetId: "logo", required: false },
];

function fixtureTemplate(): Template {
  return defineTemplate({ name: "Outreach", doc: fixtureDoc(), fields: FIELDS });
}

describe("defineTemplate coherence", () => {
  it("accepts a coherent template", () => {
    expect(fixtureTemplate().version).toBe(1);
  });

  it("rejects placeholders without a field, unused fields, and missing assets", () => {
    const doc = fixtureDoc();
    expect(() =>
      defineTemplate({
        name: "bad",
        doc,
        fields: [
          ...FIELDS.filter((f) => f.name !== "name"), // {{name}} now undeclared
          { name: "ghost", type: "text" }, // never used
          { name: "photo", type: "asset", assetId: "nope" }, // missing asset
        ],
      }),
    ).toThrowError(TemplateValidationError);
    try {
      defineTemplate({
        name: "bad",
        doc,
        fields: [{ name: "ghost", type: "text" }],
      });
    } catch (error) {
      const issues = (error as TemplateValidationError).issues;
      expect(issues.some((i) => i.message.includes("{{name}}"))).toBe(true);
      expect(issues.some((i) => i.path === "fields.ghost")).toBe(true);
    }
  });

  it("rejects an asset field used as a placeholder", () => {
    const project = createProject({ width: 64, height: 64, fps: 30 });
    project.transaction(() => {
      project.dispatch({ type: "asset/add", payload: { id: "a", kind: "image", src: "x.png" } });
      project.dispatch({ type: "track/add", payload: { id: "t", kind: "video" } });
      project.dispatch({
        type: "clip/add",
        payload: { kind: "text", id: "c", trackId: "t", text: "{{a}}", startUs: 0, durationUs: 1 },
      });
    });
    expect(() =>
      defineTemplate({
        name: "bad",
        doc: project.toJSON(),
        fields: [{ name: "a", type: "asset", assetId: "a" }],
      }),
    ).toThrowError(/never appear as placeholders/);
  });
});

describe("hydrate", () => {
  it("fills every binding site, applies defaults, keeps the template untouched", () => {
    const template = fixtureTemplate();
    const before = JSON.stringify(template.doc);
    const doc = hydrate(template, { name: "Vin", fontSize: 42 });
    expect(JSON.stringify(template.doc)).toBe(before); // pure

    expect((doc.clips["title"] as { text: string }).text).toBe("Hello Vin!");
    expect((doc.clips["cap"] as { words: { text: string }[] }).words[0]!.text).toBe("Vin");
    const params = (doc.clips["card"] as { params: Record<string, unknown> }).params;
    expect(params["copy"]).toBe("Vin from Acme"); // default applied
    expect(params["bg"]).toBe("#ff8c32"); // color default
    expect(params["size"]).toBe(42); // whole-value placeholder binds TYPED
    expect(doc.assets["logo"]!.src).toBe("placeholder-logo.png"); // optional slot untouched
  });

  it("swaps asset slots (src, and durationUs when given)", () => {
    const template = fixtureTemplate();
    const byString = hydrate(template, { name: "A", fontSize: 10, logo: "brand.png" });
    expect(byString.assets["logo"]!.src).toBe("brand.png");

    const byObject = hydrate(template, {
      name: "A", fontSize: 10,
      logo: { src: "intro.mp4", durationUs: 3_000_000 },
    });
    expect(byObject.assets["logo"]!.src).toBe("intro.mp4");
    expect(byObject.assets["logo"]!.durationUs).toBe(3_000_000);
  });

  it("is deterministic: same inputs, same document", () => {
    const template = fixtureTemplate();
    const data = { name: "Vin", fontSize: 42 };
    expect(JSON.stringify(hydrate(template, data))).toBe(JSON.stringify(hydrate(template, data)));
  });

  it("tryHydrate reports machine-readable issues an agent can self-correct from", () => {
    const template = fixtureTemplate();
    const result = tryHydrate(template, {
      fontSize: 7.5, // not an integer, below min
      name: "x".repeat(50), // over maxLength
      extra: "?", // unknown
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const paths = result.issues.map((i) => i.path);
    expect(paths).toContain("data.fontSize");
    expect(paths).toContain("data.name");
    expect(paths).toContain("data.extra");
    expect(result.issues.length).toBeGreaterThanOrEqual(4); // integer + min are separate
  });
});

describe("parseTemplate / extractFields / AI surface", () => {
  it("round-trips through JSON and rejects malformed files with paths", () => {
    const template = fixtureTemplate();
    const parsed = parseTemplate(JSON.parse(JSON.stringify(template)));
    expect(parsed.fields).toHaveLength(FIELDS.length);

    expect(() => parseTemplate({ version: 2 })).toThrowError(TemplateValidationError);
    try {
      parseTemplate({ version: 1, name: "x", doc: {}, fields: [{ name: "no type" }] });
    } catch (error) {
      expect((error as TemplateValidationError).issues.length).toBeGreaterThan(0);
    }
  });

  it("extractFields proposes one text field per distinct placeholder", () => {
    const proposed = extractFields(fixtureDoc());
    expect(proposed.map((f) => f.name)).toEqual([
      "accent", "company", "fontSize", "name",
    ]);
    expect(proposed.every((f) => f.type === "text")).toBe(true);
  });

  it("toFieldToolDefinition emits a schema whose payload hydrate accepts", () => {
    const template = fixtureTemplate();
    const tool = toFieldToolDefinition(template) as {
      name: string;
      input_schema: { properties: Record<string, unknown>; required?: string[] };
    };
    expect(tool.name).toBe("render_outreach");
    expect(Object.keys(tool.input_schema.properties).sort()).toEqual(
      ["accent", "company", "fontSize", "logo", "name"],
    );
    // required = no default and not optional
    expect(tool.input_schema.required).toEqual(["name", "fontSize"]);
    expect((tool.input_schema.properties["fontSize"] as { type: string }).type).toBe("integer");

    const openai = toFieldToolDefinition(template, { style: "openai" }) as {
      type: string;
      function: { name: string };
    };
    expect(openai.type).toBe("function");
    expect(openai.function.name).toBe("render_outreach");
  });

  it("describeTemplate is compact and deterministic", () => {
    const summary = describeTemplate(fixtureTemplate());
    expect(summary).toContain('template "Outreach" — 640x360 @ 30fps');
    expect(summary).toContain("- name (text)");
    expect(summary).toContain("- logo (asset, asset logo, optional)");
    expect(describeTemplate(fixtureTemplate())).toBe(summary);
  });
});
