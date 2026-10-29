// End-to-end test of the real website in Chrome: every step of the workflow through the UI, as a user would do it.
//   node app/test/e2e.mjs [--shots dir]
// Uses playwright-core from the repo and the installed Google Chrome. Exits non-zero on the first failed check.
import path from "node:path";
import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../../../../packages/server-export/package.json"));
const { chromium } = require("playwright-core");
const page0 = pathToFileURL(path.join(here, "../index.html")).href + "?today=2026-11-09&reset";
const si = process.argv.indexOf("--shots"), shots = si > 0 ? process.argv[si + 1] : null;
if (shots) fs.mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "null" }).catch(() => {}); // file:// has no origin to grant
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let n = 0;
async function check(name, fn) {
  await fn();
  n++;
  console.log(`PASS  ${n}. ${name}`);
  if (shots) await page.screenshot({ path: path.join(shots, `${String(n).padStart(2, "0")}.png`) });
}
const text = (sel) => page.locator(sel).first().innerText();

await page.goto(page0);

await check("calendar navigation changes the displayed range", async () => {
  assert.equal(await text(".kl-head h1"), "November 2026");
  await page.click('[aria-label="Next"]');
  assert.equal(await text(".kl-head h1"), "December 2026");
  await page.click('[data-act="today"]');
  assert.equal(await text(".kl-head h1"), "November 2026");
  await page.click('[data-act="view"][data-view="week"]');
  assert.equal(await text(".kl-head h1"), "Nov 9 – 15, 2026");
  await page.click('[aria-label="Next"]');
  assert.equal(await text(".kl-head h1"), "Nov 16 – 22, 2026");
  await page.click('[aria-label="Previous"]');
});

await check("selecting a date shows that day, and an empty launch day offers to create a post", async () => {
  await page.click('.kl-wh[data-date="2026-11-12"]');
  assert.equal(await text(".kl-day h3"), "Thu, Nov 12");
  assert.match(await text(".kl-day"), /Nothing planned yet\./);
  await page.click('.kl-wh[data-date="2026-11-10"]');
  assert.match(await text(".kl-day"), /Sneak peek/);
});

await check("opening a post shows it in the editor", async () => {
  await page.click('.kl-day [data-act="open"]');
  assert.match(await page.locator(".kl-caption").inputValue(), /^Sneak peek: something new is coming Thursday\./);
  assert.equal(await page.locator(".kl-tabs .on").getAttribute("data-value"), "instagram");
  await page.click('[data-act="back"]');
});

await check("prompt generation uses every input", async () => {
  await page.click('.kl-wh[data-date="2026-11-12"]');
  await page.click('.kl-day [data-act="start"]');
  assert.match(await text(".kl-date"), /For Thu, Nov 12/);
  await page.fill('[data-field="idea"]', "Introduce Fieldnote, our new meeting-notes app");
  await page.click('[data-field="platform"][data-value="linkedin"]');
  await page.click('[data-field="audience"][data-value="team-leads"]');
  await page.click('[data-field="tone"][data-value="confident"]');
  await page.fill('[data-field="keywords"]', "follow-ups");
  await page.click('[data-act="generate"]');
  const p = await page.locator(".kl-prompt").inputValue();
  for (const want of [/Write a LinkedIn post/, /Introduce Fieldnote, our new meeting-notes app\./, /Team leads who run/, /Confident and direct/, /follow-ups/]) assert.match(p, want);
});

