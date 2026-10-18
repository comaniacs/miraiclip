/**
 * Minimal parse5 helpers: attribute access, tree walks, and an XHTML
 * serializer. Html clips are rasterized through SVG foreignObject, which
 * parses XML — so markup taken from an HTML document must be re-serialized
 * well-formed (closed void elements, escaped text and attributes).
 */
import type { DefaultTreeAdapterMap } from "parse5";

export type Node = DefaultTreeAdapterMap["node"];
export type Element = DefaultTreeAdapterMap["element"];
export type ParentNode = DefaultTreeAdapterMap["parentNode"];

export const isElement = (node: Node): node is Element => "tagName" in node;

export function attr(el: Element, name: string): string | undefined {
  return el.attrs.find((a) => a.name === name)?.value;
}

export function hasAttr(el: Element, name: string): boolean {
  return el.attrs.some((a) => a.name === name);
}

export function* walk(node: Node): Generator<Element> {
  const children = "childNodes" in node ? node.childNodes : [];
  for (const child of children) {
    if (isElement(child)) {
      yield child;
      yield* walk(child.tagName === "template" && "content" in child ? (child.content as unknown as Node) : child);
    }
  }
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s: string) => escapeText(s).replace(/"/g, "&quot;");

/** Serialize a node as well-formed XHTML, skipping attributes for which `dropAttr` returns true. */
export function toXhtml(node: Node, dropAttr: (name: string) => boolean = () => false, _isRoot = true): string {
  if (node.nodeName === "#text") {
    // Text and CSS alike must be XML-safe (`>` in a CSS selector becomes &gt;).
    return escapeText((node as DefaultTreeAdapterMap["textNode"]).value);
  }
  if (node.nodeName === "#comment") return "";
  if (!isElement(node)) {
    return ("childNodes" in node ? node.childNodes : []).map((c) => toXhtml(c, dropAttr, false)).join("");
  }
  const tag = node.tagName;
  if (tag === "script") return "";
  const attrs = node.attrs
    .filter((a) => !dropAttr(a.name))
    .map((a) => ` ${a.name}="${escapeAttr(a.value)}"`)
    .join("");
  // Every inline <svg> needs the SVG namespace once it is parsed as XML.
  const ns = tag === "svg" && !hasAttr(node, "xmlns") ? ` xmlns="http://www.w3.org/2000/svg"` : "";
  if (VOID.has(tag)) return `<${tag}${ns}${attrs}/>`;
  const children = tag === "template" && "content" in node ? (node.content as unknown as Node) : node;
  const inner = ("childNodes" in children ? children.childNodes : []).map((c) => toXhtml(c, dropAttr, false)).join("");
  return `<${tag}${ns}${attrs}>${inner}</${tag}>`;
}

