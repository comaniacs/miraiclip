import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { editorTools, markupProblem, type AssistantTool } from "../src/index.js";

describe("markupProblem", () => {
  it.each([
    '<div class="root"><style>.a>b{color:red} @property --n{syntax:\'&lt;integer&gt;\'}</style><br/><img src="asset:shot"/></div>',
    "<div>R&amp;D &#160; &#x2192; {{headline}}</div><!-- note --><svg xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M0 0\"/></svg>",
    "<span>one</span><span>two</span>",
    "<p title='single &quot;quoted&quot;'>x</p>",
  ])("accepts well-formed markup %#", (markup) => {
    expect(markupProblem(markup)).toBeUndefined();
  });

  it.each([
    ["<div>a<br>b</div>", /<br> is never closed.*<br …\/>/],
    ["<div>R&D</div>", /bare "&".*&amp;/],
    ["<div>a&nbsp;b</div>", /&nbsp;.*&#160;/],
    ["<style>@property --n{syntax:'<integer>'}</style>", /bare "<"/],
    ['<div class=root>x</div>', /quote the value/],
    ["<div><span>x</div>", /<span> is never closed/],
    ["<div>x", /<div> is never closed \(at the end\)/],
    ["</div>", /closes nothing/],
    ['<div a="1" a="2"/>', /"a" twice/],
    ["<!DOCTYPE html><div/>", /DOCTYPE/],
    ['<img alt="a<b"/>', /"<" inside the "alt" value/],
  ])("rejects %s", (markup, message) => {
    expect(markupProblem(markup)).toMatch(message);
  });
});

describe("apply_commands checks html clips", () => {
  const apply = editorTools().find((t) => t.name === "apply_commands") as AssistantTool;
  const project = () => {
    const p = createProject({ width: 1920, height: 1080, fps: 30 });
    p.dispatch({ type: "track/add", payload: { id: "scenes", kind: "video" } });
    p.dispatch({ type: "asset/add", payload: { id: "logo", kind: "image", src: "logo.png" } });
    return p;
  };
  const add = (id: string, template: string) => ({ type: "clip/add", payload: { kind: "html", id, trackId: "scenes", startUs: 0, durationUs: 1_000_000, template } });

  it("rejects markup that won't parse, and applies nothing", () => {
    const p = project();
    const out = apply.run({ commands: [add("ok", "<div/>"), add("s1", "<div>Hello<br>world</div>")] }, { project: p }) as { ok: boolean; error: { failedIndex: number; error: string } };
    expect(out.ok).toBe(false);
    expect(out.error.failedIndex).toBe(1);
    expect(out.error.error).toMatch(/html clip "s1" won't render.*<br>/);
    expect(p.getState().doc.clips.ok).toBeUndefined();
  });

  it("rejects unknown asset references, but not assets added in the same batch", () => {
    const p = project();
    const bad = apply.run({ commands: [add("s1", '<img src="asset:shot-main-hi"/>')] }, { project: p }) as { ok: boolean; error: { error: string } };
    expect(bad.ok).toBe(false);
    expect(bad.error.error).toMatch(/"asset:shot-main-hi".*images: logo/);
    const good = apply.run(
      { commands: [{ type: "asset/add", payload: { id: "shot", kind: "image", src: "shot.png" } }, add("s1", '<img src="asset:shot"/><img src="asset:logo"/>')] },
      { project: p },
    ) as { ok: boolean };
    expect(good.ok).toBe(true);
  });

  it("checks a replaced template too", () => {
    const p = project();
    p.dispatch(add("s1", "<div/>") as never);
    const out = apply.run({ commands: [{ type: "clip/set-property", payload: { clipId: "s1", template: "<p>a & b</p>" } }] }, { project: p }) as { ok: boolean; error: { error: string } };
    expect(out.ok).toBe(false);
    expect(out.error.error).toMatch(/template for "s1" won't render/);
  });
});
