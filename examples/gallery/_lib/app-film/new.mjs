// app-film kit · new: start a launch film from the template, a working app and a working film.
//
//   node examples/gallery/_lib/app-film/new.mjs <folder> --title "Name" [--headline "…"] [--headline2 "…"]
//        [--tagline "…"] [--cta "…"]
//
// Writes examples/gallery/<folder>/ (refuses to overwrite) with the placeholders filled in. It builds, checks and
// renders as it is; then change the app, the ACTIONS, the camera keys and the copy.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), folder = argv[0];
const arg = (name, dflt) => { const i = argv.indexOf("--" + name); return i > 0 ? argv[i + 1] : dflt; };
if (!folder || folder.startsWith("--") || !/^[a-z0-9][a-z0-9-]*$/.test(folder)) {
  console.error('usage: node new.mjs <folder: lowercase-with-dashes> --title "Name" [--headline …] [--headline2 …] [--tagline …] [--cta …]');
  process.exit(1);
}
const title = arg("title", folder.replace(/(^|-)(\w)/g, (_, s, c) => (s ? " " : "") + c.toUpperCase()));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const values = {
  __ID__: folder, __TITLE__: esc(title),
  __HEADLINE__: esc(arg("headline", "Everything you need, nothing you don't.")),
  __HEADLINE2__: esc(arg("headline2", "Done, in one place.")),
  __TAGLINE__: esc(arg("tagline", `${title} keeps your work in one calm place.`)),
  __CTA__: esc(arg("cta", "Get started")),
};
const dest = path.join(here, "..", "..", folder);
if (fs.existsSync(dest)) { console.error(`refusing to overwrite ${dest}`); process.exit(1); }

function copy(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    const src = path.join(from, name), dst = path.join(to, name);
    if (fs.statSync(src).isDirectory()) { copy(src, dst); continue; }
    let text = fs.readFileSync(src, "utf8");
    for (const [k, v] of Object.entries(values)) text = text.split(k).join(v);
    fs.writeFileSync(dst, text);
  }
}
copy(path.join(here, "template"), dest);
fs.writeFileSync(path.join(dest, ".gitignore"), "out/\nstills/\n");
console.log(`created ${path.relative(process.cwd(), dest)}\nnext: cd ${path.relative(process.cwd(), dest)} && node build.mjs && node ../../../scripts/mc.mjs check video.miraiclip.json && node render.mjs --blur`);
