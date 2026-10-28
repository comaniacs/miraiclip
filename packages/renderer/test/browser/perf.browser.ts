/**
 * Performance budget for a heavy version 2 sequence: 20 s, 40 elements, every verb.
 * The numbers are printed so they can be recorded; the assertions are generous so CI on a
 * slow machine doesn't flake, while a real regression (an accidental O(n²) in the seek) still fails.
 */
import { afterAll, describe, expect, it } from "vitest";
import { browser, openShot } from "./harness.js";

afterAll(async () => (await browser())?.close());

const items = Array.from({ length: 28 }, (_, i) => `<i class="d" style="position:absolute;left:${(i % 7) * 12 + 4}%;top:${Math.floor(i / 7) * 10 + 8}%;width:4%;height:4%;background:hsl(${i * 13},70%,60%)"></i>`).join("");
const markup = `<div class="world" style="position:absolute;inset:0">${items}
  <div id="a" style="position:absolute;left:8%;top:60%;width:6%;height:6%;border-radius:50%;background:#f43f5e"></div>
  <div id="b" style="position:absolute;left:60%;top:56%;width:30%;height:24%;border-radius:2%;background:#6d28d9"><p style="margin:0">Card</p></div>
  <div id="h" style="position:absolute;left:20%;top:70%;width:4%;height:4%;background:#e5e7eb"></div>
  <div id="s" style="position:absolute;left:40%;top:70%;width:4%;height:4%;background:#4ade80"></div>
  <div id="bin" style="position:absolute;left:70%;top:8%;width:20%;height:20%;background:#2563eb" data-depth="2"></div>
  <div id="pan" data-depth="1" style="position:absolute;left:40%;top:30%;width:10%;height:10%;background:#14532d"></div>
  <div id="tgt" style="position:absolute;left:30%;top:40%;width:5%;height:5%;background:#fde047"></div>
  <div id="scene" style="position:absolute;inset:0;background:#0b1020;opacity:.9"></div>
  <div id="btn" style="position:absolute;left:50%;top:50%;width:4%;height:4%;background:#fff"></div>
</div>`;
const script = `
  S.grid({ depth: 0.5 });
  tl.label("a", 0)
    .from(".d", { y: S.h(4), opacity: 0, duration: 0.6, stagger: 0.03 }, 0)
    .morph("#a", "#b", { duration: 1 }, 1)
    .hop("#h", { to: "#s", duration: 0.8 }, 2.5)
    .gather(".d", { into: "#bin", duration: 1, stagger: 0.02 }, 4)
    .iris("#scene", { from: "#btn", duration: 1 }, 6)
    .press("#btn", 7.2).impact("#s", 7.5)
    .to("#tgt", { x: S.w(40), duration: 6, ease: "inOut(2)" }, 8)
    .follow("#tgt", { lead: 0.1, from: 8, to: 14 })
    .camera({ zoom: 3, duration: 2, ease: "inOut(3)" }, 7)
    .whip("#bin", { duration: 0.4 }, 14.5)
    .camera({ anchor: "#pan", at: [50, 50], zoom: 120, duration: 3, ease: "inOut(3)" }, 15)
    .shake(15, { amp: 6 }).shake(18, { amp: 5, seed: 2 })
    .handheld({ amount: 2 }, 0, 20)
    .pointer({ path: [{ t: 1, x: S.w(10), y: S.h(60) }, { t: 3, x: S.w(60), y: S.h(40) }, { t: 5, x: S.w(30), y: S.h(70) }], clicks: [3] })
    .rest(19.4, 19.9)
    .to("#pan", { opacity: 0.8, duration: 0.3 }, 19);
`;
const html = `<div class="stage" data-libs="stage" data-duration="20" data-stage-version="2">${markup}</div><script>stage.build((tl, S) => {${script}});</script>`;

describe("performance budget (20 s, 40 elements, every verb)", () => {
  it("builds and seeks within budget", async (ctx) => {
    const shot = await openShot(html, "landscape");
    if (!shot) return ctx.skip();
    expect((await shot.attrs())["data-stage-error"]).toBeUndefined();
    const ms = await shot.page.evaluate(() => {
      const seek = (window as unknown as { __miraiclipSeek(t: number): void }).__miraiclipSeek;
      const times: number[] = [];
      for (let i = 0; i < 120; i++) {
        const t0 = performance.now();
        seek((i / 120) * 19.9);
        // the snapshot the renderer takes after every seek
        document.querySelector(".stage")!.outerHTML.length;
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      return { median: times[60]!, p95: times[114]!, max: times[119]! };
    });
    console.log(`continuous-shot perf: build ${shot.buildMs} ms, seek+snapshot median ${ms.median.toFixed(2)} ms, p95 ${ms.p95.toFixed(2)} ms, max ${ms.max.toFixed(2)} ms`);
    expect(shot.buildMs).toBeLessThan(2000);
    expect(ms.median).toBeLessThan(40);
    await shot.close();
  });
});
