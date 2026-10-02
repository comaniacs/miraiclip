import { describe, expect, it } from "vitest";
import { createProject, readAnimation, animationCommands, type HtmlClip, type TextClip, type VideoClip } from "@miraiclip/core";
import {
  fitClipsToMedia,
  hydrate,
  insertCommands,
  insertDocument,
  parseTemplate,
  suggestTemplateFields,
  templateFromDocument,
} from "../src/index.js";

const S = 1_000_000;
const CARD = '<div style="background:{{bg}};color:{{fg}}">{{headline}}</div>';

/** A small finished project: footage, a logo, a title, a designed card with a transition and animation. */
function finished() {
  const p = createProject({ width: 1080, height: 1920, fps: 30 });
  p.transaction(() => {
    p.dispatch({ type: "asset/add", payload: { id: "clipA", kind: "video", src: "/media/a.mp4", durationUs: 20 * S, name: "Beach" } });
    p.dispatch({ type: "asset/add", payload: { id: "logo", kind: "image", src: "/media/logo.png" } });
    p.dispatch({ type: "asset/add", payload: { id: "unused", kind: "image", src: "/media/unused.png" } });
    p.dispatch({ type: "track/add", payload: { id: "main", kind: "video", name: "Main" } });
    p.dispatch({ type: "track/add", payload: { id: "top", kind: "video", name: "Overlay" } });
    p.dispatch({ type: "clip/add", payload: { kind: "video", id: "v1", trackId: "main", assetId: "clipA", startUs: 0, durationUs: 3 * S } });
    p.dispatch({ type: "clip/add", payload: { kind: "video", id: "v2", trackId: "main", assetId: "clipA", startUs: 3 * S, durationUs: 3 * S, trimStartUs: 5 * S } });
    p.dispatch({ type: "transition/add", payload: { id: "t1", kind: "crossDissolve", fromClipId: "v1", toClipId: "v2", durationUs: 500_000 } });
    p.dispatch({ type: "clip/add", payload: { kind: "image", id: "logo1", trackId: "top", assetId: "logo", startUs: 0, durationUs: 6 * S } });
    p.dispatch({ type: "clip/add", payload: { kind: "text", id: "title", trackId: "top", startUs: 0.5 * S, durationUs: 2 * S, text: "Summer sale" } });
    p.dispatch({
      type: "clip/add",
      payload: { kind: "html", id: "card", trackId: "top", startUs: 3 * S, durationUs: 3 * S, template: CARD, params: { bg: "#112233", fg: "white", headline: "50% off", _style: "card-1" } },
    });
    p.dispatch({ type: "effect/add", payload: { clipId: "v2", kind: "sepia", effectId: "fx1" } });
  });
  const title = p.getState().doc.clips.title!;
  p.transaction(() => {
    for (const c of animationCommands(title, { in: { preset: "in:pop", durationUs: 600_000, easing: "smooth" }, out: { preset: "out:fade", durationUs: 600_000, easing: "smooth" } })) p.dispatch(c);
  });
  return p;
}

describe("suggestTemplateFields", () => {
  it("lists texts, used designed-text params (colors typed) and media in timeline order", () => {
    const fields = suggestTemplateFields(finished().getState().doc);
    expect(fields.map((f) => [f.kind, f.name])).toEqual([
      ["text", "summer_sale"],
      ["param", "bg"],
      ["param", "fg"],
      ["param", "50_off"],
      ["asset", "video"],
      ["asset", "image"],
    ]);
    expect(fields.find((f) => f.name === "bg")).toMatchObject({ color: true, label: "Bg · 50% off" });
    expect(fields.find((f) => f.name === "50_off")).toMatchObject({ color: false, label: 'Headline "50% off"' });
    expect(fields.find((f) => f.name === "video")).toMatchObject({ assetId: "clipA", label: 'Video "Beach"' });
  });
});

