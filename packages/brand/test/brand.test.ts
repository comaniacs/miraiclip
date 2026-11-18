import { describe, expect, it } from "vitest";
import { applyCommands, createProject, isCaptionClip, isHtmlClip, type Project } from "@miraiclip/core";
import { blockCommands, getBuiltinBlock } from "@miraiclip/registry";
import { applyBrand, brandHtmlColors, brandHtmlFonts, parseBrandKit, type BrandKit } from "../src/index.js";

const S = 1_000_000;
const kit: BrandKit = parseBrandKit({
  name: "Zest",
  tagline: "Ship faster",
  url: "zest.dev",
  colors: { primary: "#7c3aed", accent: "#facc15", background: "#111111", text: "#fafafa" },
  fonts: { heading: { family: "Sora", src: "fonts/Sora.woff2", weightRange: [100, 800] } },
  logo: { src: "logo.png", width: 400, height: 200, corner: "bottom-right", widthFrac: 0.12 },
  captions: { preset: "pop" },
  intro: {},
  outro: { durationUs: 2 * S },
});

function project(): Project {
  const p = createProject({ width: 1920, height: 1080, fps: 30 });
  const r = applyCommands(p, [
    { type: "track/add", payload: { id: "v", kind: "video" } },
    { type: "clip/add", payload: { kind: "text", id: "t", trackId: "v", startUs: 0, durationUs: 6 * S, text: "Hello" } },
    { type: "track/add", payload: { id: "c", kind: "video" } },
    { type: "clip/add", payload: { kind: "caption", id: "cap", trackId: "c", startUs: 1 * S, durationUs: 2 * S, words: [{ text: "hi", startUs: 0, durationUs: S }] } },
    ...blockCommands(getBuiltinBlock("lower-third-classic")!, { id: "lt", trackId: "o", createTrack: true, startUs: 2 * S, composition: { width: 1920, height: 1080 } }),
    { type: "marker/add", payload: { id: "m", timeUs: 4 * S, label: "Step" } },
  ]);
  expect(r.ok, JSON.stringify(!r.ok && r.error)).toBe(true);
  return p;
}

describe("parseBrandKit", () => {
  it("rejects bad colours with a readable path", () => {
    expect(() => parseBrandKit({ name: "x", colors: { primary: "purple-ish" } })).toThrow(/colors\.primary/);
  });
});

describe("applyBrand", () => {
  it("fonts, colours, captions, intro, outro and logo, as one undoable edit", () => {
    const p = project();
    const before = JSON.stringify(p.getState().doc);
    const plan = applyBrand(p.getState().doc, kit);
    const r = applyCommands(p, plan.commands);
    expect(r.ok, JSON.stringify(!r.ok && r.error)).toBe(true);
    const doc = p.getState().doc;
    expect(doc).toEqual(plan.doc);

    expect(doc.assets["brand-font-heading"]).toMatchObject({ kind: "font", family: "Sora", weightRange: [100, 800] });
    expect((doc.clips["t"] as { fontFamily: string }).fontFamily).toBe("Sora");
    const lt = doc.clips["lt"]!;
    expect(isHtmlClip(lt) && lt.template).toContain("font-family:'Sora',");
    // Block colour fields take brand colours by role.
    const ltBlock = getBuiltinBlock("lower-third-classic")!;
    const colorKeys = ltBlock.fields.filter((f) => f.type === "color").map((f) => f.key);
    expect(colorKeys.length).toBeGreaterThan(0);
    for (const key of colorKeys) expect(isHtmlClip(lt) && lt.params[key]).not.toBe(ltBlock.fields.find((f) => f.key === key)!.default);
    const cap = doc.clips["cap"]!;
    expect(isCaptionClip(cap) && [cap.style.highlightColor, cap.style.preset]).toEqual(["#facc15", "pop"]);

    // The intro (3 s) pushed everything later, markers included; the outro follows the content.
    expect(doc.clips["brand-intro"]).toMatchObject({ startUs: 0, durationUs: 3 * S });
    expect(isHtmlClip(doc.clips["brand-intro"]!) && (doc.clips["brand-intro"] as { params: Record<string, unknown> }).params).toMatchObject({ brand: "Zest", tagline: "Ship faster", bg: "#111111" });
    expect(doc.clips["t"]!.startUs).toBe(3 * S);
    expect(doc.markers!["m"]!.timeUs).toBe(7 * S);
    expect(doc.clips["brand-outro"]).toMatchObject({ startUs: 10 * S, durationUs: 2 * S }); // after the lower third (5 s → 10 s)
    expect((doc.clips["brand-outro"] as { params: Record<string, unknown> }).params).toMatchObject({ url: "zest.dev" });
    // Logo between them, bottom-right, 12% wide.
    const logo = doc.clips["brand-logo"]!;
    expect([logo.startUs, logo.durationUs]).toEqual([3 * S, 7 * S]);
    expect(logo.transform.x).toBeGreaterThan(0.85);
    expect(logo.transform.y).toBeGreaterThan(0.85);

    p.undo();
    expect(JSON.stringify(p.getState().doc)).toBe(before);
  });

  it("applying twice doesn't stack intros or logos; parts can be switched off", () => {
    const p = project();
    applyCommands(p, applyBrand(p.getState().doc, kit).commands);
    const again = applyBrand(p.getState().doc, kit);
    expect(applyCommands(p, again.commands).ok).toBe(true);
    const doc = p.getState().doc;
    expect(Object.values(doc.clips).filter((c) => c.trackId === "brand-intro")).toHaveLength(1);
    expect(Object.values(doc.clips).filter((c) => c.trackId === "brand-logo")).toHaveLength(1);
    expect(doc.clips["t"]!.startUs).toBe(3 * S);

    const q = project();
    const only = applyBrand(q.getState().doc, kit, { intro: false, outro: false, watermark: false, fonts: false });
    expect(only.commands.every((c) => c.type === "clip/set-property")).toBe(true);
  });
});

