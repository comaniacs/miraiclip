// End-to-end test of the real __TITLE__ website in Chrome.   node app/test/e2e.mjs [--shots dir]
import assert from "node:assert/strict";
import { openApp } from "../../../_lib/app-film/e2e.mjs";

const si = process.argv.indexOf("--shots");
const t = await openApp(new URL("../index.html?reset", import.meta.url), { shots: si > 0 ? process.argv[si + 1] : null });
const { page, text } = t;

await t.check("adding a task shows it and updates the count", async () => {
  await page.fill('[data-field="draft"]', "Book the launch call");
  await page.click('[data-act="add"]');
  assert.equal(await text(".ap-list li:last-child span"), "Book the launch call");
  assert.equal(await text(".ap-head h1"), "3 to go");
  assert.equal(await text(".ap-toast"), "Added.");
});
await t.check("toggling marks a task done", async () => {
  await page.click('[data-act="toggle"][data-id="i2"]');
  assert.equal(await page.locator(".ap-item.done").count(), 2);
  assert.equal(await text(".ap-head h1"), "2 to go");
});
await t.check("state survives a reload", async () => {
  await page.goto(t.url.replace("?reset", ""));
  assert.equal(await text(".ap-head h1"), "2 to go");
});
await t.check("an empty task is refused with a message", async () => {
  await page.click('[data-act="add"]');
  assert.equal(await text(".ap-toast"), "Write something first.");
});
await t.done();