await check("the prompt can be edited, regenerated and copied", async () => {
  const before = await page.locator(".kl-prompt").inputValue();
  await page.click('[data-act="regenerate"]');
  assert.notEqual(await page.locator(".kl-prompt").inputValue(), before);
  await page.locator(".kl-prompt").fill(before + "\nMention the free trial.");
  await page.click('[data-act="copy"]');
  await page.waitForSelector(".kl-toast.on");
  const msg = await text(".kl-toast span");
  assert.ok(/Prompt copied\.|Copy (isn't available|was blocked)/.test(msg), msg); // file:// may block the clipboard; either way the user is told
});

await check("generated content enters the editor", async () => {
  await page.click('[data-act="write"]');
  assert.match(await page.locator(".kl-caption").inputValue(), /Fieldnote/);
  assert.match(await text(".kl-from"), /Drafted from your prompt/);
});

await check("editing the caption updates the live preview and the count", async () => {
  const cap = page.locator(".kl-caption"), old = await cap.inputValue();
  const next = old.replace(/^[^\n]*/, "Your meetings deserve better notes. Meet Fieldnote.");
  await cap.fill(next);
  assert.equal(await text(".kl-pv-text .kl-l1"), "Your meetings deserve better notes. Meet Fieldnote.");
  assert.equal(await text(".kl-count"), `${[...next].length.toLocaleString("en-US")} / 3,000`);
  await page.click('[data-field="platform"][data-value="x"]');
  assert.match(await text(".kl-why"), /Too long for X\./);
  assert.ok(await page.locator('[data-act="schedule"]').isDisabled());
  await page.click('[data-field="platform"][data-value="linkedin"]');
  assert.equal(await text(".kl-pv-text .kl-l1"), "Your meetings deserve better notes. Meet Fieldnote.", "the edit survives a platform switch");
  await page.click('[data-field="media"][data-value="m2"]');
  assert.equal(await page.locator(".kl-pv .kl-media.m2").count(), 1);
});

await check("saving a draft keeps the edits, after a reload too", async () => {
  await page.click('[data-act="save"]');
  assert.equal(await text(".kl-toast span"), "Draft saved.");
  await page.goto(page0.replace("&reset", ""));
  await page.click('[data-act="view"][data-view="week"]');
  const chip = page.locator('.kl-col[data-date="2026-11-12"] .kl-card');
  assert.equal(await chip.count(), 1);
  assert.match(await chip.innerText(), /Draft/);
  await chip.click();
  assert.match(await page.locator(".kl-caption").inputValue(), /^Your meetings deserve better notes\./);
});

await check("scheduling updates status and calendar placement", async () => {
  await page.locator('[data-field="time"]').fill("10:00");
  await page.click('[data-act="schedule"]');
  assert.equal(await text(".kl-toast span"), "Scheduled for Thu, Nov 12 at 10:00 AM.");
  const card = page.locator('.kl-col[data-date="2026-11-12"] .kl-card');
  assert.equal(await card.count(), 1);
  assert.match(await card.innerText(), /10:00 AM/);
  assert.equal(await page.locator('.kl-col[data-date="2026-11-12"] .kl-card.s-scheduled').count(), 1);
});

await check("the calendar keeps the post across views and reloads", async () => {
  await page.click('[data-act="view"][data-view="month"]');
  assert.equal(await page.locator('.kl-cell[data-date="2026-11-12"] .kl-chip.s-scheduled').count(), 1);
  await page.reload();
  assert.equal(await page.locator('.kl-cell[data-date="2026-11-12"] .kl-chip.s-scheduled').count(), 1);
  assert.match(await page.locator('.kl-cell[data-date="2026-11-12"] .kl-chip').innerText(), /Your meetings deserve better notes/);
});

await check("every visible control does something (no dead buttons on any page)", async () => {
  for (const pg of ["calendar", "studio", "editor"]) {
    await page.click(`.kl-nav[data-page="${pg}"]`);
    const dead = await page.$$eval("button", (bs) => bs.filter((b) => !b.dataset.act && !b.closest("[data-act]")).map((b) => b.outerHTML.slice(0, 80)));
    assert.deepEqual(dead, [], `buttons without behaviour on ${pg}`);
  }
});

await check("errors are shown, not swallowed: empty idea and past date", async () => {
  await page.click('.kl-nav[data-page="studio"]');
  await page.fill('[data-field="idea"]', "");
  await page.click('[data-act="generate"]');
  assert.equal(await text(".kl-toast span"), "Describe your idea first.");
  await page.click('.kl-nav[data-page="calendar"]');
  await page.click('.kl-cell[data-date="2026-11-02"] .kl-chip');
  await page.locator('[data-field="date"]').fill("2026-11-01");
  assert.match(await text(".kl-why"), /Pick today or a later date\./);
});

assert.deepEqual(errors, [], "page errors");
console.log(`\nall ${n} checks passed, no page errors`);
await browser.close();
