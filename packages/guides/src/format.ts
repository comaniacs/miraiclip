/** A guide as Markdown, standalone HTML, or JSON. */
import type { Guide } from "./build.js";

export interface MarkdownOptions {
  /** Prefix for image paths (e.g. "images/"). */
  imageBase?: string;
  /** Heading level for the title (default 1). */
  level?: 1 | 2;
}

const mdEscape = (s: string) => s.replace(/([\\`*_[\]<>])/g, "\\$1");

export function toMarkdown(guide: Guide, options: MarkdownOptions = {}): string {
  const h = "#".repeat(options.level ?? 1);
  const lines = [`${h} ${mdEscape(guide.title)}`, ""];
  if (guide.intro) lines.push(mdEscape(guide.intro), "");
  for (const step of guide.steps) {
    lines.push(`${h}# ${step.number}. ${mdEscape(step.title)}`, "");
    if (step.body) lines.push(mdEscape(step.body), "");
    if (step.image) lines.push(`![${mdEscape(step.image.alt)}](${encodeURI((options.imageBase ?? "") + step.image.src)})`, "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export interface HtmlOptions {
  imageBase?: string;
  /** Accent colour (default "#2563eb"). */
  accent?: string;
  /** A full page (default) or just the article element. */
  fragment?: boolean;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function toHtml(guide: Guide, options: HtmlOptions = {}): string {
  const accent = options.accent ?? "#2563eb";
  const steps = guide.steps
    .map(
      (s) => `  <li class="mc-step" id="${esc(s.id)}">
    <h2><span class="mc-n">${s.number}</span>${esc(s.title)}</h2>${s.body ? `\n    <p>${esc(s.body)}</p>` : ""}${
      s.image ? `\n    <img src="${esc((options.imageBase ?? "") + s.image.src)}" width="${s.image.width}" height="${s.image.height}" alt="${esc(s.image.alt)}" loading="lazy">` : ""
    }
  </li>`,
    )
    .join("\n");
  const article = `<article class="mc-guide"${guide.language ? ` lang="${esc(guide.language)}"` : ""}>
  <h1>${esc(guide.title)}</h1>${guide.intro ? `\n  <p class="mc-intro">${esc(guide.intro)}</p>` : ""}
  <ol class="mc-steps">
${steps}
  </ol>
</article>`;
  if (options.fragment) return article;
  return `<!doctype html>
<html${guide.language ? ` lang="${esc(guide.language)}"` : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(guide.title)}</title>
<style>
  :root { --accent: ${esc(accent)}; color-scheme: light dark; }
  body { margin: 0; font: 16px/1.6 system-ui, sans-serif; background: Canvas; color: CanvasText; }
  .mc-guide { max-width: 820px; margin: 0 auto; padding: 32px 16px 64px; }
  .mc-guide h1 { font-size: 2rem; line-height: 1.2; margin: 0 0 8px; }
  .mc-intro { opacity: .8; margin: 0 0 24px; }
  .mc-steps { list-style: none; padding: 0; margin: 0; }
  .mc-step { margin: 0 0 40px; }
  .mc-step h2 { display: flex; gap: 12px; align-items: center; font-size: 1.25rem; margin: 0 0 8px; }
  .mc-n { flex: none; display: inline-grid; place-items: center; width: 1.8em; height: 1.8em; border-radius: 50%; background: var(--accent); color: #fff; font-size: .9rem; }
  .mc-step p { margin: 0 0 12px; }
  .mc-step img { display: block; width: 100%; height: auto; border-radius: 10px; border: 1px solid color-mix(in srgb, CanvasText 15%, transparent); }
</style>
</head>
<body>
${article}
</body>
</html>
`;
}

export function toJson(guide: Guide): string {
  return `${JSON.stringify(guide, null, 2)}\n`;
}
