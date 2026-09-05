/**
 * Golden-frame tests against a deterministic fixture: every frame of
 * e2e-frames.webm (320×180, 30fps, 4s, VP9, 1s GOP) is a solid color that
 * encodes its own frame index — R = (N·16) mod 256, G = 16·⌊N/16⌋, B = 128 —
 * so "which frame is on screen" is read straight off the canvas, robust
 * across GPUs (no image snapshots). VP9 because Playwright's Chromium ships
 * no H.264 decoder.
 */
import { expect, test, type Page } from "@playwright/test";

const FPS = 30;
const FRAME_US = 1_000_000 / FPS;
const TOLERANCE = 12; // yuv420 quantization + upscale filtering

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function expectedColor(frameIndex: number): Rgb {
  return { r: (frameIndex * 16) % 256, g: 16 * Math.floor(frameIndex / 16), b: 128 };
}

function frameFromColor(pixel: Rgb): number {
  return Math.round(pixel.g / 16) * 16 + Math.round(pixel.r / 16);
}

function centerPixel(page: Page): Promise<Rgb> {
  return page.evaluate(() => {
    const canvas = document.getElementById("stage") as HTMLCanvasElement;
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    const ctx = probe.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(canvas, canvas.width / 2, canvas.height / 2, 1, 1, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return { r: r!, g: g!, b: b! };
  });
}

async function expectFrame(page: Page, frameIndex: number): Promise<void> {
  const want = expectedColor(frameIndex);
  const matches = (pixel: Rgb) =>
    Math.abs(pixel.r - want.r) <= TOLERANCE &&
    Math.abs(pixel.g - want.g) <= TOLERANCE &&
    Math.abs(pixel.b - want.b) <= TOLERANCE;
  // Decode is async — poll until the exact frame is presented.
  await expect
    .poll(async () => matches(await centerPixel(page)), {
      timeout: 5_000,
      message: `frame ${frameIndex}: want ~${JSON.stringify(want)}, last got ${JSON.stringify(await centerPixel(page))}`,
    })
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/?src=/e2e-frames.webm");
  await page.waitForFunction(() => (window as never as { __mirai?: unknown }).__mirai);
});

test("paused seeks land on the exact frame, including mid-GOP", async ({ page }) => {
  // Frame 45 is mid-GOP (keyframes at 0, 30, 60, 90): the settle pattern must
  // decode 15 lead-in frames and present exactly frame 45.
  for (const frameIndex of [45, 10, 100, 31]) {
    await page.evaluate(
      ([us]) => (window as never as { __mirai: { player: { seek(us: number): void } } }).__mirai.player.seek(us!),
      [Math.round(frameIndex * FRAME_US) + 1_000], // just inside the frame
    );
    await expectFrame(page, frameIndex);
  }
});

test("displayed frames track the master clock during playback (no storms, no stalls)", async ({ page }) => {
  // The invariant a re-seek storm (or black video) breaks: whatever the clock
  // says, the frame on screen is the one covering it. Asserting against the
  // player's own clock — not wall time — keeps this exact even in headless
  // environments where the fake audio device's clock runs slow under load.
  await page.evaluate(() => (window as never as { __mirai: { player: { play(): void } } }).__mirai.player.play());
  const samples: { shown: number; clock: number }[] = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(250);
    const clockUs = await page.evaluate(
      () => (window as never as { __mirai: { player: { timeUs: number } } }).__mirai.player.timeUs,
    );
    samples.push({ shown: frameFromColor(await centerPixel(page)), clock: Math.floor(clockUs / FRAME_US) });
  }
  const trace = samples.map((s) => `${s.shown}@${s.clock}`).join(" ");
  // The clock actually ran (max, not last — the 4s composition loops)…
  const maxClock = Math.max(...samples.map((s) => s.clock));
  expect(maxClock, trace).toBeGreaterThan(samples[0]!.clock + 5);
  // …frames advanced monotonically. A drop of most of the composition (120
  // frames) is the loop wrapping — legal; a small backward step is a storm.
  for (let i = 1; i < samples.length; i++) {
    const drop = samples[i - 1]!.shown - samples[i]!.shown;
    expect(drop <= 0 || drop > 60, trace).toBe(true);
  }
  // …and each displayed frame sat within ~300ms of the clock (a storm shows
  // seconds of divergence; steady playback shows 0–3 frames, briefly more at
  // the loop seam).
  for (const sample of samples) {
    expect(Math.abs(sample.shown - sample.clock), trace).toBeLessThanOrEqual(9);
  }
});

test("no console errors during load, seek, and playback", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("favicon")) errors.push(message.text());
  });
  await page.evaluate(() => {
    const { player } = (window as never as { __mirai: { player: { play(): void; seek(us: number): void } } }).__mirai;
    player.seek(2_000_000);
    player.play();
  });
  await page.waitForTimeout(1_500);
  expect(errors).toEqual([]);
});