describe("html written as markup", () => {
  const TICKET =
    `<div style="background:#fff4ea;color:#111111">` +
    `<h1 style="font-family:'Alfa Slab One';font-size:190px;color:#094a9f">LIVE</h1>` +
    `<p style="font-family:'Geist';font-size:34px;color:#094a9f">A session</p>` +
    `<p style="font-family:'JetBrains Mono';font-size:22px;color:#f25a5a">ADMIT ONE</p>` +
    `<div style="background:#094a9f;border-top:4px solid rgba(242, 90, 90, 0.6)"></div></div>`;

  it("type: the largest face takes the heading, the rest the body; mono faces stay", () => {
    const out = brandHtmlFonts(TICKET, "Sora", "Inter");
    expect(out).toContain("font-family:'Sora';font-size:190px");
    expect(out).toContain("font-family:'Inter';font-size:34px");
    expect(out).toContain("font-family:'JetBrains Mono'");
  });

  it("colours: most used first take primary, accent, secondary; neutrals take text and background", () => {
    const out = brandHtmlColors(TICKET, kit);
    // #094a9f (most used) → primary, #f25a5a → accent (alpha kept), cream → background, ink → text.
    expect(out).toContain("color:#7c3aed");
    expect(out).toContain("background:#7c3aed");
    expect(out).toContain("rgba(250, 204, 21, 0.6)");
    expect(out).toContain("background:#111111");
    expect(out).not.toMatch(/#094a9f|#f25a5a|#fff4ea/);
  });

  it("keeps text readable on its main panel when the kit's colour wouldn't be", () => {
    // A pale kit: yellow text on the (now light) panel would vanish.
    const pale = parseBrandKit({ name: "Sun", colors: { primary: "#fde047", background: "#fffbeb" } });
    const out = brandHtmlColors(`<div style="background:#fff4ea"><p style="color:#094a9f">Hi</p><b style="color:#094a9f">x</b></div>`, pale);
    expect(out).toContain("background:#fffbeb");
    expect(out).not.toContain("color:#fde047");
    expect(out).toMatch(/color:#111111/);
  });

  it("applyBrand rebrands an html clip built as markup (no colour fields) in the same step", () => {
    const p = createProject({ width: 1080, height: 1920, fps: 30 });
    applyCommands(p, [
      { type: "track/add", payload: { id: "t", kind: "video" } },
      { type: "clip/add", payload: { kind: "html", id: "ticket", trackId: "t", startUs: 0, durationUs: S, template: TICKET, params: {} } },
    ]);
    const plan = applyBrand(p.getState().doc, kit, { intro: false, outro: false, watermark: false, captions: false });
    const html = (plan.doc.clips["ticket"] as { template: string }).template;
    expect(html).toContain("font-family:'Sora';font-size:190px");
    expect(html).toContain("color:#7c3aed");
  });
});
