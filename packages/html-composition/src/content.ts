/**
 * An html clip's words, colours and type, as data (for translating and rebranding). The
 * markup and its layout are left exactly as they are: only text nodes, colour values and
 * font families change.
 *
 *   const { texts } = htmlTexts(template);           // every visible piece of text, by place
 *   setHtmlTexts(template, [{ id: "e7", index: 0, text: "おはよう" }]);
 *
 *   htmlPalette(template);                           // the colours used, how much, for what
 *   recolorHtml(template, { "#094a9f": "#0b1630" }); // swap colours (alpha kept)
 *
 *   htmlFonts(template);                             // the families used and their largest size
 *   refontHtml(template, { "Alfa Slab One": "Fraunces" });
 */
import type { DefaultTreeAdapterMap } from "parse5";
import { tree } from "./edit.js";
import { isElement, type Node } from "./xml.js";

type TextNode = DefaultTreeAdapterMap["textNode"];

// ---------------------------------------------------------------- text

export interface HtmlText {
  /** The id of the element the text sits directly in ("" at the top level). */
  id: string;
  /** Which of that element's text pieces (0 = the first), counting only non-blank ones. */
  index: number;
  /** The text, trimmed. */
  text: string;
}

const READABLE = /\p{L}/u;

function* textPieces(root: Node): Generator<{ node: TextNode; id: string; index: number }> {
  const visit = function* (parent: Node, id: string): Generator<{ node: TextNode; id: string; index: number }> {
    let index = 0;
    for (const child of tree.childrenOf(parent)) {
      if (child.nodeName === "#text") {
        if (!(child as TextNode).value.trim()) continue;
        yield { node: child as TextNode, id, index: index++ };
      } else if (isElement(child)) {
        // Code and styling aren't words; inline svg is drawn, not read.
        if (tree.RAW_TEXT.has(child.tagName) || child.tagName === "svg" || child.tagName === "template") continue;
        yield* visit(child, tree.idOf(child) ?? id);
      }
    }
  };
  yield* visit(root, "");
}

/**
 * The words a viewer reads in a template, in document order, with where they are (the template
 * comes back stamped with element ids). Pieces with no letters (prices, times, "№ 0042") and
 * `{{param}}` placeholders are left out: params carry their own text.
 */
export function htmlTexts(template: string): { template: string; texts: HtmlText[] } {
  const root = tree.parse(template);
  tree.stamp(root, new Set());
  const texts: HtmlText[] = [];
  for (const { node, id, index } of textPieces(root)) {
    const text = node.value.trim();
    if (!READABLE.test(text) || /\{\{[^}]*\}\}/.test(text)) continue;
    texts.push({ id, index, text });
  }
  return { template: tree.serializeFragment(root), texts };
}

/** Replace pieces of text (as found by `htmlTexts`), keeping the whitespace around each. */
export function setHtmlTexts(template: string, changes: readonly HtmlText[]): string {
  const root = tree.parse(template);
  tree.stamp(root, new Set());
  const want = new Map(changes.map((c) => [`${c.id}#${c.index}`, c.text]));
  for (const { node, id, index } of textPieces(root)) {
    const next = want.get(`${id}#${index}`);
    if (next === undefined) continue;
    const lead = /^\s*/.exec(node.value)?.[0] ?? "";
    const trail = /\s*$/.exec(node.value)?.[0] ?? "";
    node.value = `${lead}${next}${trail}`;
  }
  return tree.serializeFragment(root);
}

// ---------------------------------------------------------------- CSS walking

/** Calls `fn` on every piece of CSS in the template (style attributes, <style> blocks); `fn` returns it rewritten. */
function mapCss(template: string, fn: (css: string) => string): string {
  const root = tree.parse(template);
  const visit = (node: Node) => {
    for (const child of tree.childrenOf(node)) {
      if (!isElement(child)) continue;
      const style = child.attrs.find((a) => a.name === "style");
      if (style) style.value = fn(style.value);
      if (child.tagName === "style") {
        for (const t of tree.childrenOf(child)) if (t.nodeName === "#text") (t as TextNode).value = fn((t as TextNode).value);
      }
      // svg fill/stroke attributes are colours too.
      for (const a of child.attrs) if ((a.name === "fill" || a.name === "stroke" || a.name === "stop-color" || a.name === "color") && a.value) a.value = fn(`${a.name}:${a.value}`).replace(/^[\w-]+:/, "");
      visit(child.tagName === "template" && "content" in child ? (child.content as unknown as Node) : child);
    }
  };
  visit(root);
  return tree.serializeFragment(root);
}

/** Declarations in some CSS, with the block they belong to (to pair a family with its size). */
function* declarations(css: string): Generator<{ block: number; prop: string; value: string }> {
  let block = 0;
  for (const part of css.split(/([{}])/)) {
    if (part === "{" || part === "}") {
      block++;
      continue;
    }
    for (const decl of part.split(/;(?![^(]*\))/)) {
      const colon = decl.indexOf(":");
      if (colon < 0) continue;
      const prop = decl.slice(0, colon).trim().toLowerCase();
      if (!/^[\w-]+$/.test(prop)) continue;
      yield { block, prop, value: decl.slice(colon + 1).trim() };
    }
  }
}

// ---------------------------------------------------------------- colours

const COLOR = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b|rgba?\(\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?\s*(?:,\s*[\d.]+%?\s*)?\)/gi;

