/**
 * localizeProject: one translated variant of a project per language. It
 * finds every string a viewer sees (text clips, captions, html block text,
 * marker labels, the project name) and the narration script, translates
 * them in one batch, and returns the variant document plus the commands
 * that produce it. Re-voice the translated script with
 * `synthesizeNarration` + `alignNarration` (from the un-narrated project)
 * to finish a language.
 */
import { applyCommands, createProject, isCaptionClip, isHtmlClip, isTextClip, retimeWords, type ProjectDocument } from "@miraiclip/core";
import type { TranslateOptions, Translator } from "./translators.js";

export interface Command {
  type: string;
  payload: Record<string, unknown>;
}

export interface TextUnit {
  /** Stable key: what and where. */
  key: string;
  kind: "text" | "caption" | "html-param" | "marker" | "project-name" | "script";
  text: string;
  clipId?: string;
  param?: string;
  markerId?: string;
  segmentId?: string;
}

export interface CollectOptions {
  /** Which html params are viewer-facing text (default: string params that read like words; see `isTextParam`). */
  htmlParam?: (key: string, value: string, clipId: string) => boolean;
  /** Translate marker labels (default true: they become chapter names). */
  markers?: boolean;
  /** Clips to leave alone (logos, code, names). */
  skipClipIds?: string[];
}

const NON_TEXT_KEY = /(^|[-_])(color|colour|bg|background|ink|fill|stroke|font|family|size|width|height|url|href|src|image|logo|icon|side|align|position|id|class|style|easing|n)$/i;

