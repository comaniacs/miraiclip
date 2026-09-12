/**
 * Captions e2e — karaoke emphasis asserted by color census, not glyph
 * positions: the caption uses pure white (#ffffff) and pure blue (#0000ff),
 * neither of which the e2e-frames fixture can produce (its colors always have
 * B=128), so counting near-white and near-blue pixels across the whole canvas
 * is robust to font rasterization differences.
 */
import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __mirai: {
      project: { dispatch(command: unknown): void };
      player: { seek(us: number): void };
    };
  }
}

interface Census {
  white: number;
  blue: number;
  blueLeft: number;
  blueRight: number;
}

/** Count near-white / near-blue pixels (and blue's left/right split). */
function census(page: Page): Promise<Census> {
  return page.evaluate(() => {
    const canvas = document.getElementById("stage") as HTMLCanvasElement;
    const probe = document.createElement("canvas");
    probe.width = canvas.width;
    probe.height = canvas.height;
    const ctx = probe.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(canvas, 0, 0);
    const { data } = ctx.getImageData(0, 0, probe.width, probe.height);
    const result = { white: 0, blue: 0, blueLeft: 0, blueRight: 0 };
    const mid = probe.width / 2;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      if (r >= 240 && g >= 240 && b >= 240) result.white++;
      else if (b >= 240 && r <= 40 && g <= 40) {
        result.blue++;
        const x = (i / 4) % probe.width;
        if (x < mid) result.blueLeft++;
        else result.blueRight++;
      }
    }
    return result;
  });
}

async function setup(page: Page, preset: string): Promise<void> {
  await page.goto("/?src=/e2e-frames.webm");
  await page.waitForFunction(() => (window as never as { __mirai?: unknown }).__mirai);
  await page.evaluate(
    ([presetArg]) => {
      const { project } = window.__mirai;
      // The default title overlay is white — remove it so every white pixel
      // on the canvas belongs to the caption.
      project.dispatch({ type: "clip/remove", payload: { clipId: "title" } });
      project.dispatch({
        type: "clip/add",
        payload: {
          kind: "caption",
          id: "cap",
          trackId: "overlay",
          startUs: 0,
          durationUs: 2_000_000,
          words: [
            { text: "HELLO", startUs: 0, durationUs: 1_000_000 },
            { text: "WORLD", startUs: 1_000_000, durationUs: 1_000_000 },
          ],
          style: {
            preset: presetArg,
            fontSizeFrac: 0.15,
            color: "#ffffff",
            highlightColor: "#0000ff",
          },
        },
      });
    },
    [preset],
  );
}

function seek(page: Page, us: number): Promise<void> {
  return page.evaluate(([t]) => window.__mirai.player.seek(t as number), [us]);
}

test("karaoke: passed words stay lit, and the caption ends with its clip", async ({ page }) => {
  await setup(page, "karaoke");

  // Word 1 active: HELLO lit blue (started), WORLD still white.
  await seek(page, 500_000);
  await expect.poll(async () => {
    const c = await census(page);
    return c.blue > 200 && c.white > 200;
  }, { timeout: 8_000, message: `word 1: want blue+white, got ${JSON.stringify(await census(page))}` }).toBe(true);

  // Word 2 active: BOTH words have started → all blue, no white left.
  await seek(page, 1_500_000);
  await expect.poll(async () => {
    const c = await census(page);
    return c.blue > 400 && c.white < 50;
  }, { timeout: 8_000, message: `word 2: want all-blue, got ${JSON.stringify(await census(page))}` }).toBe(true);

  // Past the clip: no caption pixels at all.
  await seek(page, 2_500_000);
  await expect.poll(async () => {
    const c = await census(page);
    return c.blue < 20 && c.white < 20;
  }, { timeout: 8_000 }).toBe(true);
});

test("highlight: the lit word flips sides at the word boundary", async ({ page }) => {
  await setup(page, "highlight");

  // Word 1 (HELLO, left of center) is the highlighted one. A wide glyph can
  // shed a few dozen pixels across the midline (WORLD's "W" starts a hair
  // left of center), so assert a 20× majority, not an absolute zero.
  await seek(page, 500_000);
  await expect.poll(async () => {
    const c = await census(page);
    return c.blueLeft > 200 && c.blueRight < c.blueLeft / 20 && c.white > 200;
  }, { timeout: 8_000, message: `word 1: want blue LEFT, got ${JSON.stringify(await census(page))}` }).toBe(true);

  // Word 2 (WORLD, right of center): the highlight flipped sides, HELLO is
  // white again (highlight is not progressive).
  await seek(page, 1_500_000);
  await expect.poll(async () => {
    const c = await census(page);
    return c.blueRight > 200 && c.blueLeft < c.blueRight / 20 && c.white > 200;
  }, { timeout: 8_000, message: `word 2: want blue RIGHT, got ${JSON.stringify(await census(page))}` }).toBe(true);
});