describe("templateFromDocument", () => {
  it("round-trips: no data gives the original content, data fills the blanks", () => {
    const doc = finished().getState().doc;
    const template = templateFromDocument(doc, { name: "Sale reel", category: "promo", tags: ["sale"] });
    expect(template).toMatchObject({ name: "Sale reel", category: "promo", tags: ["sale"] });
    expect((template.doc.clips.title as TextClip).text).toBe("{{summer_sale}}");
    expect(doc.clips.title).toMatchObject({ text: "Summer sale" }); // source untouched

    const same = hydrate(template, {});
    expect((same.clips.title as TextClip).text).toBe("Summer sale");
    expect((same.clips.card as HtmlClip).params).toMatchObject({ bg: "#112233", headline: "50% off", _style: "card-1" });

    const filled = hydrate(template, { summer_sale: "Winter sale", bg: "#000", video: { src: "/media/mine.mp4", durationUs: 4 * S } });
    expect((filled.clips.title as TextClip).text).toBe("Winter sale");
    expect(filled.assets.clipA).toMatchObject({ src: "/media/mine.mp4", durationUs: 4 * S });
    // Animation, effects and transitions travel with it.
    expect(readAnimation(filled.clips.title!).recipe.in?.preset).toBe("in:pop");

    // Survives JSON (the export / import format).
    expect(parseTemplate(JSON.parse(JSON.stringify(template)))).toEqual(template);
  });

  it("uses only the chosen fields, with edited names and labels", () => {
    const doc = finished().getState().doc;
    const pick = suggestTemplateFields(doc).filter((f) => f.kind === "text").map((f) => ({ ...f, name: "headline", label: "Headline" }));
    const template = templateFromDocument(doc, { name: "Just the title", fields: pick });
    expect(template.fields).toEqual([{ type: "text", name: "headline", label: "Headline", default: "Summer sale", required: false }]);
    expect((template.doc.clips.card as HtmlClip).params.headline).toBe("50% off");
  });
});

describe("insertCommands / insertDocument", () => {
  it("adds the template on new top tracks at the playhead, as one undo step, with fresh ids", () => {
    const template = templateFromDocument(finished().getState().doc, { name: "Sale" });
    const target = finished(); // same ids on purpose: everything must be remapped
    const before = target.getState().doc;
    const plan = insertDocument(target, hydrate(template, { summer_sale: "Hello" }), { atUs: 10 * S });
    const doc = target.getState().doc;

    expect(doc.trackOrder.slice(0, 2)).toEqual(["main", "top"]);
    expect(doc.trackOrder.slice(2)).toEqual([plan.ids.tracks.main, plan.ids.tracks.top]);
    expect(plan).toMatchObject({ startUs: 10 * S, endUs: 16 * S });
    const title = doc.clips[plan.ids.clips.title!] as TextClip;
    expect(title).toMatchObject({ text: "Hello", startUs: 10.5 * S, trackId: plan.ids.tracks.top });
    expect(readAnimation(title).recipe).toMatchObject({ in: { preset: "in:pop" }, out: { preset: "out:fade" } });
    expect(doc.clips[plan.ids.clips.v2!]!.effects).toMatchObject([{ kind: "sepia", enabled: true }]);
    expect(Object.values(doc.transitions)).toHaveLength(2);
    // Same media is reused, not duplicated.
    expect(Object.keys(doc.assets)).toHaveLength(Object.keys(before.assets).length);
    expect((doc.clips[plan.ids.clips.v1!] as VideoClip).assetId).toBe("clipA");

    target.undo();
    expect(target.getState().doc).toEqual(before);
  });

  it("adds new media and keeps unrelated ids alone", () => {
    const target = createProject({ width: 1920, height: 1080, fps: 30 });
    const template = templateFromDocument(finished().getState().doc, { name: "Sale" });
    const plan = insertCommands(target.getState().doc, hydrate(template, { video: "/media/other.mp4" }));
    expect(plan.commands.filter((c) => c.type === "asset/add").map((c) => (c.payload as { id: string; src: string }).src).sort()).toEqual([
      "/media/logo.png",
      "/media/other.mp4",
      "/media/unused.png",
    ]);
    expect(plan.ids.assets.clipA).toBe("clipA"); // free in the target
  });
});

describe("fitClipsToMedia", () => {
  it("shortens clips past a swapped-in file's end and drops transitions that no longer meet", () => {
    const template = templateFromDocument(finished().getState().doc, { name: "Sale" });
    const six = fitClipsToMedia(hydrate(template, { video: { src: "/media/six.mp4", durationUs: 6 * S } }));
    expect(six.clips.v1).toMatchObject({ durationUs: 3 * S });
    expect(six.clips.v2).toMatchObject({ durationUs: 1 * S, trimStartUs: 5 * S }); // 6 s file, from 5 s
    expect(Object.keys(six.transitions)).toEqual(["t1"]); // the cut still meets, with footage on both sides

    // A file that ends right where v1 ends: no footage after the cut, so no dissolve.
    const three = fitClipsToMedia(hydrate(template, { video: { src: "/media/three.mp4", durationUs: 3 * S } }));
    expect(three.clips.v1).toMatchObject({ durationUs: 3 * S });
    expect(three.transitions).toEqual({});

    const two = fitClipsToMedia(hydrate(template, { video: { src: "/media/two.mp4", durationUs: 2 * S } }));
    expect(two.clips.v1).toMatchObject({ durationUs: 2 * S });
    expect(two.clips.v2).toMatchObject({ durationUs: 2 * S, trimStartUs: 0 }); // starts past the end: from the top
    expect(two.transitions).toEqual({}); // v1 now ends before v2 starts
  });
});