/** The default test for html params: words, not colours, URLs, numbers or settings. */
export function isTextParam(key: string, value: string): boolean {
  if (NON_TEXT_KEY.test(key)) return false;
  const v = value.trim();
  if (!v || !/\p{L}/u.test(v)) return false;
  if (/^(#|rgb|hsl)/i.test(v) || /^[a-z]+:\/\//i.test(v) || /^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v)) return false;
  return true;
}

/** Everything a viewer reads, in a stable order. */
export function collectText(doc: ProjectDocument, options: CollectOptions = {}): TextUnit[] {
  const skip = new Set(options.skipClipIds ?? []);
  const units: TextUnit[] = [];
  if (doc.settings.name) units.push({ key: "project:name", kind: "project-name", text: doc.settings.name });
  const clips = Object.values(doc.clips).sort((a, b) => a.startUs - b.startUs || a.id.localeCompare(b.id));
  for (const clip of clips) {
    if (skip.has(clip.id)) continue;
    if (isTextClip(clip) && clip.text.trim()) units.push({ key: `text:${clip.id}`, kind: "text", text: clip.text, clipId: clip.id });
    else if (isCaptionClip(clip)) units.push({ key: `caption:${clip.id}`, kind: "caption", text: clip.words.map((w) => w.text).join(" "), clipId: clip.id });
    else if (isHtmlClip(clip)) {
      for (const [param, value] of Object.entries(clip.params)) {
        if (typeof value !== "string") continue;
        if (!(options.htmlParam ?? isTextParam)(param, value, clip.id)) continue;
        units.push({ key: `html:${clip.id}:${param}`, kind: "html-param", text: value, clipId: clip.id, param });
      }
    }
  }
  if (options.markers !== false) {
    for (const m of Object.values(doc.markers ?? {}).sort((a, b) => a.timeUs - b.timeUs)) {
      if (m.label.trim()) units.push({ key: `marker:${m.id}`, kind: "marker", text: m.label, markerId: m.id });
    }
  }
  return units;
}

/** Commands that write translated units back (captions keep their word timing when the word count matches, else spread evenly). */
export function applyTextCommands(doc: ProjectDocument, units: readonly TextUnit[], translated: readonly string[]): Command[] {
  const commands: Command[] = [];
  const params = new Map<string, Record<string, string>>();
  units.forEach((u, i) => {
    const text = translated[i] ?? u.text;
    if (text === u.text) return;
    if (u.kind === "text") commands.push({ type: "clip/set-property", payload: { clipId: u.clipId!, text } });
    else if (u.kind === "caption") {
      const clip = doc.clips[u.clipId!];
      if (clip && isCaptionClip(clip)) {
        const words = retimeWords(clip.words, text, clip.durationUs);
        if (words.length) commands.push({ type: "clip/set-property", payload: { clipId: u.clipId!, words } });
      }
    } else if (u.kind === "html-param") {
      const p = params.get(u.clipId!) ?? {};
      p[u.param!] = text;
      params.set(u.clipId!, p);
    } else if (u.kind === "marker") commands.push({ type: "marker/update", payload: { markerId: u.markerId!, label: text } });
    else if (u.kind === "project-name") commands.push({ type: "project/set-settings", payload: { name: text } });
  });
  for (const [clipId, p] of params) commands.push({ type: "clip/set-property", payload: { clipId, params: p } });
  return commands;
}

export interface LocalizeOptions extends Omit<TranslateOptions, "to">, CollectOptions {
  to: string;
  /** A narration script to translate alongside (its lines come back in `script`). */
  script?: { language?: string; segments: { id: string; text: string }[] };
  /** Suffix for the project name (default " (<lang>)"; "" for none). */
  nameSuffix?: string;
}

export interface LocalizedProject<S> {
  language: string;
  doc: ProjectDocument;
  commands: Command[];
  units: TextUnit[];
  translations: string[];
  /** The translated script (re-voice it with synthesizeNarration + alignNarration). */
  script?: S;
}

export async function localizeProject<S extends { language?: string; segments: { id: string; text: string }[] }>(
  doc: ProjectDocument,
  translator: Translator,
  options: LocalizeOptions & { script?: S },
): Promise<LocalizedProject<S>> {
  const units = collectText(doc, options);
  const script = options.script;
  const scriptUnits: TextUnit[] = (script?.segments ?? []).map((s) => ({ key: `script:${s.id}`, kind: "script", text: s.text, segmentId: s.id }));
  const all = [...units, ...scriptUnits];
  const translations = all.length
    ? await translator.translate(
        all.map((u) => u.text),
        { to: options.to, ...(options.from ? { from: options.from } : {}), ...(options.context ? { context: options.context } : {}), ...(options.keep ? { keep: options.keep } : {}), ...(options.signal ? { signal: options.signal } : {}) },
      )
    : [];
  if (translations.length !== all.length) throw new Error(`${translator.id} returned ${translations.length} translations for ${all.length} texts`);
  const docTranslations = translations.slice(0, units.length);
  const commands = applyTextCommands(doc, units, docTranslations);
  const suffix = options.nameSuffix ?? ` (${options.to})`;
  if (suffix) {
    const nameIndex = units.findIndex((u) => u.kind === "project-name");
    const base = nameIndex >= 0 ? docTranslations[nameIndex]! : doc.settings.name;
    if (base) {
      const named = commands.filter((c) => c.type !== "project/set-settings");
      commands.length = 0;
      commands.push(...named, { type: "project/set-settings", payload: { name: `${base}${suffix}` } });
    }
  }
  const p = createProject(structuredClone(doc), { historyLimit: 1 });
  const r = applyCommands(p, commands);
  if (!r.ok) throw new Error(`localize: ${JSON.stringify(r.error)}`);
  const result: LocalizedProject<S> = { language: options.to, doc: p.getState().doc, commands, units, translations: docTranslations };
  if (script) {
    const lines = translations.slice(units.length);
    result.script = { ...script, language: options.to, segments: script.segments.map((s, i) => ({ ...s, text: lines[i] ?? s.text })) };
  }
  return result;
}

/** Several languages at once (in parallel, `concurrency` at a time). */
export async function localizeMany<S extends { language?: string; segments: { id: string; text: string }[] }>(
  doc: ProjectDocument,
  translator: Translator,
  languages: string[],
  options: Omit<LocalizeOptions, "to"> & { script?: S; concurrency?: number } = {},
): Promise<Record<string, LocalizedProject<S>>> {
  const out: Record<string, LocalizedProject<S>> = {};
  let next = 0;
  const worker = async () => {
    while (next < languages.length) {
      const lang = languages[next++]!;
      out[lang] = await localizeProject(doc, translator, { ...options, to: lang });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(options.concurrency ?? 3, languages.length)) }, worker));
  return out;
}
