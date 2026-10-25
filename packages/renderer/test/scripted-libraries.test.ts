import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { registerScriptedLibraries, requestedLibraries, resolveLibraries, scriptedFrameDocument } from "../src/html/scripted.js";
import { ANIME_SOURCE, ANIME_VERSION, STAGE_KIT_SOURCE } from "../src/stage/stage.generated.js";

describe("scripted libraries", () => {
  it("reads data-libs from any element, space- or comma-separated", () => {
    expect(requestedLibraries(`<div data-libs="stage"><i data-libs='a, b'></i></div>`)).toEqual(["stage", "a", "b"]);
    expect(requestedLibraries("<div>no libs</div>")).toEqual([]);
  });

  it("resolves dependencies first, once each", () => {
    registerScriptedLibraries({ base: "var base=1;", mid: { code: "var mid=base+1;", requires: ["base"] }, top: { code: "var top=mid+1;", requires: ["mid", "base"] } });
    expect(resolveLibraries(["top", "mid"]).map((l) => l.name)).toEqual(["base", "mid", "top"]);
  });

  it("refuses unknown libraries and cycles", () => {
    expect(() => resolveLibraries(["nope"])).toThrow(/isn't registered/);
    registerScriptedLibraries({ c1: { code: "", requires: ["c2"] }, c2: { code: "", requires: ["c1"] } });
    expect(() => resolveLibraries(["c1"])).toThrow(/cycle/);
  });

  it("injects the code inline in the head, before the template's own scripts", () => {
    registerScriptedLibraries({ lib1: "window.x = '</script>';" });
    const doc = scriptedFrameDocument(`<div data-libs="lib1"></div><script>use(x)</script>`, 640, 360);
    const head = doc.slice(0, doc.indexOf("</head>"));
    expect(head).toContain('<script data-lib="lib1">');
    expect(head).toContain("<\\/script>"); // a closing tag inside the library can't end the element
    expect(doc.indexOf('data-lib="lib1"')).toBeLessThan(doc.indexOf("use(x)"));
  });

  it("leaves templates without data-libs alone", () => {
    expect(scriptedFrameDocument("<p>hi</p>", 10, 10)).not.toContain("data-lib=");
  });
});

describe("stage kit bundle", () => {
  it("is up to date with src/stage/kit.js and the installed anime.js", () => {
    const script = fileURLToPath(new URL("../scripts/bundle-stage.mjs", import.meta.url));
    expect(() => execFileSync(process.execPath, [script, "--check"], { stdio: "pipe" })).not.toThrow();
  });

  it("carries anime.js v4 with its licence header, and the kit", () => {
    expect(ANIME_VERSION).toMatch(/^4\./);
    expect(ANIME_SOURCE.slice(0, 200)).toContain("@license MIT");
    expect(STAGE_KIT_SOURCE).toContain("window.stage");
    expect(STAGE_KIT_SOURCE).toContain("__miraiclipSeek");
  });
});
