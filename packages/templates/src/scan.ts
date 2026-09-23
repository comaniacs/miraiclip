/**
 * Placeholder scanning: where `{{field}}` may appear in a document, and what
 * a document's placeholders are. The binding surface is deliberately small
 * and safe — sites whose values are CONTENT, never structure:
 *
 * - text clip `text`
 * - caption word `text`
 * - html clip `params` STRING values
 *
 * An html clip's `template` is NOT a site: its own `{{param}}` placeholders
 * belong to the clip's params and are consumed by the rasterizer — template
 * fields bind through the clip's params instead. Asset fields don't use
 * placeholders at all; they name an asset id.
 */
import {
  isCaptionClip,
  isHtmlClip,
  isTextClip,
  type ProjectDocument,
} from "@miraiclip/core";
import type { TemplateField } from "./types.js";

/** Same placeholder grammar as html-clip params: `{{name}}`, `\w.-` names. */
export const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g;

export interface PlaceholderSite {
  /** The placeholder's field name. */
  name: string;
  /** Where it was found: "clips.intro.text", "clips.card.params.title". */
  path: string;
  /** True when the site's WHOLE value is one placeholder (typed binding). */
  whole: boolean;
}

function sitesIn(value: string, path: string): PlaceholderSite[] {
  const found: PlaceholderSite[] = [];
  const whole = /^\{\{\s*([\w.-]+)\s*\}\}$/.exec(value.trim());
  for (const match of value.matchAll(PLACEHOLDER)) {
    found.push({ name: match[1]!, path, whole: whole !== null });
  }
  return found;
}

/** Every placeholder site in the document, in a stable order. */
export function scanPlaceholders(doc: ProjectDocument): PlaceholderSite[] {
  const sites: PlaceholderSite[] = [];
  for (const clipId of Object.keys(doc.clips).sort()) {
    const clip = doc.clips[clipId]!;
    if (isTextClip(clip)) {
      sites.push(...sitesIn(clip.text, `clips.${clipId}.text`));
    } else if (isCaptionClip(clip)) {
      clip.words.forEach((word, index) => {
        sites.push(...sitesIn(word.text, `clips.${clipId}.words.${index}.text`));
      });
    } else if (isHtmlClip(clip)) {
      for (const key of Object.keys(clip.params).sort()) {
        const value = clip.params[key];
        if (typeof value === "string") {
          sites.push(...sitesIn(value, `clips.${clipId}.params.${key}`));
        }
      }
    }
  }
  return sites;
}

/**
 * Authoring aid: scan a document and propose its field list — one `text`
 * field per distinct placeholder (refine types by hand: numbers, colors,
 * enums), plus nothing for assets, which are declared intentionally.
 */
export function extractFields(doc: ProjectDocument): TemplateField[] {
  const names = [...new Set(scanPlaceholders(doc).map((site) => site.name))].sort();
  return names.map((name) => ({ name, type: "text", required: true }));
}
