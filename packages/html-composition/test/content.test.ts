import { describe, expect, it } from "vitest";
import { hexColor, htmlFonts, htmlPalette, htmlTexts, recolorHtml, refontHtml, setHtmlTexts, stampHtmlIds } from "../src/index.js";

const TICKET = `<style>.lbl{font-family:'JetBrains Mono', monospace;font-size:22px;color:#094a9f}</style>
<div style="position:absolute;background:#fff4ea;border:2px solid rgba(9, 74, 159, 0.5)">
  <p class="lbl">ADMIT ONE</p>
  <h1 style="font-family:'Alfa Slab One';font-size:190px;color:#094a9f;text-shadow:8px 8px 0 #f25a5a">LIVE<br/>EDIT LAB</h1>
  <p style="color:#094A9F">TOTAL: <b style="color:#f25a5a">one perfect morning</b> today</p>
  <span>14:00</span><span>{{price}}</span>
  <svg viewBox="0 0 10 10"><rect fill="#094a9f" width="2" height="10"/><text>BARCODE</text></svg>
  <script>var x = "not words";</script>
</div>`;

describe("an html clip's words", () => {
  it("finds every piece a viewer reads, by its element and place, skipping numbers, params, svg and code", () => {
    const { texts } = htmlTexts(TICKET);
    expect(texts.map((t) => t.text)).toEqual(["ADMIT ONE", "LIVE", "EDIT LAB", "TOTAL:", "one perfect morning", "today"]);
    // Text around a child element is two pieces of the same element.
    const total = texts.filter((t) => t.text === "TOTAL:" || t.text === "today");
    expect(total[0]!.id).toBe(total[1]!.id);
    expect(total.map((t) => t.index)).toEqual([0, 1]);
  });

  it("writes translations back into the same places, markup and whitespace untouched", () => {
    const { texts } = htmlTexts(TICKET);
    const ja: Record<string, string> = { "TOTAL:": "合計:", "one perfect morning": "完璧な朝", today: "今日" };
    const out = setHtmlTexts(TICKET, texts.filter((t) => ja[t.text]).map((t) => ({ ...t, text: ja[t.text]! })));
    expect(out).toContain('>合計: <b style="color:#f25a5a" data-mc="e5">完璧な朝</b> 今日</p>');
    expect(out).toContain(">ADMIT ONE</p>");
    // Only the words changed: the same template with the same ids and styles otherwise.
    const back = setHtmlTexts(out, htmlTexts(out).texts.map((t, i) => ({ ...t, text: texts[i]!.text })));
    expect(back).toBe(stampHtmlIds(TICKET).template);
  });
});

describe("an html clip's colours and type", () => {
  it("lists the colours by use: text, fills, lines (any spelling, alpha set aside)", () => {
    const palette = htmlPalette(TICKET);
    expect(palette.map((c) => c.color)).toEqual(["#094a9f", "#f25a5a", "#fff4ea"]);
    expect(palette[0]).toEqual({ color: "#094a9f", text: 3, fill: 1, line: 1 });
    expect(hexColor("#ABC")).toBe("#aabbcc");
    expect(hexColor("rgba(9, 74, 159, 0.5)")).toBe("#094a9f");
  });

  it("swaps colours everywhere, keeping each one's transparency", () => {
    const out = recolorHtml(TICKET, { "#094a9f": "#0b1630", "#f25a5a": "#2e7cff" });
    expect(out).not.toMatch(/#094a9f|#094A9F|#f25a5a/i);
    expect(out).toContain("rgba(11, 22, 48, 0.5)");
    expect(out).toContain('fill="#0b1630"');
    expect(out).toContain("text-shadow:8px 8px 0 #2e7cff");
    expect(out).toContain("background:#fff4ea");
  });

  it("lists the families with the largest size each is set at, and swaps them keeping fallbacks", () => {
    expect(htmlFonts(TICKET)).toEqual([
      { family: "Alfa Slab One", largestPx: 190, uses: 1 },
      { family: "JetBrains Mono", largestPx: 22, uses: 1 },
    ]);
    const out = refontHtml(TICKET, { "alfa slab one": "Fraunces", "JetBrains Mono": "Space Grotesk" });
    expect(out).toContain("font-family:'Fraunces';");
    expect(out).toContain("font-family:'Space Grotesk', monospace;");
  });
});
