// app-film kit · e2e: drive a static web app in the installed Google Chrome with playwright-core (from the repo).
//
//   const t = await openApp(new URL("../index.html?today=2026-11-09&reset", import.meta.url), { shots: "stills/e2e" });
//   await t.check("selecting a date shows that day", async (page) => { … });
//   await t.done();   // fails if any page error was thrown, prints the count, closes the browser
//
// text() reads an element's visible text, skipping icon buttons inside it (buttons with an aria-label, such as a
// toast's ×): innerText of a whole component includes them and made two assertions fail for the wrong reason once.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(fileURLToPath(new URL("../../../../packages/server-export/package.json", import.meta.url)));

export async function openApp(url, opts = {}) {
  const { chromium } = require("playwright-core");
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1440, height: 860 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  if (opts.shots) fs.mkdirSync(opts.shots, { recursive: true });
  await page.goto(String(url));
  let n = 0;
  return {
    page,
    url: String(url),
    /** the visible text of the first match, without its icon buttons (those labelled by aria-label) */
    text: (sel) => page.locator(sel).first().evaluate((el) => {
      const c = el.cloneNode(true);
      c.querySelectorAll("button[aria-label]").forEach((b) => b.remove());
      return (c.innerText || c.textContent || "").trim();
    }),
    async check(name, fn) {
      await fn(page);
      n++;
      console.log(`PASS  ${n}. ${name}`);
      if (opts.shots) await page.screenshot({ path: path.join(opts.shots, `${String(n).padStart(2, "0")}.png`) });
    },
    async done() {
      assert.deepEqual(errors, [], "page errors");
      console.log(`\nall ${n} checks passed, no page errors`);
      await browser.close();
    },
  };
}
