/**
 * applyBrand: a brand kit → ordinary commands. Fonts load as font assets and
 * replace the families on text, captions and html blocks; colours go to
 * html block colour fields and caption highlights; the logo becomes a
 * watermark; the intro and outro are registry blocks placed before and
 * after the content (which moves to make room). Every part can be turned
 * off, and everything undoes as one step.
 */
import { applyCommands, createProject, isCaptionClip, isHtmlClip, isTextClip, type ProjectDocument } from "@miraiclip/core";
import { blockCommands, getBuiltinBlock, type Block } from "@miraiclip/registry";
import type { BrandFont, BrandKit } from "./kit.js";

export interface Command {
  type: string;
  payload: Record<string, unknown>;
}

export interface ApplyBrandOptions {
  fonts?: boolean;
  colors?: boolean;
  captions?: boolean;
  /** Logo watermark over the whole video (default true when the kit has a logo). */
  watermark?: boolean;
  /** Add the intro / outro (default true when the kit defines them). */
  intro?: boolean;
  outro?: boolean;
  /** Look up blocks that aren't built in (e.g. from your own registry). */
  resolveBlock?: (name: string) => Block | undefined;
}

export interface BrandPlan {
  commands: Command[];
  doc: ProjectDocument;
}

// Which html block colour fields take which brand colour (by field key).
const COLOR_ROLES: [RegExp, keyof BrandKit["colors"] | "accentOrPrimary"][] = [
  [/^(bg|background|card|panel)$/i, "background"],
  [/^(ink|text|textcolor|fg|foreground|title)$/i, "text"],
  [/^(accent|highlight|bar|badge|ring)$/i, "accentOrPrimary"],
  [/^(color|colour|primary|brand)$/i, "primary"],
  [/^(secondary|track)$/i, "secondary"],
];

function colorFor(kit: BrandKit, key: string): string | undefined {
  for (const [re, role] of COLOR_ROLES) {
    if (!re.test(key)) continue;
    if (role === "accentOrPrimary") return kit.colors.accent ?? kit.colors.primary;
    if (role === "background") return kit.colors.background ?? "#0a0d18";
    if (role === "text") return kit.colors.text ?? "#ffffff";
    return kit.colors[role];
  }
  return undefined;
}

const isColor = (v: unknown) => typeof v === "string" && /^#[0-9a-fA-F]{3,8}$|^(rgb|hsl)a?\(/.test(v);

