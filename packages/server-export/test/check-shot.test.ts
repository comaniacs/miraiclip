import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import { checkShot } from "../src/check-shot.js";

const browserPath = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));
const slideshow = `<style>.stage{position:relative;width:320px;height:180px;overflow:hidden}.world{position:absolute;inset:0}.s{position:absolute;inset:10%}</style><div class="stage" data-libs="stage" data-duration="12" data-stage-version="2"><div class="world"><div class="s" id="s1" style="background:#e63946"><p>One</p></div><div class="s" id="s2" style="background:#264653;opacity:0"><p>Two</p></div></div></div><script>stage.build((tl)=>{tl.label("one",0).label("two",5);tl.to("#s1",{opacity:0,duration:.2},4.9).to("#s2",{opacity:1,duration:.2},4.9);});</script>`;
const plain = `<div style="width:320px;height:180px">hello</div>`;

describe.runIf(browserPath)("checkShot", () => {
  it("reports bare boundaries for a sequence and skips plain html", async () => {
    const doc = createProject({ width: 320, height: 180 } as never) as never as any;
    doc.clips = {
      a: { id: "a", kind: "html", trackId: "t", startUs: 0, durationUs: 12_000_000, template: slideshow, params: {} },
      b: { id: "b", kind: "html", trackId: "t", startUs: 12_000_000, durationUs: 2_000_000, template: plain, params: {} },
    };
    const res = await checkShot(doc, { browser: { executablePath: browserPath } });
    const a = res.clips.find((c) => c.clipId === "a")!;
    expect(a.report?.bare).toBe(1);
    expect(a.report?.findings.some((f) => f.rule === "bare-boundary")).toBe(true);
    expect(res.clips.find((c) => c.clipId === "b")!.skipped).toMatch(/not a stage/);
    expect(res.findings.length).toBeGreaterThan(0);
  }, 60_000);
});
