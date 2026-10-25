// @vitest-environment jsdom
/** The stage kit's helpers, run the way a scripted frame runs them (anime.js, then the kit). */
import { describe, expect, it } from "vitest";
import { ANIME_SOURCE, STAGE_KIT_SOURCE } from "../src/stage/stage.generated.js";

async function build(markup: string, body: (tl: Record<string, (...a: unknown[]) => unknown>, S: Record<string, (...a: unknown[]) => unknown>) => void, duration = 4): Promise<HTMLElement> {
  const w = window as unknown as Record<string, unknown>;
  delete w.stage;
  delete w.__miraiclipSeek;
  document.body.innerHTML = `<div class="stage" data-libs="stage" data-duration="${duration}">${markup}</div>`;
  (0, eval)(ANIME_SOURCE);
  (0, eval)(STAGE_KIT_SOURCE);
  (w.stage as { build: (fn: typeof body) => void }).build(body);
  await (w.__miraiclipReady as Promise<void>);
  return document.querySelector(".stage") as HTMLElement;
}

describe("stage kit", () => {
  it("S.split keeps child elements and splits inside them", async () => {
    let spans: HTMLElement[] = [];
    const root = await build(`<div class="world"><p class="l">Ten tools. <em>Ten bills.</em></p></div>`, (tl, S) => {
      spans = S.split(".l", "words") as HTMLElement[];
      tl.label("a", 0).from(".l .word", { opacity: 0, duration: 0.4, stagger: 0.1 }, "a");
    });
    expect(root.getAttribute("data-stage-error")).toBeNull();
    expect(spans.map((s) => s.textContent)).toEqual(["Ten", "tools.", "Ten", "bills."]);
    expect(root.querySelectorAll(".l em .word")).toHaveLength(2);
    expect(root.querySelector(".l")!.textContent).toBe("Ten tools. Ten bills.");
  });

  it("maps steps(n) easing", async () => {
    const root = await build(`<div class="world"><i class="c"></i></div>`, (tl) => {
      tl.label("a", 0).fromTo(".c", { opacity: 1 }, { opacity: 0, duration: 1, ease: "steps(4)" }, "a");
    });
    expect(root.getAttribute("data-stage-error")).toBeNull();
    const seek = (window as unknown as { __miraiclipSeek: (t: number) => void }).__miraiclipSeek;
    const opacity = (t: number) => (seek(t), Number((root.querySelector(".c") as HTMLElement).style.opacity));
    expect(opacity(0.3)).toBeCloseTo(0.75, 2); // a hard step, not 0.7
    expect(opacity(0.6)).toBeCloseTo(0.5, 2);
  });
});