export function applyBrand(doc: ProjectDocument, kit: BrandKit, options: ApplyBrandOptions = {}): BrandPlan {
  const p = createProject(structuredClone(doc), { historyLimit: 1 });
  const commands: Command[] = [];
  const run = (list: Command[]) => {
    const r = applyCommands(p, list);
    if (!r.ok) throw new Error(`applyBrand: ${JSON.stringify(r.error)}`);
    commands.push(...list);
  };
  const state = () => p.getState().doc;
  const resolve = (name: string) => options.resolveBlock?.(name) ?? getBuiltinBlock(name);
  const { width, height } = doc.settings;

  // --- fonts
  const heading = kit.fonts?.heading;
  const body = kit.fonts?.body ?? heading;
  if (options.fonts !== false && (heading || body)) {
    const load = (f: BrandFont, role: string) => {
      if (!f.src) return;
      const id = `brand-font-${role}`;
      if (state().assets[id]) return;
      run([{ type: "asset/add", payload: { id, kind: "font", src: f.src, family: f.family, ...(f.weight ? { weight: f.weight } : {}), ...(f.weightRange ? { weightRange: f.weightRange } : {}) } }]);
    };
    if (heading) load(heading, "heading");
    if (body && body !== heading) load(body, "body");
    const list: Command[] = [];
    for (const c of Object.values(state().clips)) {
      if (isTextClip(c) && heading) list.push({ type: "clip/set-property", payload: { clipId: c.id, fontFamily: heading.family } });
      else if (isCaptionClip(c) && body) list.push({ type: "clip/set-property", payload: { clipId: c.id, style: { fontFamily: body.family } } });
      else if (isHtmlClip(c)) {
        // Blocks write font-family:Inter,…: swap the family in the markup.
        const family = heading?.family ?? body!.family;
        const template = c.template.replace(/font-family:\s*([^;"]+)/g, (_m, rest: string) => `font-family:'${family}',${rest.replace(/^'[^']*',/, "")}`);
        if (template !== c.template) list.push({ type: "clip/set-property", payload: { clipId: c.id, template } });
      }
    }
    if (list.length) run(list);
  }

  // --- colours on html blocks
  if (options.colors !== false) {
    const list: Command[] = [];
    for (const c of Object.values(state().clips)) {
      if (!isHtmlClip(c)) continue;
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(c.params)) {
        if (!isColor(value)) continue;
        const next = colorFor(kit, key);
        if (next && next !== value) params[key] = next;
      }
      if (Object.keys(params).length) list.push({ type: "clip/set-property", payload: { clipId: c.id, params } });
    }
    if (list.length) run(list);
  }

  // --- captions
  if (options.captions !== false) {
    const style = { highlightColor: kit.colors.accent ?? kit.colors.primary, ...(kit.captions ?? {}) };
    const list = Object.values(state().clips)
      .filter(isCaptionClip)
      .map((c) => ({ type: "clip/set-property", payload: { clipId: c.id, style } }));
    if (list.length) run(list);
  }

  // --- intro / outro (content moves right to make room for the intro)
  const contentEnd = () => Math.max(0, ...Object.values(state().clips).map((c) => c.startUs + c.durationUs));
  const bookend = (which: "intro" | "outro") => {
    const def = kit[which];
    if (!def || options[which] === false) return;
    // Applying a kit twice keeps the first intro/outro (remove the clip to replace it).
    if (state().clips[`brand-${which}`]) return;
    const block = resolve(def.block ?? (which === "intro" ? "intro-logo-reveal" : "outro-cta"));
    if (!block) throw new Error(`no block "${def.block}" for the ${which}`);
    const fieldKeys = new Set(block.fields.map((f) => f.key));
    const values: Record<string, string | number | boolean> = {};
    const fill = (key: string, value: string | undefined) => {
      if (value !== undefined && fieldKeys.has(key)) values[key] = value;
    };
    fill("brand", kit.name);
    fill("tagline", kit.tagline);
    fill("url", kit.url);
    for (const f of block.fields) if (f.type === "color") fill(f.key, colorFor(kit, f.key));
    Object.assign(values, def.values ?? {});
    const length = def.durationUs ?? (block.content.kind === "html" ? block.content.durationUs : 3_000_000);
    const trackId = `brand-${which}`;
    if (which === "intro") {
      // Push everything (clips and markers) later by the intro's length.
      const later = Object.values(state().clips).sort((a, b) => b.startUs - a.startUs);
      run(later.map((c) => ({ type: "clip/move", payload: { clipId: c.id, startUs: c.startUs + length } })));
      const markers = Object.values(state().markers ?? {}).map((m) => ({ type: "marker/update", payload: { markerId: m.id, timeUs: m.timeUs + length } }));
      if (markers.length) run(markers);
    }
    const startUs = which === "intro" ? 0 : contentEnd();
    run(blockCommands(block, { id: trackId, trackId, createTrack: !state().tracks[trackId], startUs, durationUs: length, composition: { width, height }, values }));
  };
  bookend("intro");
  bookend("outro");

  // --- logo watermark over the content (not over the intro/outro, which carry the brand already)
  if (kit.logo && options.watermark !== false) {
    const logo = kit.logo;
    const introEnd = state().clips["brand-intro"] ? state().clips["brand-intro"]!.durationUs : 0;
    const outroStart = state().clips["brand-outro"]?.startUs ?? contentEnd();
    if (outroStart > introEnd) {
      const lw = logo.width ?? 512;
      const lh = logo.height ?? 512;
      const fit = Math.min(width / lw, height / lh);
      const widthFrac = logo.widthFrac ?? 0.1;
      const scale = (widthFrac * width) / (lw * fit);
      const halfW = (lw * fit * scale) / 2 / width;
      const halfH = (lh * fit * scale) / 2 / height;
      const margin = 0.03;
      const corner = logo.corner ?? "top-right";
      const x = corner.endsWith("right") ? 1 - margin - halfW : margin + halfW;
      const y = corner.startsWith("bottom") ? 1 - margin * (width / height) - halfH : margin * (width / height) + halfH;
      const round = (v: number) => Math.round(v * 1e6) / 1e6;
      if (!state().assets["brand-logo"]) {
        run([{ type: "asset/add", payload: { id: "brand-logo", kind: "image", src: logo.src, name: `${kit.name} logo`, ...(logo.width ? { width: logo.width } : {}), ...(logo.height ? { height: logo.height } : {}) } }]);
      }
      run([
        ...(state().clips["brand-logo"] ? [{ type: "clip/remove", payload: { clipId: "brand-logo" } }] : []),
        ...(state().tracks["brand-logo"] ? [] : [{ type: "track/add", payload: { id: "brand-logo", kind: "video", name: "Logo" } }]),
        {
          type: "clip/add",
          payload: { kind: "image", id: "brand-logo", trackId: "brand-logo", assetId: "brand-logo", startUs: introEnd, durationUs: outroStart - introEnd, transform: { x: round(x), y: round(y), scale: round(scale), opacity: logo.opacity ?? 0.85 } },
        },
      ]);
    }
  }
  return { commands, doc: state() };
}
