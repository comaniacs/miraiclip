/**
 * Editable html clips: every element of an html clip's template gets a
 * stable id (`data-mc`), so people and assistants can change one element at
 * a time (its text, its inline style, its attributes, its place) without
 * rewriting the markup. Edits are planned into an ordinary command
 * (`clip/set-property` with the new `template`), so undo, history and sync
 * work as for any other edit.
 *
 *   const { elements } = describeHtml(clip.template);       // ids, text, style
 *   const commands = planHtmlEdit(doc, clip.id, [
 *     { op: "text", id: "e7", text: "9.00" },
 *     { op: "style", id: "e3", set: { color: "#c0392b", left: "120px" } },
 *     { op: "move", id: "e9", ref: "e2", position: "before" },
 *   ]);
 *   project.transaction(() => commands.forEach((c) => project.dispatch(c)));
 *
 * Ids are stamped in document order, so stamping an unstamped template twice
 * gives the same ids: an outline read from a template and an edit planned on
 * it agree even before the stamped markup is stored. The markup is written
 * back well-formed (the rasterizer parses it as XML); `<script>` and `<style>`
 * text is kept as written. Inline `<svg>` is one element: its insides are
 * edited as markup (`html`), not one id per shape.
 *
 * `cleanHtml` makes markup from an untrusted author (a model, a paste) safe
 * to store: no event handlers, no `javascript:`, no external fetches, no
 * frames, and no scripts unless the clip is meant to run them.
 */
import { parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { isElement, type Element, type Node, type ParentNode } from "./xml.js";

type TextNode = DefaultTreeAdapterMap["textNode"];
type CommentNode = DefaultTreeAdapterMap["commentNode"];
type Fragment = DefaultTreeAdapterMap["documentFragment"];

/** The attribute that carries an element's id. */
export const HTML_ID_ATTR = "data-mc";

const NO_ID = new Set(["script", "style", "template", "head", "title", "meta", "link", "base", "br", "wbr"]);
const RAW_TEXT = new Set(["script", "style"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

// ---------------------------------------------------------------- errors

export type HtmlEditErrorCode =
  | "not-found"
  | "has-children"
  | "bad-html"
  | "forbidden-attr"
  | "invalid-move"
  | "not-html-clip"
  | "bad-op";

export class HtmlEditError extends Error {
  readonly code: HtmlEditErrorCode;
  /** Index of the failing operation, when one failed. */
  readonly index: number | undefined;
  constructor(code: HtmlEditErrorCode, message: string, index?: number) {
    super(message);
    this.name = "HtmlEditError";
    this.code = code;
    this.index = index;
  }
}

// ---------------------------------------------------------------- tree helpers

const parse = (markup: string): Fragment => parseFragment(markup) as Fragment;

const attr = (el: Element, name: string) => el.attrs.find((a) => a.name === name)?.value;

function setAttr(el: Element, name: string, value: string | null): void {
  const i = el.attrs.findIndex((a) => a.name === name);
  if (value === null) {
    if (i >= 0) el.attrs.splice(i, 1);
  } else if (i >= 0) el.attrs[i] = { ...el.attrs[i]!, value };
  else el.attrs.push({ name, value });
}

const childrenOf = (node: Node): Node[] =>
  "childNodes" in node ? (node.childNodes as Node[]) : [];

/** Elements in document order with their parent; svg insides and raw-text elements are skipped. */
function* elements(node: Node, parent: Element | null = null): Generator<{ el: Element; parent: Element | null }> {
  for (const child of childrenOf(node)) {
    if (!isElement(child)) continue;
    yield { el: child, parent };
    if (child.tagName === "svg" || RAW_TEXT.has(child.tagName) || child.tagName === "template") continue;
    yield* elements(child, child);
  }
}

const idOf = (el: Element) => attr(el, HTML_ID_ATTR);

function stamp(root: Node, taken: Set<string>): string[] {
  // Fresh ids never reuse one that is in use anywhere: here, or later in this tree.
  const present = new Set([...taken, ...allIds(root)]);
  let next = 1;
  for (const id of present) {
    const m = /^e(\d+)$/.exec(id);
    if (m) next = Math.max(next, Number(m[1]) + 1);
  }
  const created: string[] = [];
  for (const { el } of elements(root)) {
    if (NO_ID.has(el.tagName)) continue;
    const id = idOf(el);
    if (id && !taken.has(id)) {
      taken.add(id);
      continue;
    }
    // Missing or a duplicate (a pasted copy): give it a fresh one.
    while (present.has(`e${next}`)) next++;
    const fresh = `e${next++}`;
    present.add(fresh);
    setAttr(el, HTML_ID_ATTR, fresh);
    taken.add(fresh);
    created.push(fresh);
  }
  return created;
}

/** Every id already in the tree (used before stamping new markup into it). */
function allIds(root: Node): Set<string> {
  const ids = new Set<string>();
  for (const { el } of elements(root)) {
    const id = idOf(el);
    if (id) ids.add(id);
  }
  return ids;
}

function find(root: Node, id: string, index?: number): { el: Element; parent: ParentNode } {
  for (const { el } of elements(root)) {
    if (idOf(el) === id) return { el, parent: el.parentNode as ParentNode };
  }
  throw new HtmlEditError("not-found", `no element with id "${id}"`, index);
}

function detach(node: Node): void {
  const parent = (node as { parentNode?: ParentNode | null }).parentNode;
  if (!parent) return;
  const list = parent.childNodes as Node[];
  const i = list.indexOf(node);
  if (i >= 0) list.splice(i, 1);
  (node as { parentNode: ParentNode | null }).parentNode = null;
}

function insertAt(parent: ParentNode, index: number, nodes: Node[]): void {
  for (const n of nodes) (n as { parentNode: ParentNode | null }).parentNode = parent;
  (parent.childNodes as Node[]).splice(index, 0, ...nodes);
}

function textNode(value: string, parent: ParentNode): TextNode {
  return { nodeName: "#text", value, parentNode: parent } as TextNode;
}

// ---------------------------------------------------------------- serializing

const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, "&quot;");

function serialize(node: Node, rawParent = false): string {
  if (node.nodeName === "#text") {
    const value = (node as TextNode).value;
    return rawParent ? value : escapeText(value);
  }
  if (node.nodeName === "#comment") return `<!--${(node as CommentNode).data.replace(/--/g, "- -")}-->`;
  if (!isElement(node)) return childrenOf(node).map((c) => serialize(c)).join("");
  const tag = node.tagName;
  const attrs = node.attrs.map((a) => ` ${a.name}="${escapeAttr(a.value)}"`).join("");
  // Inline <svg> needs its namespace once the markup is parsed as XML.
  const ns = tag === "svg" && !attr(node, "xmlns") ? ` xmlns="http://www.w3.org/2000/svg"` : "";
  if (VOID.has(tag)) return `<${tag}${ns}${attrs}/>`;
  const kids = tag === "template" && "content" in node ? (node.content as unknown as Node) : node;
  const inner = childrenOf(kids).map((c) => serialize(c, RAW_TEXT.has(tag))).join("");
  return `<${tag}${ns}${attrs}>${inner}</${tag}>`;
}

const serializeFragment = (root: Fragment) => childrenOf(root).map((c) => serialize(c)).join("");

// ---------------------------------------------------------------- inline style

/** `a: 1; b: url(data:x;y)` → ordered map; semicolons inside parentheses or quotes don't split. */
export function parseInlineStyle(style: string): Map<string, string> {
  const out = new Map<string, string>();
  let depth = 0;
  let quote = "";
  let start = 0;
  const flush = (end: number) => {
    const decl = style.slice(start, end);
    const colon = decl.indexOf(":");
    if (colon > 0) {
      const name = decl.slice(0, colon).trim().toLowerCase();
      const value = decl.slice(colon + 1).trim();
      if (name && value) out.set(name, value);
    }
    start = end + 1;
  };
  for (let i = 0; i < style.length; i++) {
    const ch = style[i]!;
    if (quote) {
      if (ch === quote && style[i - 1] !== "\\") quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    else if (ch === ";" && depth === 0) flush(i);
  }
  flush(style.length);
  return out;
}

const formatStyle = (map: Map<string, string>) => [...map].map(([k, v]) => `${k}: ${v}`).join("; ");

// ---------------------------------------------------------------- cleaning

export interface CleanOptions {
  /** Keep `<script>` (a clip that runs its own animation, `scripted: true`). Default false. */
  allowScripts?: boolean;
  /** Which URLs may stay in `src`, `href` and CSS `url()`. Default: `asset:`, `font:`, `data:` (not html), `#…`, `{{param}}`. */
  allowUrl?: (url: string) => boolean;
}

export interface CleanResult {
  template: string;
  /** What was taken out, in words ("onclick on <div>", "<iframe>", "url(https://…)"). */
  removed: string[];
}

const DROP_ELEMENTS = new Set(["iframe", "frame", "frameset", "object", "embed", "applet", "base", "meta", "link", "portal"]);
const URL_ATTRS = new Set(["src", "href", "xlink:href", "action", "formaction", "poster", "background", "srcset", "data"]);

export function defaultAllowUrl(url: string): boolean {
  const u = url.trim().replace(/^['"]|['"]$/g, "").trim();
  if (!u || u.startsWith("#") || u.startsWith("{{")) return true;
  if (/^(asset|font):/i.test(u)) return true;
  if (/^data:/i.test(u)) return !/^data:\s*(text\/html|application\/xhtml|image\/svg\+xml[^,]*;?\s*,.*<script)/i.test(u);
  return false;
}

function cleanCss(css: string, allowUrl: (u: string) => boolean, removed: string[]): string {
  let out = css.replace(/@import[^;]*;?/gi, (m) => {
    removed.push(m.trim());
    return "";
  });
  out = out.replace(/url\(\s*([^)]*?)\s*\)/gi, (m, inner: string) => {
    if (allowUrl(inner)) return m;
    removed.push(m.length > 60 ? `${m.slice(0, 57)}…)` : m);
    return "none";
  });
  out = out.replace(/expression\s*\(/gi, (m) => {
    removed.push(m);
    return "(";
  });
  return out;
}

function cleanTree(root: Node, options: CleanOptions, removed: string[]): void {
  const allowUrl = options.allowUrl ?? defaultAllowUrl;
  const visit = (node: Node) => {
    for (const child of [...childrenOf(node)]) {
      if (!isElement(child)) continue;
      const tag = child.tagName;
      if (DROP_ELEMENTS.has(tag) || (tag === "script" && !options.allowScripts)) {
        removed.push(`<${tag}>`);
        detach(child);
        continue;
      }
      for (const a of [...child.attrs]) {
        const name = a.name.toLowerCase();
        if (name.startsWith("on") || name === "srcdoc") {
          removed.push(`${a.name} on <${tag}>`);
          setAttr(child, a.name, null);
        } else if (URL_ATTRS.has(name)) {
          const parts = name === "srcset" ? a.value.split(",").map((p) => p.trim().split(/\s+/)[0] ?? "") : [a.value];
          if (!parts.every(allowUrl)) {
            removed.push(`${a.name}="${a.value.length > 40 ? `${a.value.slice(0, 37)}…` : a.value}" on <${tag}>`);
            setAttr(child, a.name, null);
          }
        } else if (name === "style") {
          setAttr(child, a.name, cleanCss(a.value, allowUrl, removed));
        }
      }
      if (tag === "style") {
        for (const t of childrenOf(child)) {
          if (t.nodeName === "#text") (t as TextNode).value = cleanCss((t as TextNode).value, allowUrl, removed);
        }
      }
      if (tag !== "script") visit(tag === "template" && "content" in child ? (child.content as unknown as Node) : child);
    }
  };
  visit(root);
}

/** Take out what an html clip must not carry: handlers, `javascript:`, external fetches, frames, scripts (unless allowed). */
export function cleanHtml(template: string, options: CleanOptions = {}): CleanResult {
  const root = parse(template);
  const removed: string[] = [];
  cleanTree(root, options, removed);
  return { template: serializeFragment(root), removed };
}

// ---------------------------------------------------------------- stamping and describing

/** The template with an id on every element that lacks one (svg insides and scripts excluded). */
export function stampHtmlIds(template: string): { template: string; created: string[] } {
  const root = parse(template);
  const created = stamp(root, new Set());
  return { template: serializeFragment(root), created };
}

export interface HtmlElementInfo {
  id: string;
  tag: string;
  /** The parent element's id (null at the top level). */
  parentId: string | null;
  depth: number;
  /** Its own text (not its children's), whitespace collapsed; `{{params}}` as written. */
  text: string;
  /** Inline style declarations. */
  style: Record<string, string>;
  /** `class`, `src`, `href`, `alt`, when set. */
  attrs: Record<string, string>;
  /** Number of child elements (an `<svg>` counts as one element with none). */
  childCount: number;
}

export interface DescribeOptions {
  /** Longest text kept per element (default 120 characters). */
  maxText?: number;
}

/** The template's elements in document order, stamped (the returned `template` carries the ids). */
export function describeHtml(template: string, options: DescribeOptions = {}): { template: string; elements: HtmlElementInfo[] } {
  const root = parse(template);
  stamp(root, new Set());
  const maxText = options.maxText ?? 120;
  const depthOf = new Map<Element | null, number>([[null, -1]]);
  const out: HtmlElementInfo[] = [];
  for (const { el, parent } of elements(root)) {
    const depth = (depthOf.get(parent) ?? -1) + 1;
    depthOf.set(el, depth);
    const id = idOf(el);
    if (!id) continue;
    let text = childrenOf(el)
      .filter((c) => c.nodeName === "#text")
      .map((c) => (c as TextNode).value)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > maxText) text = `${text.slice(0, maxText - 1)}…`;
    const attrs: Record<string, string> = {};
    for (const name of ["class", "src", "href", "alt"]) {
      const v = attr(el, name);
      if (v) attrs[name] = v.length > 80 ? `${v.slice(0, 77)}…` : v;
    }
    out.push({
      id,
      tag: el.tagName,
      parentId: parent ? (idOf(parent) ?? null) : null,
      depth,
      text,
      style: Object.fromEntries(parseInlineStyle(attr(el, "style") ?? "")),
      attrs,
      childCount: el.tagName === "svg" ? 0 : childrenOf(el).filter(isElement).filter((c) => !NO_ID.has(c.tagName)).length,
    });
  }
  return { template: serializeFragment(root), elements: out };
}

/** A compact, indented outline of `describeHtml`'s elements, one line each (for a model or a debug view). */
export function formatHtmlOutline(list: readonly HtmlElementInfo[]): string {
  return list
    .map((e) => {
      const cls = e.attrs.class ? `.${e.attrs.class.trim().split(/\s+/).join(".")}` : "";
      const text = e.text ? ` "${e.text}"` : "";
      const style = Object.keys(e.style).length ? ` {${Object.entries(e.style).map(([k, v]) => `${k}:${v}`).join("; ")}}` : "";
      return `${"  ".repeat(e.depth)}#${e.id} ${e.tag}${cls}${text}${style}`;
    })
    .join("\n");
}

// ---------------------------------------------------------------- editing

export type HtmlPosition = "before" | "after" | "first" | "last";

export type HtmlEditOp =
  /** Replace an element's text (it must have no child elements; use `html` or a child's id otherwise). */
  | { op: "text"; id: string; text: string }
  /** Replace an element's inner markup. */
  | { op: "html"; id: string; html: string }
  /** Replace the element itself with new markup. */
  | { op: "replace"; id: string; html: string }
  /** Merge inline style declarations; `null` removes one. */
  | { op: "style"; id: string; set: Record<string, string | null> }
  /** Set or remove attributes (not `style`, not `data-mc`, no `on…` handlers). */
  | { op: "attr"; id: string; set: Record<string, string | null> }
  /** Insert new markup relative to `ref` (default: last, at the top level). */
  | { op: "insert"; html: string; ref?: string; position?: HtmlPosition }
  /** Move an element relative to `ref`. */
  | { op: "move"; id: string; ref: string; position: HtmlPosition }
  /** A copy of the element right after it, with fresh ids. */
  | { op: "duplicate"; id: string }
  | { op: "remove"; id: string };

export interface HtmlEditOptions {
  /** Applied to markup the operations bring in (`html`, `replace`, `insert`). Default: no scripts. */
  clean?: CleanOptions;
}

export interface HtmlEditResult {
  template: string;
  /** Ids given to elements the operations created (inserted, duplicated, replaced). */
  created: string[];
  /** What cleaning took out of the markup the operations brought in. */
  removed: string[];
}

function place(root: Fragment, nodes: Node[], ref: string | undefined, position: HtmlPosition, index: number): void {
  if (!ref) {
    insertAt(root, position === "first" || position === "before" ? 0 : root.childNodes.length, nodes);
    return;
  }
  const { el, parent } = find(root, ref, index);
  if (position === "first" || position === "last") {
    if (el.tagName === "svg" || VOID.has(el.tagName)) {
      throw new HtmlEditError("bad-op", `<${el.tagName}> #${ref} can't hold elements; place it "before" or "after"`, index);
    }
    insertAt(el, position === "first" ? 0 : el.childNodes.length, nodes);
    return;
  }
  const at = (parent.childNodes as Node[]).indexOf(el);
  insertAt(parent, position === "before" ? at : at + 1, nodes);
}

const POSITIONS = new Set(["before", "after", "first", "last"]);

/** Apply element-level operations to a template. All or nothing: a failing operation throws `HtmlEditError`. */
export function editHtml(template: string, ops: readonly HtmlEditOp[], options: HtmlEditOptions = {}): HtmlEditResult {
  const root = parse(template);
  const taken = new Set<string>();
  stamp(root, taken);
  const created: string[] = [];
  const removed: string[] = [];

  /** New markup: parsed, cleaned, and stamped with ids that don't clash. */
  const incoming = (html: string, index: number): Node[] => {
    const frag = parse(html);
    if (!childrenOf(frag).length && html.trim()) throw new HtmlEditError("bad-html", "the markup has no content", index);
    cleanTree(frag, options.clean ?? {}, removed);
    // A copy of existing markup may carry ids already in use: those are replaced.
    created.push(...stamp(frag, taken));
    return [...childrenOf(frag)];
  };

  ops.forEach((op, index) => {
    switch (op.op) {
      case "text": {
        const { el } = find(root, op.id, index);
        if (el.tagName === "svg" || childrenOf(el).some(isElement)) {
          throw new HtmlEditError("has-children", `#${op.id} <${el.tagName}> has child elements: edit a child's text, or use "html"`, index);
        }
        for (const c of [...childrenOf(el)]) detach(c);
        if (op.text) insertAt(el, 0, [textNode(op.text, el)]);
        break;
      }
      case "html": {
        const { el } = find(root, op.id, index);
        if (VOID.has(el.tagName)) throw new HtmlEditError("bad-op", `<${el.tagName}> #${op.id} has no inside`, index);
        const nodes = incoming(op.html, index);
        for (const c of [...childrenOf(el)]) detach(c);
        insertAt(el, 0, nodes);
        break;
      }
      case "replace": {
        const { el, parent } = find(root, op.id, index);
        const nodes = incoming(op.html, index);
        const at = (parent.childNodes as Node[]).indexOf(el);
        detach(el);
        insertAt(parent, at, nodes);
        break;
      }
      case "style": {
        const { el } = find(root, op.id, index);
        const map = parseInlineStyle(attr(el, "style") ?? "");
        for (const [name, value] of Object.entries(op.set)) {
          const key = name.trim().toLowerCase();
          if (value === null || value.trim() === "") map.delete(key);
          else map.set(key, value.trim());
        }
        const next = cleanCss(formatStyle(map), options.clean?.allowUrl ?? defaultAllowUrl, removed);
        setAttr(el, "style", next || null);
        break;
      }
      case "attr": {
        const { el } = find(root, op.id, index);
        for (const [name, value] of Object.entries(op.set)) {
          const key = name.trim().toLowerCase();
          if (key === HTML_ID_ATTR || key === "style" || key.startsWith("on") || key === "srcdoc") {
            throw new HtmlEditError("forbidden-attr", `"${name}" can't be set this way${key === "style" ? ' (use "style")' : ""}`, index);
          }
          if (value !== null && URL_ATTRS.has(key) && !(options.clean?.allowUrl ?? defaultAllowUrl)(value)) {
            throw new HtmlEditError("forbidden-attr", `${name}="${value}" isn't allowed: use an asset: or data: URL`, index);
          }
          setAttr(el, name.trim(), value);
        }
        break;
      }
      case "insert": {
        const position = op.position ?? "last";
        if (!POSITIONS.has(position)) throw new HtmlEditError("bad-op", `unknown position "${position}"`, index);
        place(root, incoming(op.html, index), op.ref, position, index);
        break;
      }
      case "move": {
        if (!POSITIONS.has(op.position)) throw new HtmlEditError("bad-op", `unknown position "${op.position}"`, index);
        const { el } = find(root, op.id, index);
        const target = find(root, op.ref, index).el;
        for (let n: Node | null = target; n; n = (n as { parentNode?: Node | null }).parentNode ?? null) {
          if (n === el) throw new HtmlEditError("invalid-move", `#${op.id} can't move into itself`, index);
        }
        detach(el);
        place(root, [el], op.ref, op.position, index);
        break;
      }
      case "duplicate": {
        const { el, parent } = find(root, op.id, index);
        const nodes = incoming(serialize(el), index);
        insertAt(parent, (parent.childNodes as Node[]).indexOf(el) + 1, nodes);
        break;
      }
      case "remove": {
        const { el } = find(root, op.id, index);
        detach(el);
        break;
      }
      default:
        throw new HtmlEditError("bad-op", `unknown operation "${(op as { op?: string }).op}"`, index);
    }
  });
  return { template: serializeFragment(root), created, removed };
}

/** The document shape the planner reads (structurally a core `ProjectDocument`). */
export interface HtmlEditDocument {
  clips: Readonly<Record<string, { kind: string; template?: string; scripted?: boolean }>>;
}

/** The command the planner returns (structurally a core `clip/set-property` command). */
export interface HtmlEditCommand {
  type: "clip/set-property";
  payload: { clipId: string; template: string };
}

/**
 * Plan element-level edits to an html clip as commands: one
 * `clip/set-property` with the new template (stamped, so later edits find
 * the same ids). A clip that runs scripts keeps them; other markup the
 * operations bring in is cleaned. Pure; throws `HtmlEditError`.
 */
export function planHtmlEdit(
  doc: HtmlEditDocument,
  clipId: string,
  ops: readonly HtmlEditOp[],
  options: HtmlEditOptions = {},
): HtmlEditCommand[] {
  const clip = doc.clips[clipId];
  if (!clip || clip.kind !== "html" || typeof clip.template !== "string") {
    throw new HtmlEditError("not-html-clip", `"${clipId}" is not an html clip`);
  }
  const { template } = editHtml(clip.template, ops, options);
  if (template === clip.template) return [];
  return [{ type: "clip/set-property", payload: { clipId, template } }];
}
