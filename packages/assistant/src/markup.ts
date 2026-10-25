/**
 * Checks an html clip's template the way the renderer will read it: as XML
 * (it rasterizes through an SVG `foreignObject`). Markup that isn't
 * well-formed renders nothing, silently, so the assistant rejects it up front
 * with an error the model can fix.
 */

const VOID = new Set(["br", "img", "hr", "input", "meta", "link", "source", "wbr", "col", "area", "base", "embed", "track", "param"]);
const NAMED = new Set(["amp", "lt", "gt", "quot", "apos"]);
const HTML_ENTITY_HINTS: Record<string, string> = { nbsp: "&#160;", copy: "&#169;", reg: "&#174;", trade: "&#8482;", mdash: "&#8212;", ndash: "&#8211;", hellip: "&#8230;", rarr: "&#8594;", larr: "&#8592;", times: "&#215;", middot: "&#183;", bull: "&#8226;", rsquo: "&#8217;", lsquo: "&#8216;", ldquo: "&#8220;", rdquo: "&#8221;" };

/** Why the markup won't parse as XML, or undefined when it's well-formed. */
export function markupProblem(markup: string): string | undefined {
  const stack: { name: string; at: number }[] = [];
  const n = markup.length;
  let i = 0;
  const near = (at: number) => JSON.stringify(markup.slice(Math.max(0, at - 30), at + 30));
  const entity = (at: number): string | undefined => {
    const m = /^&(#\d+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);/.exec(markup.slice(at, at + 40));
    if (!m) return `a bare "&" near ${near(at)}: write &amp;`;
    const name = m[1]!;
    if (name.startsWith("#") || NAMED.has(name)) return undefined;
    const hint = HTML_ENTITY_HINTS[name];
    return `"&${name};" is an HTML entity, which this XML markup doesn't know: ${hint ? `write ${hint}` : "use a numeric reference (&#NNNN;) or the character itself"}`;
  };

  while (i < n) {
    const c = markup[i]!;
    if (c === "&") {
      const problem = entity(i);
      if (problem) return problem;
      i = markup.indexOf(";", i) + 1;
      continue;
    }
    if (c !== "<") {
      i++;
      continue;
    }
    if (markup.startsWith("<!--", i)) {
      const end = markup.indexOf("-->", i + 4);
      if (end < 0) return `a comment is never closed near ${near(i)}`;
      i = end + 3;
      continue;
    }
    if (markup.startsWith("<![CDATA[", i)) {
      const end = markup.indexOf("]]>", i);
      if (end < 0) return `a CDATA section is never closed near ${near(i)}`;
      i = end + 3;
      continue;
    }
    if (markup.startsWith("<?", i)) {
      const end = markup.indexOf("?>", i);
      if (end < 0) return `"<?" is never closed near ${near(i)}`;
      i = end + 2;
      continue;
    }
    if (markup[i + 1] === "!") return `remove "<!…" declarations (no DOCTYPE) near ${near(i)}`;

    if (markup[i + 1] === "/") {
      const m = /^<\/([A-Za-z_][\w.:-]*)\s*>/.exec(markup.slice(i, i + 200));
      if (!m) return `a broken closing tag near ${near(i)}`;
      const name = m[1]!;
      const open = stack.pop();
      if (!open) return `"</${name}>" closes nothing near ${near(i)}`;
      if (open.name !== name) return unclosed(open, `before "</${name}>"`);
      i += m[0].length;
      continue;
    }

    const tag = /^<([A-Za-z_][\w.:-]*)/.exec(markup.slice(i, i + 200));
    if (!tag) return `a bare "<" near ${near(i)}: write &lt; (also inside CSS, e.g. '&lt;integer&gt;')`;
    const name = tag[1]!;
    const start = i;
    i += tag[0].length;
    const seen = new Set<string>();
    for (;;) {
      while (i < n && /\s/.test(markup[i]!)) i++;
      if (i >= n) return `the <${name}> tag is never finished near ${near(start)}`;
      if (markup.startsWith("/>", i)) {
        i += 2;
        break;
      }
      if (markup[i] === ">") {
        i++;
        if (name.toLowerCase() === "style") {
          // CSS is text: "<" is never a tag here (e.g. '<integer>' in @property).
          const close = markup.slice(i).search(/<\/style\s*>/i);
          const body = close < 0 ? markup.slice(i) : markup.slice(i, i + close);
          const lt = body.indexOf("<");
          if (lt >= 0) return `a bare "<" in the <style> near ${near(i + lt)}: in CSS write &lt; and &gt; (e.g. '&lt;integer&gt;')`;
          for (let a = body.indexOf("&"); a >= 0; a = body.indexOf("&", a + 1)) {
            const problem = entity(i + a);
            if (problem) return problem;
          }
          if (close < 0) return unclosed({ name, at: start }, "at the end");
          i += close;
        }
        stack.push({ name, at: start });
        break;
      }
      const attr = /^([A-Za-z_:][\w.:-]*)/.exec(markup.slice(i, i + 200));
      if (!attr) return `unexpected "${markup[i]}" inside the <${name}> tag near ${near(i)}`;
      const attrName = attr[1]!;
      if (seen.has(attrName)) return `the <${name}> tag has "${attrName}" twice near ${near(start)}`;
      seen.add(attrName);
      i += attrName.length;
      while (i < n && /\s/.test(markup[i]!)) i++;
      if (markup[i] !== "=") return `attribute "${attrName}" on <${name}> needs a quoted value (${attrName}="…") near ${near(start)}`;
      i++;
      while (i < n && /\s/.test(markup[i]!)) i++;
      const q = markup[i];
      if (q !== '"' && q !== "'") return `quote the value of "${attrName}" on <${name}> near ${near(i)}`;
      const end = markup.indexOf(q, i + 1);
      if (end < 0) return `the value of "${attrName}" on <${name}> is never closed near ${near(i)}`;
      const value = markup.slice(i + 1, end);
      const lt = value.indexOf("<");
      if (lt >= 0) return `"<" inside the "${attrName}" value on <${name}>: write &lt; near ${near(i + 1 + lt)}`;
      for (let a = value.indexOf("&"); a >= 0; a = value.indexOf("&", a + 1)) {
        const problem = entity(i + 1 + a);
        if (problem) return problem;
      }
      i = end + 1;
    }
  }
  const open = stack.pop();
  return open ? unclosed(open, "at the end") : undefined;

  function unclosed(open: { name: string; at: number }, where: string) {
    const fix = VOID.has(open.name.toLowerCase()) ? `write <${open.name} …/>` : `close it with </${open.name}>`;
    return `<${open.name}> is never closed (${where}) near ${near(open.at)}: ${fix}`;
  }
}

/** `asset:<id>` references in a template. */
export function assetRefs(markup: string): string[] {
  return [...new Set([...markup.matchAll(/asset:([\w-]+)/g)].map((m) => m[1]!))];
}
