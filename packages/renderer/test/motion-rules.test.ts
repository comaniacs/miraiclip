// @vitest-environment jsdom
/**
 * Every technique in the motion skill (plugins/miraiclip/skills/motion/reference/rules/*.md)
 * carries a working snippet: markup, CSS and the body of stage.build. Each one must pass the
 * sequence lint and run through the real stage kit (anime.js inside) without an error, with a
 * timeline that fits its length. Layout isn't checked here (jsdom has none); the skill's
 * contact sheet is the visual check.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { lintSequence } from "../src/stage/lint.js";
import { ANIME_SOURCE, STAGE_KIT_SOURCE } from "../src/stage/stage.generated.js";

// A path, not new URL(…): under jsdom the global URL is jsdom's, which fileURLToPath refuses.
const DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../plugins/miraiclip/skills/motion/reference/rules");
const LENGTH = 12;

const block = (md: string, lang: string) => new RegExp("```" + lang + "\\n([\\s\\S]*?)\\n```").exec(md)?.[1] ?? "";
const rules = readdirSync(DIR)
  .filter((f) => f.endsWith(".md"))
  .sort()
  .map((file) => {
    const md = readFileSync(join(DIR, file), "utf8");
    return { file, md, html: block(md, "html"), css: block(md, "css"), js: block(md, "js") };
  });

const template = (r: (typeof rules)[number]) =>
  `<div class="stage" data-libs="stage" data-duration="${LENGTH}"><style>.world{position:absolute;inset:0}\n${r.css}</style>${r.html}</div>` +
  `<script>stage.build((tl, S) => {\n${r.js}\n});</script>`;

/** Run a template the way a scripted frame does: anime.js and the kit, then the template's script. */
async function run(tpl: string): Promise<HTMLElement> {
  const w = window as unknown as Record<string, unknown>;
  delete w.stage;
  delete w.__miraiclipSeek;
  document.body.innerHTML = tpl.replace(/<script>[\s\S]*<\/script>$/, "");
  const script = /<script>([\s\S]*)<\/script>$/.exec(tpl)![1]!;
  (0, eval)(ANIME_SOURCE);
  (0, eval)(STAGE_KIT_SOURCE);
  (0, eval)(script);
  await (w.__miraiclipReady as Promise<void>);
  return document.querySelector(".stage") as HTMLElement;
}

describe("motion skill techniques", () => {
  it("has about 30 techniques, each with what/when/timing/mistake and a snippet", () => {
    expect(rules.length).toBeGreaterThanOrEqual(25);
    for (const r of rules) {
      for (const field of ["**What:**", "**When:**", "**Timing:**", "**Mistake:**"]) expect(r.md, `${r.file}: ${field}`).toContain(field);
      expect(r.html, `${r.file}: html`).toMatch(/class="world"/);
      expect(r.js, `${r.file}: js`).toMatch(/\btl\./);
      expect(r.md, `${r.file}: no GSAP`).not.toMatch(/gsap/i);
    }
  });

  it("is listed in the skill's index", () => {
    const editor = readFileSync(join(DIR, "../../EDITOR.md"), "utf8");
    for (const r of rules) expect(editor, r.file).toContain("`" + r.file.replace(/\.md$/, "") + "`");
  });

  it("every technique the breakdowns and the direction skill cite exists", () => {
    const names = new Set(rules.map((r) => r.file.replace(/\.md$/, "")));
    const SKILLS = join(DIR, "../../..");
    const cited: [string, string][] = [];
    const BREAKDOWNS = join(DIR, "../breakdowns");
    for (const f of readdirSync(BREAKDOWNS).filter((f) => f.endsWith(".md"))) {
      for (const line of readFileSync(join(BREAKDOWNS, f), "utf8").split("\n")) {
        const cells = line.split("|").map((c) => c.trim());
        // Beat tables: | # | Time | What happens | Technique | Carried … |, where techniques are kebab-case names.
        if (cells.length > 6 && /^\d+$/.test(cells[1]!) && /^[a-z]+(-[a-z]+)*(, [a-z]+(-[a-z]+)*)*$/.test(cells[4]!)) for (const t of cells[4]!.split(", ")) cited.push([f, t]);
      }
    }
    const direction = ["direction/EDITOR.md", "direction/reference/treatment.md"].map((p) => readFileSync(join(SKILLS, p), "utf8")).join("\n");
    for (const m of direction.matchAll(/\| ([a-z]+-[a-z-]+(?:, [a-z]+-?[a-z-]*)*) \|/g)) for (const t of m[1]!.split(", ")) cited.push(["direction", t]);
    for (const m of direction.matchAll(/\(([a-z]+-[a-z-]+(?:, [a-z]+-[a-z-]+)*)\)/g)) for (const t of m[1]!.split(", ")) cited.push(["direction", t]);
    expect(cited.length).toBeGreaterThan(30);
    expect(cited.filter(([, t]) => !names.has(t))).toEqual([]);
  });

  for (const r of rules) {
    it(`${r.file} lints clean and runs through the stage kit`, async () => {
      const tpl = template(r);
      const lint = lintSequence(tpl);
      expect(lint.errors, JSON.stringify(lint.errors)).toEqual([]);
      expect(lint.warnings, JSON.stringify(lint.warnings)).toEqual([]);
      const root = await run(tpl);
      expect(root.getAttribute("data-stage-error")).toBeNull();
      const duration = Number(root.getAttribute("data-stage-duration"));
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThanOrEqual(LENGTH);
      expect(Object.keys(JSON.parse(root.getAttribute("data-stage-labels") ?? "{}")).length, "labels").toBeGreaterThan(0);
      const seek = (window as unknown as { __miraiclipSeek: (t: number) => void }).__miraiclipSeek;
      for (const t of [duration, 0, duration / 2]) expect(() => seek(t)).not.toThrow();
    });
  }
});
