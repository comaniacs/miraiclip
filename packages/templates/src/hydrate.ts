/**
 * Hydration: template + data → a fresh, fully-concrete ProjectDocument.
 * Pure and deterministic — same inputs, same document, no I/O, no probing —
 * which is what makes a template a render farm's unit of work and an agent's
 * safe tool. The binding surface is content-only (text, caption words, html
 * params, asset src), so hydration cannot produce a structurally invalid
 * document.
 */
import {
  isCaptionClip,
  isHtmlClip,
  isTextClip,
  type ProjectDocument,
} from "@miraiclip/core";
import { PLACEHOLDER } from "./scan.js";
import {
  TemplateValidationError,
  type AssetValue,
  type HydrateResult,
  type Template,
  type TemplateData,
  type TemplateField,
  type TemplateIssue,
  type TemplateValue,
} from "./types.js";

type Resolved = Map<string, TemplateValue>;

function checkValue(field: TemplateField, value: TemplateValue, issues: TemplateIssue[]): void {
  const path = `data.${field.name}`;
  switch (field.type) {
    case "text": {
      if (typeof value !== "string") {
        issues.push({ path, message: `expected a string, got ${typeof value}` });
        return;
      }
      if (field.maxLength !== undefined && value.length > field.maxLength) {
        issues.push({ path, message: `longer than maxLength ${field.maxLength}` });
      }
      if (field.pattern !== undefined && !new RegExp(field.pattern).test(value)) {
        issues.push({ path, message: `does not match pattern ${field.pattern}` });
      }
      if (field.enum !== undefined && !field.enum.includes(value)) {
        issues.push({ path, message: `must be one of: ${field.enum.join(", ")}` });
      }
      return;
    }
    case "number": {
      if (typeof value !== "number" || Number.isNaN(value)) {
        issues.push({ path, message: `expected a number, got ${typeof value}` });
        return;
      }
      if (field.integer && !Number.isInteger(value)) {
        issues.push({ path, message: "expected an integer" });
      }
      if (field.min !== undefined && value < field.min) {
        issues.push({ path, message: `below min ${field.min}` });
      }
      if (field.max !== undefined && value > field.max) {
        issues.push({ path, message: `above max ${field.max}` });
      }
      return;
    }
    case "boolean": {
      if (typeof value !== "boolean") {
        issues.push({ path, message: `expected a boolean, got ${typeof value}` });
      }
      return;
    }
    case "color": {
      if (typeof value !== "string" || value.trim() === "") {
        issues.push({ path, message: "expected a CSS color string" });
      }
      return;
    }
    case "asset": {
      const src = typeof value === "string" ? value : (value as { src?: unknown })?.src;
      if (typeof src !== "string" || src === "") {
        issues.push({ path, message: `expected a source string or { src, durationUs? }` });
      }
      return;
    }
  }
}

/** Validate a payload against the template's fields; returns resolved values with defaults applied. */
export function validateData(
  template: Template,
  data: TemplateData,
): { resolved: Resolved; issues: TemplateIssue[] } {
  const issues: TemplateIssue[] = [];
  const resolved: Resolved = new Map();
  const known = new Set(template.fields.map((field) => field.name));

  for (const key of Object.keys(data)) {
    if (!known.has(key)) {
      issues.push({ path: `data.${key}`, message: "unknown field" });
    }
  }
  for (const field of template.fields) {
    const provided = data[field.name];
    if (provided === undefined) {
      if (field.default !== undefined) {
        resolved.set(field.name, field.default);
      } else if (field.required !== false) {
        issues.push({ path: `data.${field.name}`, message: "required field is missing" });
      }
      continue;
    }
    checkValue(field, provided, issues);
    resolved.set(field.name, provided);
  }
  return { resolved, issues };
}

function substitute(value: string, resolved: Resolved): string {
  return value.replace(PLACEHOLDER, (whole, name: string) => {
    const bound = resolved.get(name);
    return bound === undefined ? whole : String(bound);
  });
}

/** A whole-value placeholder binds TYPED into html params (numbers stay numbers). */
function substituteParamValue(
  value: string,
  resolved: Resolved,
): string | number | boolean {
  const whole = /^\{\{\s*([\w.-]+)\s*\}\}$/.exec(value.trim());
  if (whole) {
    const bound = resolved.get(whole[1]!);
    if (typeof bound === "number" || typeof bound === "boolean") return bound;
  }
  return substitute(value, resolved);
}

/**
 * Hydrate: validate the payload, then return a NEW document with every blank
 * filled. The template is never mutated. Throws `TemplateValidationError` on
 * a bad payload; `tryHydrate` is the non-throwing variant.
 */
export function hydrate(template: Template, data: TemplateData): ProjectDocument {
  const result = tryHydrate(template, data);
  if (!result.ok) throw new TemplateValidationError(result.issues);
  return result.doc;
}

/** Hydrate with machine-readable failures (the `tryDispatch` of templates). */
export function tryHydrate(template: Template, data: TemplateData): HydrateResult {
  const { resolved, issues } = validateData(template, data);
  if (issues.length > 0) return { ok: false, issues };

  const doc = structuredClone(template.doc);

  for (const clip of Object.values(doc.clips)) {
    if (isTextClip(clip)) {
      clip.text = substitute(clip.text, resolved);
    } else if (isCaptionClip(clip)) {
      for (const word of clip.words) word.text = substitute(word.text, resolved);
    } else if (isHtmlClip(clip)) {
      for (const key of Object.keys(clip.params)) {
        const value = clip.params[key];
        if (typeof value === "string") clip.params[key] = substituteParamValue(value, resolved);
      }
    }
  }

  for (const field of template.fields) {
    if (field.type !== "asset") continue;
    const value = resolved.get(field.name) as AssetValue | undefined;
    if (value === undefined) continue; // optional slot left as authored
    const asset = doc.assets[field.assetId];
    if (!asset) continue; // defineTemplate/parseTemplate guarantee existence
    if (typeof value === "string") {
      asset.src = value;
    } else {
      asset.src = value.src;
      if (value.durationUs !== undefined) asset.durationUs = value.durationUs;
    }
  }

  return { ok: true, doc };
}
