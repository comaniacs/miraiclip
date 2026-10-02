/**
 * Templates from finished projects: point at what should stay editable and
 * get a template back. `suggestTemplateFields` lists the candidates an editor
 * shows as checkboxes (every text, every designed-text param, every piece of
 * footage); `templateFromDocument` turns the chosen ones into fields whose
 * defaults are the current values, so the template hydrates with no data to
 * exactly the project it came from.
 */
import { isHtmlClip, isTextClip, type ProjectDocument } from "@miraiclip/core";
import { defineTemplate } from "./define.js";
import type { Template, TemplateField } from "./types.js";

/** Something in a document that can become a template field. */
export type TemplateCandidate =
  | { kind: "text"; name: string; label: string; clipId: string; value: string }
  | { kind: "param"; name: string; label: string; clipId: string; param: string; value: string; color: boolean }
  | { kind: "asset"; name: string; label: string; assetId: string; assetKind: "video" | "image" | "audio"; value: string };

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|[a-z]+$)/i;
const COLOR_KEY = /colou?r|bg|fg|background|foreground|accent|fill|stroke|ink|tint/i;
const NAMED_COLORS = new Set(["black", "white", "red", "green", "blue", "yellow", "orange", "purple", "pink", "gray", "grey", "transparent"]);

function looksLikeColor(key: string, value: string): boolean {
  if (/^#[0-9a-f]{3,8}$/i.test(value) || /^(rgb|hsl)a?\(/i.test(value)) return true;
  return COLOR_KEY.test(key) && COLOR.test(value) && (value.startsWith("#") || NAMED_COLORS.has(value.toLowerCase()));
}

const short = (text: string, max = 28) => {
  const one = text.replace(/\s+/g, " ").trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
};

function slug(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 3);
  return words.length ? words.join("_") : "field";
}

/** Readable labels for html params ("headline" → "Headline", "accentColor" → "Accent color"). */
function humanize(key: string): string {
  const spaced = key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Every place in the document that could be a field, in timeline order:
 * text clips, string params of html clips (designed text, backgrounds;
 * params starting with "_" are bookkeeping and skipped), and video / image /
 * audio assets used by clips (media slots). Names are unique and stable for
 * the same document.
 */
export function suggestTemplateFields(doc: ProjectDocument): TemplateCandidate[] {
  const out: TemplateCandidate[] = [];
  const taken = new Set<string>();
  const unique = (base: string) => {
    let name = base;
    for (let i = 2; taken.has(name); i++) name = `${base}_${i}`;
    taken.add(name);
    return name;
  };

  const clips = Object.values(doc.clips).sort((a, b) => a.startUs - b.startUs || doc.trackOrder.indexOf(b.trackId) - doc.trackOrder.indexOf(a.trackId));
  for (const clip of clips) {
    if (isTextClip(clip)) {
      if (!clip.text.trim() || /\{\{/.test(clip.text)) continue;
      out.push({ kind: "text", name: unique(slug(clip.text)), label: `Text "${short(clip.text)}"`, clipId: clip.id, value: clip.text });
    } else if (isHtmlClip(clip)) {
      // Colors are named after the clip's first text ("Accent · Jordan Lee"), not its id.
      const firstText = Object.entries(clip.params).find(([k, v]) => !k.startsWith("_") && typeof v === "string" && v.trim() && !looksLikeColor(k, v))?.[1] as string | undefined;
      for (const [param, value] of Object.entries(clip.params)) {
        if (param.startsWith("_") || typeof value !== "string" || !value.trim() || /\{\{/.test(value)) continue;
        if (!new RegExp(`\\{\\{\\s*${param.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`).test(clip.template)) continue; // unused param
        const color = looksLikeColor(param, value);
        out.push({
          kind: "param",
          name: unique(color ? slug(`${param}`) : slug(value)),
          label: color ? `${humanize(param)} · ${firstText ? short(firstText, 20) : clip.id}` : `${humanize(param)} "${short(value)}"`,
          clipId: clip.id,
          param,
          value,
          color,
        });
      }
    }
  }

  const used = new Set(Object.values(doc.clips).map((c) => (c as { assetId?: string }).assetId).filter(Boolean));
  const firstUse = (assetId: string) => Math.min(...Object.values(doc.clips).filter((c) => (c as { assetId?: string }).assetId === assetId).map((c) => c.startUs));
  const media = Object.values(doc.assets)
    .filter((a) => (a.kind === "video" || a.kind === "image" || a.kind === "audio") && used.has(a.id))
    .sort((a, b) => firstUse(a.id) - firstUse(b.id));
  const counts: Record<string, number> = {};
  for (const asset of media) {
    const kind = asset.kind as "video" | "image" | "audio";
    counts[kind] = (counts[kind] ?? 0) + 1;
    const word = kind === "audio" ? "music" : kind;
    out.push({
      kind: "asset",
      name: unique(counts[kind] === 1 ? word : `${word}_${counts[kind]}`),
      label: `${kind === "audio" ? "Audio" : kind === "video" ? "Video" : "Image"} "${short(asset.name ?? asset.src.split("/").pop() ?? asset.id)}"`,
      assetId: asset.id,
      assetKind: kind,
      value: asset.src,
    });
  }
  return out;
}

export interface TemplateFromDocumentOptions {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  thumbnail?: string;
  /**
   * The candidates to turn into fields (from `suggestTemplateFields`, with
   * `name` / `label` edited as you like). Default: all of them.
   */
  fields?: TemplateCandidate[];
}

/**
 * Make a template from a document: each chosen candidate becomes an optional
 * field defaulting to its current value (a `{{name}}` placeholder in the
 * text or param; asset fields swap the asset's src). The document is not
 * modified. Hydrating the result with `{}` gives back the original content.
 */
export function templateFromDocument(doc: ProjectDocument, options: TemplateFromDocumentOptions): Template {
  const picked = options.fields ?? suggestTemplateFields(doc);
  const copy = structuredClone(doc);
  const fields: TemplateField[] = [];
  for (const c of picked) {
    const label = c.label ? { label: c.label } : {};
    if (c.kind === "text") {
      const clip = copy.clips[c.clipId];
      if (!clip || !isTextClip(clip)) continue;
      clip.text = `{{${c.name}}}`;
      fields.push({ type: "text", name: c.name, ...label, default: c.value, required: false });
    } else if (c.kind === "param") {
      const clip = copy.clips[c.clipId];
      if (!clip || !isHtmlClip(clip)) continue;
      clip.params[c.param] = `{{${c.name}}}`;
      fields.push(c.color ? { type: "color", name: c.name, ...label, default: c.value, required: false } : { type: "text", name: c.name, ...label, default: c.value, required: false });
    } else {
      if (!copy.assets[c.assetId]) continue;
      fields.push({ type: "asset", name: c.name, ...label, assetId: c.assetId, default: c.value, required: false });
    }
  }
  if (options.name) copy.settings = { ...copy.settings, name: options.name } as typeof copy.settings;
  return defineTemplate({
    name: options.name,
    ...(options.description !== undefined ? { description: options.description } : {}),
    ...(options.category !== undefined ? { category: options.category } : {}),
    ...(options.tags !== undefined ? { tags: options.tags } : {}),
    ...(options.thumbnail !== undefined ? { thumbnail: options.thumbnail } : {}),
    doc: copy,
    fields,
  });
}
