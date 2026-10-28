// Fill every text field of a template to its maxLength and write a project to check for overflow.
//
//   node longcopy.mjs <template.miraiclip-template.json> <out.miraiclip.json>
//
// Each text field's default is repeated, word by word, until it reaches the field's maxLength.
// Fields with a `pattern` (numbers, ratings, percentages) get their longest sensible value:
// "9999"-style numbers for whole-number patterns, otherwise they keep their default. Open the
// result with frames.mjs in every theme you ship (terminal's mono and paper's serif run widest)
// and look for text leaving its card, wrapping onto a third line, or running under something.
// Needs @miraiclip/templates resolvable from the folder you run it in.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(path.join(process.cwd(), "noop.js"));
const { hydrate, parseTemplate } = await import(req.resolve("@miraiclip/templates").replace(/\.cjs$/, ".js")).catch(() => req("@miraiclip/templates"));
const [inFile, outFile] = process.argv.slice(2);
if (!inFile || !outFile) { console.error("usage: node longcopy.mjs <template.json> <out.miraiclip.json>"); process.exit(1); }

const template = parseTemplate(JSON.parse(fs.readFileSync(inFile, "utf8")));
const fill = (def, max) => {
  const words = String(def || "Text").split(/\s+/);
  let s = "";
  for (let i = 0; s.length < max; i++) s = (s ? `${s} ` : "") + words[i % words.length];
  return s.slice(0, max).trimEnd();
};
const values = {};
const report = [];
for (const f of template.fields) {
  if (f.type !== "text" || f.enum) continue;
  if (f.pattern) {
    const m = /\[0-9\]\{1,(\d+)\}\$?$/.exec(f.pattern);
    if (m && /^\^\[0-9\]/.test(f.pattern)) values[f.name] = "9".repeat(Number(m[1]));
    continue;
  }
  if (!f.maxLength) { report.push(`${f.name}: no maxLength (add one)`); continue; }
  values[f.name] = fill(f.default, f.maxLength);
}
const doc = hydrate(template, values);
doc.settings.name = `${doc.settings.name ?? "template"} (long copy)`;
fs.writeFileSync(outFile, JSON.stringify(doc));
console.log(JSON.stringify({ out: outFile, filled: Object.keys(values).length, notes: report }, null, 1));
