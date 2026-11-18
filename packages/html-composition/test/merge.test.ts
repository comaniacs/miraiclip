import { describe, expect, it } from "vitest";
import { describeHtml, editHtml, mergeHtml, stampHtmlIds } from "../src/index.js";

const BASE = stampHtmlIds(`<div style="position:absolute;left:40px;background:#fff4ea">
<h1 style="font-size:96px;color:#094a9f">WORKSHOP</h1>
<p style="font-size:18px">One evening, one room.</p>
<span style="left:700px">SEAT 17</span>
<b>ROW B</b>
</div>`).template;

const id = (tpl: string, text: string) => describeHtml(tpl).elements.find((e) => e.text === text)!.id;
const textOf = (tpl: string, eid: string) => describeHtml(tpl).elements.find((e) => e.id === eid)?.text;
const styleOf = (tpl: string, eid: string) => describeHtml(tpl).elements.find((e) => e.id === eid)?.style;

describe("mergeHtml", () => {
  it("two people editing different elements at the same moment both keep their work", () => {
    const h1 = id(BASE, "WORKSHOP");
    const seat = id(BASE, "SEAT 17");
    const mine = editHtml(BASE, [{ op: "text", id: seat, text: "SEAT 14" }]).template;
    const theirs = editHtml(BASE, [{ op: "style", id: h1, set: { color: "#f25a5a" } }]).template;
    const { template, conflicts } = mergeHtml(BASE, mine, theirs);
    expect(textOf(template, seat)).toBe("SEAT 14");
    expect(styleOf(template, h1)).toMatchObject({ color: "#f25a5a", "font-size": "96px" });
    expect(conflicts).toBe(0);
  });

  it("merges inline style property by property; the same property changed twice: ours wins, counted", () => {
    const h1 = id(BASE, "WORKSHOP");
    const mine = editHtml(BASE, [{ op: "style", id: h1, set: { "font-size": "120px", color: "#111111" } }]).template;
    const theirs = editHtml(BASE, [{ op: "style", id: h1, set: { "letter-spacing": "0.1em", color: "#f25a5a" } }]).template;
    const { template, conflicts } = mergeHtml(BASE, mine, theirs);
    expect(styleOf(template, h1)).toEqual({ "font-size": "120px", color: "#111111", "letter-spacing": "0.1em" });
    expect(conflicts).toBe(1);
  });

  it("keeps both sides' new elements, with distinct ids, and a removal on either side", () => {
    const row = id(BASE, "ROW B");
    const p = id(BASE, "One evening, one room.");
    const mine = editHtml(BASE, [{ op: "insert", html: "<i>GATE 3</i>", ref: row, position: "after" }]).template;
    const theirs = editHtml(BASE, [
      { op: "insert", html: "<u>DOORS 18:30</u>", ref: row, position: "after" },
      { op: "remove", id: p },
    ]).template;
    const { template } = mergeHtml(BASE, mine, theirs);
    const els = describeHtml(template).elements;
    expect(els.map((e) => e.text).filter(Boolean)).toEqual(["WORKSHOP", "SEAT 17", "ROW B", "GATE 3", "DOORS 18:30"]);
    expect(new Set(els.map((e) => e.id)).size).toBe(els.length);
  });

  it("replays a move and a text change of an element the other side restyled", () => {
    const seat = id(BASE, "SEAT 17");
    const h1 = id(BASE, "WORKSHOP");
    const mine = editHtml(BASE, [
      { op: "move", id: seat, ref: h1, position: "before" },
      { op: "text", id: seat, text: "SEAT 9" },
    ]).template;
    const theirs = editHtml(BASE, [{ op: "style", id: seat, set: { color: "#ff0000" } }]).template;
    const { template } = mergeHtml(BASE, mine, theirs);
    const els = describeHtml(template).elements;
    expect(els[1]).toMatchObject({ id: seat, text: "SEAT 9", style: { left: "700px", color: "#ff0000" } });
  });

  it("an element the other side removed stays removed; nothing changed on our side changes nothing", () => {
    const seat = id(BASE, "SEAT 17");
    const theirs = editHtml(BASE, [{ op: "remove", id: seat }]).template;
    const mine = editHtml(BASE, [{ op: "text", id: seat, text: "SEAT 1" }]).template;
    expect(textOf(mergeHtml(BASE, mine, theirs).template, seat)).toBeUndefined();
    expect(mergeHtml(BASE, BASE, theirs).template).toBe(theirs);
  });
});
