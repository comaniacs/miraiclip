import { describe, expect, it } from "vitest";
import { createProject, type Project } from "@miraiclip/core";
import { Compositor } from "../src/compositor/compositor.js";
import { collectHtmlRasters, htmlRasterKey, provideHtmlRasters, rasterizeHtml, substituteParams } from "../src/html/rasterize.js";
import { FakeBackend, type FakeHtmlNode } from "./scene-fakes.js";

function setup(): { project: Project; backend: FakeBackend } {
  const project = createProject({ width: 640, height: 360, fps: 30 });
  project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
  return { project, backend: new FakeBackend() };
}

describe("substituteParams", () => {
  it("substitutes {{name}} placeholders and HTML-escapes values (params are data)", () => {
    expect(substituteParams("<b>{{who}}</b> x {{ n }}", { who: `<i>"a"&b</i>`, n: 3 })).toBe(
      "<b>&lt;i&gt;&quot;a&quot;&amp;b&lt;/i&gt;</b> x 3",
    );
  });

  it("leaves unknown placeholders untouched", () => {
    expect(substituteParams("{{a}} {{missing}}", { a: true })).toBe("true {{missing}}");
  });
});

describe("html clips in the compositor", () => {
  it("creates a node through the backend seam, with the project's assets", () => {
    const { project, backend } = setup();
    project.dispatch({ type: "asset/add", payload: { id: "logo", kind: "image", src: "/logo.png" } });
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "html", id: "h1", trackId: "v1", startUs: 0, durationUs: 2_000_000,
        template: `<img src="asset:logo"/>`,
      },
    });
    const compositor = new Compositor(project, backend);
    const node = backend.nodes.find((n) => n.kind === "html") as FakeHtmlNode;
    expect(node).toBeDefined();
    expect(node.assets["logo"]).toBeDefined();
    compositor.destroy();
  });

  it("re-syncs the node when params change via clip/set-property", () => {
    const { project, backend } = setup();
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "html", id: "h1", trackId: "v1", startUs: 0, durationUs: 2_000_000,
        template: "<div>{{v}}</div>", params: { v: "1" },
      },
    });
    const compositor = new Compositor(project, backend);
    const node = backend.nodes.find((n) => n.kind === "html") as FakeHtmlNode;
    const updatesBefore = node.updates.length;
    project.dispatch({ type: "clip/set-property", payload: { clipId: "h1", params: { v: "2" } } });
    expect(node.updates.length).toBeGreaterThan(updatesBefore);
    const last = node.updates.at(-1) as { params: Record<string, unknown> };
    expect(last.params["v"]).toBe("2");
    compositor.destroy();
  });

  it("whenReady() waits for every node's async content", async () => {
    const { project, backend } = setup();
    project.dispatch({
      type: "clip/add",
      payload: { kind: "html", id: "h1", trackId: "v1", startUs: 0, durationUs: 1_000_000, template: "<b>x</b>" },
    });
    const compositor = new Compositor(project, backend);
    const node = backend.nodes.find((n) => n.kind === "html") as FakeHtmlNode;

    let settled = false;
    const waiting = compositor.whenReady().then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false); // the html raster is still pending
    node.readyResolve!();
    await waiting;
    expect(settled).toBe(true);
    compositor.destroy();
  });
});

describe("pre-rendered rasters (the worker-export path)", () => {
  const fakeBitmap = (): ImageBitmap => {
    let closed = false;
    return {
      width: 1, height: 1,
      close: () => { closed = true; },
      get closed() { return closed; },
    } as unknown as ImageBitmap;
  };

  it("rasterizeHtml serves an installed raster without a DOM", async () => {
    const clip = { template: "<b>{{x}}</b>", params: { x: 1 } };
    const key = htmlRasterKey(clip as never, 320, 180);
    const bitmap = fakeBitmap();
    provideHtmlRasters({ [key]: bitmap });
    const served = await rasterizeHtml({ ...clip, widthPx: 320, heightPx: 180 });
    expect(served).toBe(bitmap);
    provideHtmlRasters({});
  });

  it("without a DOM and without a provided raster, the error says how to export html clips", async () => {
    await expect(
      rasterizeHtml({ template: "<b>x</b>", params: {}, widthPx: 10, heightPx: 10 }),
    ).rejects.toThrow(/pre-rendered raster|exportProjectInWorker/);
  });

  it("collectHtmlRasters keys match the compositor's sizing (widthPx ?? composition) and dedupe", async () => {
    const { project } = setup();
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "html", id: "sized", trackId: "v1", startUs: 0, durationUs: 1_000_000,
        template: "<b>{{x}}</b>", params: { x: 1 }, widthPx: 320, heightPx: 180,
      },
    });
    // Two full-frame clips sharing (template, params) — one raster expected.
    for (const id of ["full-a", "full-b"]) {
      project.dispatch({
        type: "clip/add",
        payload: {
          kind: "html", id, trackId: "v1", startUs: 2_000_000, durationUs: 1_000_000,
          template: "<i>same</i>", params: {},
        },
      });
    }
    const doc = project.getState().doc;
    const sizedKey = htmlRasterKey(doc.clips["sized"] as never, 320, 180);
    const fullKey = htmlRasterKey(doc.clips["full-a"] as never, 640, 360);

    // No DOM here: satisfy the rasterizer from the store, and stand in for
    // createImageBitmap — the KEY and dedupe logic is what this test pins.
    provideHtmlRasters({ [sizedKey]: fakeBitmap(), [fullKey]: fakeBitmap() });
    const scope = globalThis as { createImageBitmap?: unknown };
    scope.createImageBitmap = async (source: unknown) => source;
    try {
      const { rasters, transfer } = await collectHtmlRasters(doc);
      expect(Object.keys(rasters).sort()).toEqual([sizedKey, fullKey].sort());
      expect(transfer).toHaveLength(2);
    } finally {
      delete scope.createImageBitmap;
      provideHtmlRasters({});
    }
  });

  it("installing a new raster set closes the previous one", () => {
    const first = fakeBitmap();
    provideHtmlRasters({ a: first });
    provideHtmlRasters({});
    expect((first as unknown as { closed: boolean }).closed).toBe(true);
  });
});
