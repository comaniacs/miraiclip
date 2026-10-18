import { describe, expect, it } from "vitest";
import { applyCommands, createProject, isCaptionClip, isHtmlClip, type Project } from "@miraiclip/core";
import { blockCommands, getBuiltinBlock } from "@miraiclip/registry";
import { applyBrand, parseBrandKit, type BrandKit } from "../src/index.js";

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
