/**
 * Compatibility guard (data-stage-version absent = version 1): a sequence that
 * uses every pre-existing verb must produce byte-identical styles at fixed
 * times, before and after any kit change. The golden file is written once from
 * the unmodified kit; regenerate it only on purpose (UPDATE_GOLDEN=1).
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { browser, fixture, openShot, SIZES, type SizeName } from "./harness.js";

const GOLDEN = join(dirname(fileURLToPath(import.meta.url)), "legacy.golden.json");
const TIMES = [0, 0.3, 0.9, 1.4, 1.9, 2.5, 3.1, 3.9];

afterAll(async () => (await browser())?.close());

async function hashes(name: SizeName): Promise<Record<string, string> | null> {
  const shot = await openShot(fixture("legacy.html"), name);
  if (!shot) return null;
  const out: Record<string, string> = {};
  for (const t of TIMES) {
    await shot.seek(t);
    const state = await shot.page.evaluate(() =>
      Array.from(document.querySelectorAll(".stage, .stage *")).map((el) => {
        const r = (el as HTMLElement).getBoundingClientRect();
        return [el.tagName, el.getAttribute("style") ?? "", [r.left, r.top, r.width, r.height].map((n) => n.toFixed(2)).join(",")].join("|");
      }).join("\n"),
    );
    out[String(t)] = createHash("sha1").update(state).digest("hex");
  }
  await shot.close();
  return out;
}

describe("version 1 sequences are unchanged", () => {
  for (const name of Object.keys(SIZES) as SizeName[]) {
    it(`legacy.html at ${name}`, async (ctx) => {
      const got = await hashes(name);
      if (!got) return ctx.skip();
      const golden: Record<string, Record<string, string>> = existsSync(GOLDEN) ? JSON.parse(readFileSync(GOLDEN, "utf8")) : {};
      if (process.env.UPDATE_GOLDEN || !golden[name]) {
        golden[name] = got;
        writeFileSync(GOLDEN, JSON.stringify(golden, null, 2) + "\n");
      }
      expect(got).toEqual(golden[name]);
    });
  }
});