/** "#abc", "#aabbccdd", "rgb(…)" → "#aabbcc" (alpha set aside). */
export function hexColor(value: string): string | null {
  const v = value.trim().toLowerCase();
  const h = /^#([0-9a-f]{3,8})$/.exec(v)?.[1];
  if (h) {
    if (h.length === 3 || h.length === 4) return `#${[...h.slice(0, 3)].map((c) => c + c).join("")}`;
    if (h.length === 6 || h.length === 8) return `#${h.slice(0, 6)}`;
    return null;
  }
  const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/.exec(v);
  if (!m) return null;
  return `#${[m[1], m[2], m[3]].map((n) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, "0")).join("")}`;
}

export interface HtmlColor {
  /** #rrggbb. */
  color: string;
  /** How many declarations use it, by what for. */
  text: number;
  fill: number;
  line: number;
}

const roleOf = (prop: string): "text" | "fill" | "line" =>
  prop === "color" || prop.includes("text-fill") || prop === "caret-color"
    ? "text"
    : /^(background|fill|stop-color)/.test(prop)
      ? "fill"
      : "line";

/** The colours a template uses, most used first, and what for (text, fills, lines and shadows). */
export function htmlPalette(template: string): HtmlColor[] {
  const found = new Map<string, HtmlColor>();
  mapCss(template, (css) => {
    for (const { prop, value } of declarations(css)) {
      for (const m of value.matchAll(COLOR)) {
        const color = hexColor(m[0]);
        if (!color) continue;
        const entry = found.get(color) ?? { color, text: 0, fill: 0, line: 0 };
        entry[roleOf(prop)]++;
        found.set(color, entry);
      }
    }
    return css;
  });
  const total = (c: HtmlColor) => c.text + c.fill + c.line;
  return [...found.values()].sort((a, b) => total(b) - total(a));
}

/** Swap colours (keys and values as #rrggbb; any spelling of a key matches; alpha is kept). */
export function recolorHtml(template: string, map: Readonly<Record<string, string>>): string {
  const swap = new Map(Object.entries(map).map(([k, v]) => [hexColor(k) ?? k.toLowerCase(), hexColor(v) ?? v]));
  if (!swap.size) return template;
  return mapCss(template, (css) =>
    css.replace(COLOR, (match) => {
      const to = swap.get(hexColor(match) ?? "");
      if (!to) return match;
      const alpha = /^rgba\([^)]*,\s*([\d.]+%?)\s*\)$/i.exec(match)?.[1] ?? (/^#[0-9a-f]{8}$/i.test(match) ? match.slice(7) : undefined);
      if (alpha === undefined) return to;
      if (match.startsWith("#")) return `${to}${alpha}`;
      const n = Number.parseInt(to.slice(1), 16);
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
    }),
  );
}

// ---------------------------------------------------------------- type

export interface HtmlFont {
  family: string;
  /** The largest font-size (px) set beside it, when one is. */
  largestPx: number | null;
  uses: number;
}

const firstFamily = (stack: string) => (stack.split(",")[0] ?? "").trim().replace(/^['"]|['"]$/g, "").trim();
const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[\w-]+|emoji|math|inherit|initial|unset)$/i;

/** The families a template names (first of each stack), with the largest size each is set at. */
export function htmlFonts(template: string): HtmlFont[] {
  const found = new Map<string, HtmlFont>();
  mapCss(template, (css) => {
    const blocks = new Map<number, { family?: string; size?: number }>();
    for (const { block, prop, value } of declarations(css)) {
      const b = blocks.get(block) ?? {};
      if (prop === "font-family") b.family = firstFamily(value);
      else if (prop === "font-size") {
        const px = /^([\d.]+)px$/.exec(value)?.[1];
        if (px) b.size = Number(px);
      } else if (prop === "font") {
        const m = /([\d.]+)px(?:\/[\d.]+\w*)?\s+(.+)$/.exec(value);
        if (m) {
          b.size = Number(m[1]);
          b.family = firstFamily(m[2] ?? "");
        }
      }
      blocks.set(block, b);
    }
    for (const { family, size } of blocks.values()) {
      if (!family || GENERIC.test(family)) continue;
      const entry = found.get(family) ?? { family, largestPx: null, uses: 0 };
      entry.uses++;
      if (size !== undefined) entry.largestPx = Math.max(entry.largestPx ?? 0, size);
      found.set(family, entry);
    }
    return css;
  });
  return [...found.values()].sort((a, b) => (b.largestPx ?? 0) - (a.largestPx ?? 0) || b.uses - a.uses);
}

/** Swap font families (the first family of each stack; fallbacks after it stay). */
export function refontHtml(template: string, map: Readonly<Record<string, string>>): string {
  const swap = new Map(Object.entries(map).map(([k, v]) => [k.toLowerCase(), v]));
  if (!swap.size) return template;
  const rewrite = (stack: string) => {
    const [head = "", ...rest] = stack.split(",");
    const to = swap.get(firstFamily(head).toLowerCase());
    if (!to) return stack;
    const quoted = `'${to.replace(/'/g, "\\'")}'`;
    return [quoted, ...rest.map((r) => r.trim())].join(", ");
  };
  return mapCss(template, (css) =>
    css
      .replace(/(font-family\s*:\s*)([^;}]+)/gi, (_m, p: string, stack: string) => `${p}${rewrite(stack.trim())}`)
      .replace(/(\bfont\s*:\s*[^;}]*?[\d.]+px(?:\/[\d.]+\w*)?\s+)([^;}]+)/gi, (_m, p: string, stack: string) => `${p}${rewrite(stack.trim())}`),
  );
}
