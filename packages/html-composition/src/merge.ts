/**
 * Merge two edits of the same html clip made from the same starting point (a three-way merge,
 * element by element): what `ours` changed since `base` is replayed onto `theirs`, so two
 * people editing different elements of one design at the same moment both keep their work.
 *
 *   const { template, conflicts } = mergeHtml(base, mine, current);
 *
 * Per element (by its `data-mc` id): attributes and each inline style property, its own text,
 * its place (parent and order), whether it exists. Where both sides changed the same thing,
 * `ours` wins and the conflict is counted. An element `theirs` removed stays removed; elements
 * both sides added keep distinct ids. Markup without ids is stamped first (ids are deterministic,
 * so the three agree).
 */
import type { DefaultTreeAdapterMap } from "parse5";
import { parseInlineStyle, tree } from "./edit.js";
import { isElement, type Element, type Node, type ParentNode } from "./xml.js";

type TextNode = DefaultTreeAdapterMap["textNode"];
type Fragment = DefaultTreeAdapterMap["documentFragment"];

interface Info {
  el: Element;
  parent: string | null;
  /** The id of the element just before it among its parent's elements (null: first). */
  prev: string | null;
  attrs: Map<string, string>;
  style: Map<string, string>;
  texts: string[];
}

const ID = "data-mc";

function index(root: Fragment): Map<string, Info> {
  const out = new Map<string, Info>();
  const visit = (node: Node, parent: string | null) => {
    let prev: string | null = null;
    for (const child of tree.childrenOf(node)) {
      if (!isElement(child)) continue;
      const id = tree.idOf(child);
      if (id) {
        const attrs = new Map(child.attrs.filter((a) => a.name !== ID && a.name !== "style").map((a) => [a.name, a.value]));
        const style = parseInlineStyle(child.attrs.find((a) => a.name === "style")?.value ?? "");
        const texts = tree
          .childrenOf(child)
          .filter((c) => c.nodeName === "#text" && (c as TextNode).value.trim())
          .map((c) => (c as TextNode).value);
        out.set(id, { el: child, parent, prev, attrs, style, texts });
        prev = id;
      }
      if (child.tagName !== "svg" && !tree.RAW_TEXT.has(child.tagName)) visit(child, id ?? parent);
    }
  };
  visit(root, null);
  return out;
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Every element in a subtree (itself included), in document order. */
function* subtree(el: Element): Generator<Element> {
  yield el;
  for (const c of tree.childrenOf(el)) if (isElement(c)) yield* subtree(c);
}

export interface MergeResult {
  template: string;
  /** Things both sides changed differently (`ours` kept). */
  conflicts: number;
}

export function mergeHtml(base: string, ours: string, theirs: string): MergeResult {
  const B = index(tree.parse(tree.serializeFragment(stamped(base))));
  const oRoot = stamped(ours);
  const O = index(oRoot);
  const tRoot = stamped(theirs);
  const T = index(tRoot);
  let conflicts = 0;

  // 1. What ours removed.
  for (const [id, b] of B) {
    if (O.has(id)) continue;
    const t = T.get(id);
    if (!t) continue;
    if (changed(b, t)) conflicts++;
    tree.detach(t.el);
  }

  // 2. What ours changed on elements all three have.
  for (const [id, o] of O) {
    const b = B.get(id);
    const t = T.get(id);
    if (!b || !t || !t.el.parentNode) continue;
    // Attributes.
    for (const name of new Set([...b.attrs.keys(), ...o.attrs.keys()])) {
      const ov = o.attrs.get(name);
      if (ov === b.attrs.get(name)) continue;
      if (t.attrs.get(name) !== b.attrs.get(name) && t.attrs.get(name) !== ov) conflicts++;
      tree.setAttr(t.el, name, ov ?? null);
    }
    // Inline style, property by property.
    let styleChanged = false;
    for (const prop of new Set([...b.style.keys(), ...o.style.keys()])) {
      const ov = o.style.get(prop);
      if (ov === b.style.get(prop)) continue;
      if (t.style.get(prop) !== b.style.get(prop) && t.style.get(prop) !== ov) conflicts++;
      if (ov === undefined) t.style.delete(prop);
      else t.style.set(prop, ov);
      styleChanged = true;
    }
    if (styleChanged) tree.setAttr(t.el, "style", t.style.size ? tree.formatStyle(t.style) : null);
    // Its own text.
    if (!same(o.texts, b.texts)) {
      if (!same(t.texts, b.texts) && !same(t.texts, o.texts)) conflicts++;
      const nodes = tree
        .childrenOf(t.el)
        .filter((c) => c.nodeName === "#text" && (c as TextNode).value.trim()) as TextNode[];
      if (nodes.length === o.texts.length) nodes.forEach((n, i) => (n.value = o.texts[i] as string));
      else {
        // The pieces no longer line up: ours' text replaces theirs' (child elements stay).
        for (const n of nodes) tree.detach(n);
        tree.insertAt(t.el, 0, [{ nodeName: "#text", value: o.texts.join(" "), parentNode: t.el } as unknown as Node]);
      }
    }
    // Its place.
    if (o.parent !== b.parent || o.prev !== b.prev) {
      if (t.parent !== b.parent || t.prev !== b.prev) conflicts++;
      place(tRoot, T, t.el, o.parent, o.prev);
    }
  }

  // 3. What ours added (whole subtrees), with ids that don't clash with theirs' additions.
  const taken = tree.allIds(tRoot);
  for (const [id, o] of O) {
    if (B.has(id)) continue;
    const parent = o.parent;
    if (parent && !B.has(parent) && O.has(parent)) continue; // inside another addition: comes with it
    const copy = tree.parse(tree.serialize(o.el)) as Fragment;
    const el = tree.childrenOf(copy).find(isElement);
    if (!el) continue;
    for (const e of subtree(el)) {
      const eid = tree.idOf(e);
      if (eid && taken.has(eid)) tree.setAttr(e, ID, null);
    }
    tree.stamp(copy, taken);
    tree.detach(el);
    place(tRoot, T, el, parent, o.prev);
  }

  return { template: tree.serializeFragment(tRoot), conflicts };
}

function stamped(template: string): Fragment {
  const root = tree.parse(template);
  tree.stamp(root, new Set());
  return root;
}

function changed(b: Info, t: Info): boolean {
  const attrs = (i: Info) => JSON.stringify([...i.attrs].sort());
  const style = (i: Info) => JSON.stringify([...i.style].sort());
  return attrs(b) !== attrs(t) || style(b) !== style(t) || !same(b.texts, t.texts);
}

/** Put `el` under the element `parent` (null: the top level) right after `prev` (null: first). */
function place(root: Fragment, T: Map<string, Info>, el: Element, parent: string | null, prev: string | null): void {
  const holder: ParentNode | undefined = parent === null ? root : (T.get(parent)?.el as ParentNode | undefined);
  if (!holder || (parent !== null && !(T.get(parent)?.el.parentNode))) return; // its parent is gone: leave it
  tree.detach(el);
  const after = prev ? T.get(prev)?.el : undefined;
  const list = holder.childNodes as Node[];
  const at = after && after.parentNode === holder ? list.indexOf(after) + 1 : firstElementIndex(list);
  tree.insertAt(holder, at, [el]);
}

/** Where "first" goes: before the first element (leading text and styles stay in front). */
function firstElementIndex(list: Node[]): number {
  const i = list.findIndex((n) => isElement(n) && (n as Element).tagName !== "style");
  return i < 0 ? list.length : i;
}
