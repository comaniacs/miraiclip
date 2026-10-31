// Blurs account-identifying regions (sub-account switcher, user avatar) in every shot.
// Originals are kept in shots/raw/. Usage: node tools/redact.mjs [name ...]
import { readdirSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../shots');
const raw = path.join(dir, 'raw');
mkdirSync(raw, { recursive: true });
// [x, y, w, h] in the 3840x2160 capture
const REGIONS = [[12, 215, 430, 100], [3700, 10, 130, 100]];
const names = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith('.png') && (!names.length || names.includes(f.slice(0, -4))));
for (const f of files) {
  const src = path.join(raw, f);
  if (!existsSync(src)) copyFileSync(path.join(dir, f), src);
  const chains = REGIONS.map(([x, y, w, h], i) => `[0:v]crop=${w}:${h}:${x}:${y},boxblur=24:3[b${i}]`);
  let last = '0:v';
  const overlays = REGIONS.map(([x, y], i) => { const out = i === REGIONS.length - 1 ? 'out' : `o${i}`; const s = `[${last}][b${i}]overlay=${x}:${y}[${out}]`; last = out; return s; });
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', src, '-filter_complex', [...chains, ...overlays].join(';'), '-map', '[out]', path.join(dir, f)], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed on ${f}`);
  console.log(`redacted ${f}`);
}
