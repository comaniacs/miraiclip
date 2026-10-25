/**
 * The sequence-core skill (plugins/miraiclip/skills/sequence-core/EDITOR.md) is the contract models
 * write sequences against. It must match the stage kit and the lint: every timeline method and S
 * helper it documents exists in the kit, every one the kit has is documented, and every lint rule
 * is listed.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { lintSequence } from "../src/stage/lint.js";

const here = dirname(fileURLToPath(import.meta.url));
const doc = readFileSync(join(here, "../../../plugins/miraiclip/skills/sequence-core/EDITOR.md"), "utf8");
const kit = readFileSync(join(here, "../src/stage/kit.js"), "utf8");
const lintSource = readFileSync(join(here, "../src/stage/lint.ts"), "utf8");

/** The timeline API object's methods, and the S object's members, as the kit defines them. */
const apiBlock = /var api = \{([\s\S]*?)\n {4}\};/.exec(kit)![1]!;
const kitTl = [...apiBlock.matchAll(/^\s{6}(\w+):\s*function/gm)].map((m) => m[1]!);
const sBlock = /function makeS\(\) \{[\s\S]*?return \{([\s\S]*?)\n {4}\};/.exec(kit)![1]!;
const kitS = [...sBlock.matchAll(/^\s{6}(\w+):/gm)].map((m) => m[1]!);

describe("sequence-core skill", () => {
  it("documents every timeline method the kit has, and only those", () => {
    expect(kitTl).toEqual(expect.arrayContaining(["to", "from", "fromTo", "set", "label", "camera"]));
    for (const m of kitTl) expect(doc, `tl.${m}`).toContain(`tl.${m}(`);
    const documented = [...new Set([...doc.matchAll(/`tl\.(\w+)\(/g)].map((m) => m[1]!))];
    for (const m of documented) expect(kitTl, `documented tl.${m}`).toContain(m);
  });

  it("documents every S helper the kit has, and only those", () => {
    expect(kitS.length).toBeGreaterThan(5);
    for (const k of kitS) expect(doc, `S.${k}`).toContain(`S.${k}`);
    const documented = [...new Set([...doc.matchAll(/`S\.(\w+)/g)].map((m) => m[1]!))];
    for (const k of documented) expect(kitS, `documented S.${k}`).toContain(k);
  });

  it("documents the camera's vars", () => {
    for (const v of ["zoom", "tiltX", "tiltY"]) {
      expect(kit).toContain(`"${v}"`);
      expect(doc).toContain(v);
    }
  });

  it("lists every lint rule", () => {
    const rules = new Set([...lintSource.matchAll(/(?:rule:\s*|err\(|warn\()"([a-z-]+)"/g)].map((m) => m[1]!));
    expect(rules.size).toBeGreaterThan(10);
    for (const r of rules) expect(doc, `rule ${r}`).toContain(`\`${r}\``);
  });

  it("its rules agree with the lint (spot checks)", () => {
    const tpl = (script: string, css = "") => `<div class="stage" data-libs="stage" data-duration="4"><style>${css}</style><div class="world"></div></div><script>stage.build((tl, S) => {${script}});</script>`;
    expect(lintSequence(tpl("tl.to('.a', { x: S.w(10) }, 0);")).errors).toEqual([]);
    expect(lintSequence(tpl("const r = Math.random();")).errors.map((e) => e.rule)).toContain("random");
    expect(lintSequence(tpl("", ".a{width:10vw}")).errors.map((e) => e.rule)).toContain("units");
    expect(lintSequence(tpl("tl.to('.a', { x: 300 }, 0);")).warnings.map((w) => w.rule)).toContain("pixels");
  });
});
