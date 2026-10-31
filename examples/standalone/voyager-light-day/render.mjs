// Standalone renderer (no miraiclip): Playwright paints film.html frame by frame via window.seek(t),
// ffmpeg encodes the frames plus the synthesized score.
//   node render.mjs                       → out/one-light-day.mp4
//   node render.mjs --stills 1,8,12.5     → out/stills/*.jpg + out/sheet.jpg (quick review)
import { createRequire } from 'node:module';
import { mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const require = createRequire(path.join(repo, 'node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/'));
const { chromium } = require('playwright');

const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : dflt; };
const FPS = Number(arg('fps', 30));
const WORKERS = Number(arg('workers', 6));
const STILLS = arg('stills');
const OUT = path.join(here, 'out');
const FRAMES = path.join(here, 'frames');
const url = pathToFileURL(path.join(here, 'film.html')).href;

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${cmd} exited with ${r.status}`);
}

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => { throw new Error(`film.html error: ${e.message}`); });
  await page.goto(url);
  const r = await page.evaluate(() => window.ready());
  if (r.failed.length) console.warn(`missing images: ${r.failed.join(', ')}`);
  return page;
}

async function paint(page, t, file) {
  await page.evaluate((tt) => new Promise((res) => { window.seek(tt); requestAnimationFrame(() => requestAnimationFrame(res)); }), t);
  await page.screenshot({ path: file, type: 'jpeg', quality: 95 });
}

const browser = await chromium.launch({ args: ['--disable-web-security', '--allow-file-access-from-files'] });
const started = Date.now();
try {
  if (STILLS) {
    const dir = path.join(OUT, 'stills');
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const page = await openPage(browser);
    const ts = STILLS.split(',').map(Number);
    for (const [i, t] of ts.entries()) await paint(page, t, path.join(dir, `${String(i).padStart(2, '0')}-${t}.jpg`));
    const cols = Math.min(4, ts.length);
    run('ffmpeg', ['-loglevel', 'error', '-y', '-pattern_type', 'glob', '-i', path.join(dir, '*.jpg'),
      '-vf', `scale=640:-1,tile=${cols}x${Math.ceil(ts.length / cols)}:padding=6`, '-frames:v', '1', path.join(OUT, 'sheet.jpg')]);
    console.log(`stills → ${dir}, sheet → ${path.join(OUT, 'sheet.jpg')}`);
  } else {
    await rm(FRAMES, { recursive: true, force: true });
    await mkdir(FRAMES, { recursive: true });
    await mkdir(OUT, { recursive: true });
    const total = Math.round(30 * FPS);
    let done = 0;
    await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
      const page = await openPage(browser);
      for (let f = w; f < total; f += WORKERS) {
        await paint(page, f / FPS, path.join(FRAMES, `${String(f).padStart(5, '0')}.jpg`));
        if (++done % 150 === 0) console.log(`${done}/${total} frames (${((Date.now() - started) / 1000).toFixed(0)} s)`);
      }
    }));
    run('node', [path.join(here, 'audio.mjs'), path.join(OUT, 'score.wav')]);
    const mp4 = path.join(OUT, 'one-light-day.mp4');
    run('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', path.join(FRAMES, '%05d.jpg'), '-i', path.join(OUT, 'score.wav'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', '256k', '-shortest', mp4]);
    console.log(`wrote ${mp4} in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
} finally {
  await browser.close();
}
