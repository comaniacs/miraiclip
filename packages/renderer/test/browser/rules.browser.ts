/**
 * The version 2 snippets in the motion skill ("```js v2" blocks) run in a real browser:
 * they pass the sequence lint, build without an error, and every seek gives finite transforms.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { lintSequence } from "../../src/stage/lint.js";
import { browser, openShot } from "./harness.js";

afterAll(async () => (await browser())?.close());

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../../plugins/miraiclip/skills/motion/reference/rules");
const block = (md: string, lang: string) => new RegExp("```" + lang + " v2\\n([\\s\\S]*?)\\n```").exec(md)?.[1] ?? "";
const snippets = readdirSync(DIR)
  .filter((f) => f.endsWith(".md"))
  .map((file) => {
    const md = readFileSync(join(DIR, file), "utf8");
    return { file, html: block(md, "html"), css: block(md, "css"), js: block(md, "js") };
  })
  .filter((r) => r.js);

// The stage's variables, as the film's stage provides them.
const VARS = "--bg:#0b0d12;--ink:#f4f5f7;--mut:#9aa1ad;--p:#ffcf5a;--s:#5ad1ff;--card:#171a22;--line:#2a2f3a;--onp:#111;";

describe("motion skill version 2 snippets", () => {
  it("finds the version 2 techniques", () => {
    expect(snippets.map((s) => s.file)).toEqual(expect.arrayContaining(["morph.md", "zoom-through.md", "carry-over.md", "whip-pan.md", "parallax.md"]));
  });

  for (const r of snippets) {
    it(`${r.file}: lints clean and renders at 16:9, 9:16 and 1:1`, async (ctx) => {
      const tpl = `<div class="stage" data-libs="stage" data-duration="12" data-stage-version="2" style="${VARS}background:var(--bg);color:var(--ink);font-family:sans-serif"><style>.world{position:absolute;inset:0}\n${r.css}</style>${r.html}</div><script>stage.build((tl, S) => {\n${r.js}\n});</script>`;
      const lint = lintSequence(tpl);
      expect(lint.errors, `${r.file} lint`).toEqual([]);
      for (const size of ["landscape", "portrait", "square"] as const) {
        const shot = await openShot(tpl, size);
        if (!shot) return ctx.skip();
        expect((await shot.attrs())["data-stage-error"], `${r.file} ${size}`).toBeUndefined();
        for (const t of [0, 0.5, 1, 1.5, 2, 3, 4]) {
          await shot.seek(t);
          const bad = await shot.page.evaluate(() => Array.from(document.querySelectorAll(".stage, .stage *")).some((e) => /NaN|Infinity/.test(e.getAttribute("style") ?? "")));
          expect(bad, `${r.file} ${size} at ${t}: a style has NaN or Infinity`).toBe(false);
        }
        await shot.close();
      }
    });
  }
});
