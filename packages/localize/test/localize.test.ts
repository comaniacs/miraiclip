import { describe, expect, it } from "vitest";
import { applyCommands, createProject, isCaptionClip, type ProjectDocument } from "@miraiclip/core";
import { chatTranslator, collectText, deeplTranslator, isTextParam, localizeMany, localizeProject, type Translator } from "../src/index.js";

const S = 1_000_000;
function doc(): ProjectDocument {
  const p = createProject({ width: 1280, height: 720, fps: 30, name: "Dark mode" });
  const r = applyCommands(p, [
    { type: "track/add", payload: { id: "t", kind: "video" } },
    { type: "clip/add", payload: { kind: "text", id: "title", trackId: "t", startUs: 0, durationUs: 2 * S, text: "Turn on dark mode" } },
    { type: "clip/add", payload: { kind: "caption", id: "cap", trackId: "t", startUs: 2 * S, durationUs: 2 * S, words: [{ text: "Open", startUs: 0, durationUs: 500_000 }, { text: "Settings", startUs: 600_000, durationUs: 800_000 }] } },
    { type: "clip/add", payload: { kind: "html", id: "lt", trackId: "t", startUs: 4 * S, durationUs: 2 * S, template: "<b>{{name}}</b><i>{{role}}</i>", params: { name: "Click Save", role: "Step two", color: "#ff0000", url: "acme.com", n: "1" } } },
    { type: "marker/add", payload: { id: "m", timeUs: 0, label: "Introduction" } },
  ]);
  expect(r.ok).toBe(true);
  return p.getState().doc;
}

/** A fake translator: uppercases, tagging the language; keeps "Settings". */
const fake: Translator = {
  id: "fake",
  label: "Fake",
  translate: async (texts, o) => texts.map((t) => (o.keep?.includes(t) ? t : `${o.to}:${t.split(" ").map((w) => (o.keep?.includes(w) ? w : w.toUpperCase())).join(" ")}`)),
};

describe("collectText", () => {
  it("finds every visible string, and leaves colours, URLs and settings alone", () => {
    expect(collectText(doc()).map((u) => u.key)).toEqual(["project:name", "text:title", "caption:cap", "html:lt:name", "html:lt:role", "marker:m"]);
    expect(isTextParam("headline", "Hello")).toBe(true);
    expect(isTextParam("accent", "#22d3ee")).toBe(false);
    expect(isTextParam("site", "https://acme.com")).toBe(false);
    expect(isTextParam("count", "42")).toBe(false);
  });
});

describe("localizeProject", () => {
  it("translates text, captions (keeping word timing), html text params, markers, the name and the script", async () => {
    const script = { segments: [{ id: "a", text: "Click Save", startUs: 0 }] };
    const out = await localizeProject(doc(), fake, { to: "fr", keep: ["Settings"], script });
    const d = out.doc;
    expect((d.clips["title"] as { text: string }).text).toBe("fr:TURN ON DARK MODE");
    const cap = d.clips["cap"]!;
    // "fr:OPEN Settings" → 2 words, same count: timings kept.
    expect(isCaptionClip(cap) && cap.words).toEqual([{ text: "fr:OPEN", startUs: 0, durationUs: 500_000 }, { text: "Settings", startUs: 600_000, durationUs: 800_000 }]);
    expect((d.clips["lt"] as { params: Record<string, unknown> }).params).toEqual({ name: "fr:CLICK SAVE", role: "fr:STEP TWO", color: "#ff0000", url: "acme.com", n: "1" });
    expect(d.markers!["m"]!.label).toBe("fr:INTRODUCTION");
    expect(d.settings.name).toBe("fr:DARK MODE (fr)");
    expect(out.script).toEqual({ language: "fr", segments: [{ id: "a", text: "fr:CLICK SAVE", startUs: 0 }] });
  });

  it("many languages at once; a translator returning the wrong count is an error", async () => {
    const all = await localizeMany(doc(), fake, ["de", "hi", "ja"]);
    expect(Object.keys(all).sort()).toEqual(["de", "hi", "ja"]);
    expect((all["hi"]!.doc.clips["title"] as { text: string }).text).toBe("hi:TURN ON DARK MODE");
    const broken: Translator = { id: "b", label: "B", translate: async () => ["x"] };
    await expect(localizeProject(doc(), broken, { to: "fr" })).rejects.toThrow(/1 translations/);
  });
});

describe("adapters", () => {
  it("chatTranslator: JSON in, JSON out, kept terms and context in the prompt", async () => {
    let system = "";
    const t = chatTranslator({
      async complete(req) {
        system = req.messages[0]!.content;
        const { strings } = JSON.parse(req.messages[1]!.content) as { strings: string[] };
        return { content: JSON.stringify({ translations: strings.map((s) => `«${s}»`) }) };
      },
    });
    expect(await t.translate(["a", "b"], { to: "es", keep: ["Miraiclip"], context: "UI" })).toEqual(["«a»", "«b»"]);
    expect(system).toContain('"Miraiclip"');
    expect(system).toContain("Context: UI");
  });

  it("deeplTranslator: kept terms and placeholders go through an ignored tag", async () => {
    let body: { text: string[]; target_lang: string; ignore_tags: string[] } = { text: [], target_lang: "", ignore_tags: [] };
    const t = deeplTranslator({
      apiKey: "k:fx",
      fetch: async (url, init) => {
        expect(url).toBe("https://api-free.deepl.com/v2/translate");
        body = JSON.parse(init!.body as string);
        return Response.json({ translations: body.text.map((x) => ({ text: x.replace("Open", "Ouvrir") })) });
      },
    });
    const out = await t.translate(["Open Miraiclip & {{name}}"], { to: "fr", keep: ["Miraiclip"] });
    expect(body.text).toEqual(["Open <x>Miraiclip</x> &amp; <x>{{name}}</x>"]);
    expect(body.target_lang).toBe("FR");
    expect(out).toEqual(["Ouvrir Miraiclip & {{name}}"]);
  });
});
