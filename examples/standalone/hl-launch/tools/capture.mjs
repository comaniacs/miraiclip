// Opens a visible Chromium at app.gohighlevel.com, waits for the user to log in,
// then screenshots the main product areas at 1920x1080 (@2x) into ../shots.
// The browser profile lives in the session scratchpad so the login can be reused.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/'));
const { chromium } = require('playwright');

const PROFILE = process.env.HL_PROFILE;
const OUT = path.resolve(here, '../shots');
const ONLY = process.argv.slice(2); // optional: capture only these route names
if (!PROFILE) throw new Error('Set HL_PROFILE to a browser profile directory');

const ROUTES = [
  ['dashboard', 'dashboard'],
  ['conversations', 'conversations/conversations'],
  ['calendars', 'calendars/view'],
  ['contacts', 'contacts/smart_list/All'],
  ['opportunities', 'opportunities/list'],
  ['payments', 'payments/invoices'],
  ['social', 'marketing/social-planner'],
  ['emails', 'marketing/emails/scheduled'],
  ['workflows', 'automation/workflows'],
  ['funnels', 'funnels-websites/funnels'],
  ['websites', 'funnels-websites/websites'],
  ['memberships', 'memberships/client-portal/dashboard'],
  ['reputation', 'reputation/overview'],
  ['reporting', 'reporting/reports'],
  ['ai-agents', 'ai-agents/getting-started'],
];

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function waitForLogin(page) {
  const deadline = Date.now() + 20 * 60_000;
  while (Date.now() < deadline) {
    const m = page.url().match(/\/location\/([A-Za-z0-9]+)/);
    if (m) return m[1];
    await page.waitForTimeout(2000);
  }
  throw new Error('Timed out waiting for login (20 min)');
}

async function settle(page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 20_000 });
  } catch (err) {
    log('  networkidle not reached, continuing:', err.message.split('\n')[0]);
  }
  await page.waitForTimeout(5000);
  await dismissPopups(page);
}

// Close onboarding modals, "what's new" popovers and tours so the product itself is visible.
async function dismissPopups(page) {
  const labels = /^(not now|close|skip|got it|dismiss|maybe later|no thanks|later|skip tour|×|✕)$/i;
  for (let pass = 0; pass < 3; pass++) {
    await page.keyboard.press('Escape');
    const clicked = await page.evaluate((src) => {
      const re = new RegExp(src, 'i');
      const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const hits = [...document.querySelectorAll('button, [role="button"], a, [aria-label]')].filter((el) => visible(el) && (
        re.test((el.textContent || '').trim()) || /^(close|dismiss)/i.test(el.getAttribute('aria-label') || '')));
      hits.slice(0, 4).forEach((el) => el.click());
      return hits.length;
    }, labels.source);
    if (!clicked) break;
    await page.waitForTimeout(900);
  }
  await page.mouse.move(1900, 1060); // park the cursor so no hover states show
  await page.waitForTimeout(800);
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto('https://app.gohighlevel.com/');
log('Browser open. Waiting for login and a sub-account to load...');
const loc = await waitForLogin(page);
log('Logged in; location detected.');
await settle(page);
await mkdir(OUT, { recursive: true });

const sidebar = await page.$$eval('a[href*="/location/"]', (as) =>
  as.map((a) => ({ text: a.textContent.trim().replace(/\s+/g, ' '), href: a.getAttribute('href') })),
);
await writeFile(path.join(OUT, 'sidebar.json'), JSON.stringify(sidebar, null, 2));

const routes = ONLY.length ? ROUTES.filter(([n]) => ONLY.includes(n)) : ROUTES;
for (const [i, [name, sub]] of routes.entries()) {
  const url = `https://app.gohighlevel.com/v2/location/${loc}/${sub}`;
  log(`(${i + 1}/${routes.length}) ${name}`);
  try {
    await page.goto(url, { timeout: 45_000 });
    await settle(page);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  } catch (err) {
    log(`  FAILED ${name}: ${err.message.split('\n')[0]}`);
  }
}
log('Done. Closing browser.');
await ctx.close();
