import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import {
  HtmlEditError,
  cleanHtml,
  describeHtml,
  editHtml,
  formatHtmlOutline,
  parseInlineStyle,
  planHtmlEdit,
  stampHtmlIds,
} from "../src/index.js";

const RECEIPT = `<style>.row{display:flex;justify-content:space-between}</style>
<div class="paper" style="position:absolute; left:80px; top:60px; width:560px; transform:rotate(-2.5deg)">
  <h1 style="font-family:'Courier Prime'; font-size:64px">MORNING MENU</h1>
  <div class="row"><span>Flat white</span><span>3.80</span></div>
  <div class="row"><span>Cold brew tonic</span><span>5.00</span></div>
  <p>TOTAL: <b>one perfect morning</b></p>
  <svg viewBox="0 0 100 20" width="300" height="60"><rect x="0" width="2" height="20"/><rect x="4" width="1" height="20"/></svg>
</div>`;

const ids = (template: string) => describeHtml(template).elements.map((e) => e.id);
const byText = (template: string, text: string) => describeHtml(template).elements.find((e) => e.text === text)!.id;

describe("stamping and describing", () => {
  it("gives every element a stable id in document order, the same each time", () => {
    const once = stampHtmlIds(RECEIPT).template;
    expect(stampHtmlIds(RECEIPT).template).toBe(once);
    // Stamping a stamped template changes nothing.
    expect(stampHtmlIds(once)).toEqual({ template: once, created: [] });
    // Ids read from the unstamped template are the ones the stamped one carries.
    expect(ids(RECEIPT)).toEqual(ids(once));
    // div, h1, 2 rows × (div, span, span), p, b, svg = 11; style and svg insides get none.
    expect(ids(RECEIPT)).toHaveLength(11);
    expect(once).not.toMatch(/<style[^>]*data-mc/);
    expect(once).not.toMatch(/<rect[^>]*data-mc/);
  });

  it("describes each element's own text, style, class and nesting", () => {
    const { elements } = describeHtml(RECEIPT);
    const paper = elements[0]!;
    expect(paper).toMatchObject({ tag: "div", parentId: null, depth: 0, attrs: { class: "paper" }, childCount: 5 });
    expect(paper.style).toEqual({ position: "absolute", left: "80px", top: "60px", width: "560px", transform: "rotate(-2.5deg)" });
    const total = elements.find((e) => e.tag === "p")!;
    expect(total).toMatchObject({ text: "TOTAL:", parentId: paper.id, depth: 1, childCount: 1 });
    expect(elements.find((e) => e.tag === "svg")!.childCount).toBe(0);
    const outline = formatHtmlOutline(elements);
    expect(outline).toContain(`#${paper.id} div.paper {position:absolute;`);
    expect(outline).toMatch(/\n {4}#e\d+ span "5\.00"/);
  });

  it("keeps the markup well-formed for the rasterizer, and svg attribute case", () => {
    const t = stampHtmlIds(`<p>a<br>b &amp; c</p><img src="asset:a1"><svg viewBox="0 0 1 1"><linearGradient id="g"/></svg>`).template;
    expect(t).toContain("<br/>");
    expect(t).toContain("b &amp; c");
    expect(t).toMatch(/<img src="asset:a1" data-mc="e\d+"\/>/);
    expect(t).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(t).toContain('viewBox="0 0 1 1"');
    expect(t).toContain("<linearGradient");
  });

  it("gives a pasted duplicate id a fresh one", () => {
    const { template, created } = stampHtmlIds(`<b data-mc="e1">a</b><i data-mc="e1">b</i><u>c</u>`);
    expect(created).toEqual(["e2", "e3"]);
    expect(template).toBe(`<b data-mc="e1">a</b><i data-mc="e2">b</i><u data-mc="e3">c</u>`);
  });
});

describe("editing by element", () => {
  it("retypes one price and nothing else", () => {
    const price = byText(RECEIPT, "5.00");
    const before = stampHtmlIds(RECEIPT).template;
    const { template } = editHtml(RECEIPT, [{ op: "text", id: price, text: "9.00" }]);
    expect(template).toBe(before.replace(">5.00<", ">9.00<"));
  });

  it("refuses to flatten an element with children, and says what to do", () => {
    const total = describeHtml(RECEIPT).elements.find((e) => e.tag === "p")!.id;
    expect(() => editHtml(RECEIPT, [{ op: "text", id: total, text: "x" }])).toThrow(/edit a child's text, or use "html"/);
  });

  it("merges inline style, removes with null, keeps data: urls with semicolons whole", () => {
    const paper = ids(RECEIPT)[0]!;
    const { template } = editHtml(RECEIPT, [
      { op: "style", id: paper, set: { left: "120px", transform: null, background: "url(data:image/png;base64,AAA=) center" } },
    ]);
    const style = describeHtml(template).elements[0]!.style;
    expect(style).toEqual({
      position: "absolute",
      left: "120px",
      top: "60px",
      width: "560px",
      background: "url(data:image/png;base64,AAA=) center",
    });
    expect(parseInlineStyle("a: 1; b: url('x;y'); c:")).toEqual(new Map([["a", "1"], ["b", "url('x;y')"]]));
  });

  it("moves, duplicates (fresh ids), inserts and removes", () => {
    const [paper, h1, row1, , , row2] = ids(RECEIPT);
    const { template, created } = editHtml(RECEIPT, [
      { op: "move", id: row2!, ref: row1!, position: "before" },
      { op: "duplicate", id: row1! },
      { op: "insert", html: `<div class="stub" style="position:absolute;right:0">SEAT 14</div>`, ref: paper!, position: "last" },
      { op: "remove", id: h1! },
    ]);
    const after = describeHtml(template).elements;
    const rows = after.filter((e) => e.attrs.class === "row");
    expect(rows.map((r) => after.filter((e) => e.parentId === r.id).map((e) => e.text).join(" "))).toEqual([
      "Cold brew tonic 5.00",
      "Flat white 3.80",
      "Flat white 3.80",
    ]);
    expect(after.find((e) => e.tag === "h1")).toBeUndefined();
    expect(after.at(-1)).toMatchObject({ text: "SEAT 14", parentId: paper });
    // The copy (div + 2 spans) and the stub got ids nobody else has.
    expect(created).toHaveLength(4);
    expect(new Set(after.map((e) => e.id)).size).toBe(after.length);
  });

  it("replaces inner and outer markup, cleaning what comes in", () => {
    const total = describeHtml(RECEIPT).elements.find((e) => e.tag === "p")!.id;
    const { template, removed } = editHtml(RECEIPT, [
      { op: "html", id: total, html: `TOTAL <i onclick="steal()">9.00</i><script>alert(1)</script>` },
    ]);
    expect(template).toContain(">TOTAL <i data-mc=");
    expect(template).not.toContain("onclick");
    expect(template).not.toContain("<script");
    expect(removed).toEqual(["onclick on <i>", "<script>"]);
  });

  it("is all or nothing, and names the failing operation", () => {
    const first = ids(RECEIPT)[0]!;
    let caught: unknown;
    try {
      editHtml(RECEIPT, [
        { op: "style", id: first, set: { left: "0" } },
        { op: "move", id: first, ref: ids(RECEIPT)[1]!, position: "first" },
      ]);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HtmlEditError);
    expect(caught).toMatchObject({ code: "invalid-move", index: 1 });
    expect(() => editHtml(RECEIPT, [{ op: "remove", id: "e999" }])).toThrow(expect.objectContaining({ code: "not-found" }));
    expect(() => editHtml(RECEIPT, [{ op: "attr", id: first, set: { onload: "x" } }])).toThrow(expect.objectContaining({ code: "forbidden-attr" }));
    expect(() => editHtml(RECEIPT, [{ op: "attr", id: first, set: { "data-mc": "e5" } }])).toThrow(/can't be set/);
    expect(() => editHtml(`<img src="asset:a">`, [{ op: "attr", id: "e1", set: { src: "https://evil.example/x.png" } }])).toThrow(/asset: or data:/);
  });
});

describe("cleaning", () => {
  it("takes out handlers, javascript:, external fetches, frames and scripts", () => {
    const { template, removed } = cleanHtml(
      `<div onmouseover="x()" style="background:url(https://x.example/a.png); color:red">` +
        `<a href="javascript:alert(1)">go</a><img src="https://x.example/p.jpg"><img src="asset:ok">` +
        `<iframe src="https://x.example"></iframe><script>fetch('//x')</script></div>` +
        `<style>@import url(https://fonts.example/a.css); .a{background:url(asset:bg)}</style>`,
    );
    expect(template).toBe(
      `<div style="background:none; color:red"><a>go</a><img/><img src="asset:ok"/></div>` + `<style> .a{background:url(asset:bg)}</style>`,
    );
    expect(removed).toHaveLength(7);
  });

  it("keeps scripts for a clip that runs them", () => {
    expect(cleanHtml(`<div id="s"></div><script>if (a < b) go()</script>`, { allowScripts: true }).template).toBe(
      `<div id="s"></div><script>if (a < b) go()</script>`,
    );
  });
});

describe("planHtmlEdit", () => {
  function project() {
    const p = createProject({ width: 1080, height: 1920, fps: 30 });
    p.transaction(() => {
      p.dispatch({ type: "track/add", payload: { id: "t", kind: "video" } });
      p.dispatch({ type: "clip/add", payload: { kind: "html", id: "receipt", trackId: "t", startUs: 0, durationUs: 5_000_000, template: RECEIPT, params: {} } });
      p.dispatch({ type: "clip/add", payload: { kind: "text", id: "title", trackId: "t", startUs: 5_000_000, durationUs: 1_000_000, text: "Hi" } });
    });
    p.clearHistory();
    return p;
  }

  it("plans one ordinary command that the project applies and undoes in one step", () => {
    const p = project();
    const price = byText(RECEIPT, "5.00");
    const commands = planHtmlEdit(p.getState().doc, "receipt", [{ op: "text", id: price, text: "9.00" }]);
    expect(commands).toHaveLength(1);
    expect(commands[0]!.type).toBe("clip/set-property");
    p.transaction(() => commands.forEach((c) => p.dispatch(c)));
    const clip = p.getState().doc.clips.receipt as { template: string };
    expect(describeHtml(clip.template).elements.find((e) => e.id === price)!.text).toBe("9.00");
    // The stored template now carries its ids: a second edit finds the same element.
    expect(clip.template).toContain(`data-mc="${price}"`);
    const again = planHtmlEdit(p.getState().doc, "receipt", [{ op: "style", id: price, set: { color: "red" } }]);
    p.transaction(() => again.forEach((c) => p.dispatch(c)));
    expect((p.getState().doc.clips.receipt as { template: string }).template).toMatch(new RegExp(`data-mc="${price}" style="color: red">9.00<`));
    p.undo();
    p.undo();
    expect((p.getState().doc.clips.receipt as { template: string }).template).toBe(RECEIPT);
  });

  it("returns nothing when nothing changes, and refuses other clips", () => {
    const p = project();
    const stamped = planHtmlEdit(p.getState().doc, "receipt", []);
    // Only the ids are new: storing them is still a change.
    expect(stamped).toHaveLength(1);
    p.transaction(() => stamped.forEach((c) => p.dispatch(c)));
    expect(planHtmlEdit(p.getState().doc, "receipt", [])).toEqual([]);
    expect(() => planHtmlEdit(p.getState().doc, "title", [])).toThrow(expect.objectContaining({ code: "not-html-clip" }));
  });
});
