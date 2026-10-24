// Upload every template's assets/ folder to the miraiclip-assets R2 bucket,
// under templates/<id>/<file>, which is where the template JSON points
// (https://assets.miraiclip.com/templates/<id>/<file>).
//
//   node examples/templates/upload-assets.mjs              # all templates
//   node examples/templates/upload-assets.mjs miraiclip-launch
//   node examples/templates/upload-assets.mjs --cors       # also (re)apply cors.json
//
// Needs wrangler logged in (`npx wrangler login`) to the account that owns the
// bucket. Files are uploaded with --remote, so they go to the real bucket.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const BUCKET = process.env.R2_BUCKET ?? "miraiclip-assets";
const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith("--"));

// One quoted command string: on Windows npx is a .cmd and needs a shell, and
// a shell splits unquoted values like "public, max-age=…" into several args.
const quote = (a) => (/^[\w@./:=-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`);
// Wrangler on Windows sometimes dies on exit with a libuv assertion
// ("!(handle->flags & UV_HANDLE_CLOSING)") after the work is done, which makes
// the exit code non-zero. Judge success by wrangler's own output instead.
const run = (cmdArgs, okText) => {
  const cmd = ["npx", "wrangler@4", ...cmdArgs].map(quote).join(" ");
  let out = "";
  try {
    out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    out = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    if (!okText || !out.includes(okText)) {
      process.stdout.write(out);
      throw new Error(`failed: ${cmd}`);
    }
  }
  const line = out.split(/\r?\n/).find((l) => okText && l.includes(okText));
  console.log(`  ${line?.trim() ?? "done"}`);
};

const TYPES = {
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg", ".txt": "text/plain",
};

if (args.includes("--cors")) run(["r2", "bucket", "cors", "set", BUCKET, "--file", path.join(here, "cors.json"), "--force"], "Set CORS");

for (const id of fs.readdirSync(here)) {
  const dir = path.join(here, id, "assets");
  if (!fs.existsSync(dir) || (only.length && !only.includes(id))) continue;
  for (const file of fs.readdirSync(dir)) {
    const type = TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream";
    const key = `${BUCKET}/templates/${id}/${file}`;
    console.log(`→ ${key} (${type})`);
    run(["r2", "object", "put", key, "--file", path.join(dir, file), "--content-type", type, "--cache-control", "public, max-age=31536000, immutable", "--remote"], "Upload complete");
  }
}
