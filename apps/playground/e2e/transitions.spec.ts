/**
 * Transitions e2e — pixel-asserted against e2e-frames.webm (frame N is the
 * solid color R=(N·16)%256, G=16·⌊N/16⌋, B=128; see golden-frames.spec.ts).
 *
 * Setup used by every test: split the 4s clip at 2s, jump the right half's
 * source 800ms ahead (24 frames — R differs by 128 across the cut, so blends
 * are unmistakable), then bridge the cut with a 1s transition. The window is
 * 1.5s–2.5s, centered on the cut.
 */
import { expect, test, type Page } from "@playwright/test";

const TOLERANCE = 12;
const SKIP_US = 800_000; // 24 frames

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function frameColor(frameIndex: number): Rgb {
  return { r: (frameIndex * 16) % 256, g: 16 * Math.floor(frameIndex / 16), b: 128 };
}

/** The frame on screen at a timeline position, for the outgoing/incoming clip. */
function outFrame(timelineUs: number): Rgb {
  return frameColor(Math.floor((timelineUs * 30) / 1_000_000));
}
function inFrame(timelineUs: number): Rgb {
  return frameColor(Math.floor(((timelineUs + SKIP_US) * 30) / 1_000_000));
}

function mix(a: Rgb, b: Rgb, p: number): Rgb {
  return { r: a.r * (1 - p) + b.r * p, g: a.g * (1 - p) + b.g * p, b: a.b * (1 - p) + b.b * p };
}

function pixelAt(page: Page, fx: number, fy: number): Promise<Rgb> {
  return page.evaluate(
    ([x, y]) => {
      const canvas = document.getElementById("stage") as HTMLCanvasElement;
      const probe = document.createElement("canvas");
      probe.width = probe.height = 1;
      const ctx = probe.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(canvas, Math.round(canvas.width * x!), Math.round(canvas.height * y!), 1, 1, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return { r: r!, g: g!, b: b! };
    },
    [fx, fy],
  );
}

async function expectPixel(page: Page, fx: number, fy: number, want: Rgb, tolerance = TOLERANCE): Promise<void> {
  await expect
    .poll(
      async () => {
        const got = await pixelAt(page, fx, fy);
        return (
          Math.abs(got.r - want.r) <= tolerance &&
          Math.abs(got.g - want.g) <= tolerance &&
          Math.abs(got.b - want.b) <= tolerance
        );
      },
      {
        timeout: 8_000,
        message: `pixel (${fx},${fy}): want ~(${Math.round(want.r)},${Math.round(want.g)},${Math.round(want.b)}), last got ${JSON.stringify(await pixelAt(page, fx, fy))}`,
      },
    )
    .toBe(true);
}

declare global {
  interface Window {
    __mirai: {
      project: { dispatch(command: unknown): void; transaction(fn: () => void): void };
      player: { seek(us: number): void };
      exportProject: (project: unknown, options: unknown) => Promise<Uint8Array>;
    };
  }
}

/** Split at 2s, skip the incoming side 800ms ahead, add the transition. */
async function setup(page: Page, kind: string, params?: Record<string, unknown>): Promise<void> {
  await page.goto("/?src=/e2e-frames.webm");
  await page.waitForFunction(() => (window as never as { __mirai?: unknown }).__mirai);
  await page.evaluate(
    ([kindArg, paramsArg, skipUs]) => {
      const { project } = window.__mirai;
      project.transaction(() => {
        project.dispatch({ type: "clip/split", payload: { clipId: "main", atUs: 2_000_000, newClipId: "right" } });
        project.dispatch({
          type: "clip/trim",
          payload: { clipId: "right", trimStartUs: 2_000_000 + (skipUs as number), durationUs: 2_000_000 - (skipUs as number) },
        });
        project.dispatch({
          type: "transition/add",
          payload: {
            id: "t1",
            kind: kindArg,
            fromClipId: "main",
            toClipId: "right",
            durationUs: 1_000_000,
            ...(paramsArg ? { params: paramsArg } : {}),
          },
        });
      });
      // Text overlay off — every sampled pixel should be pure video.
      project.dispatch({ type: "clip/remove", payload: { clipId: "title" } });
    },
    [kind, params, SKIP_US] as const,
  );
}

function seek(page: Page, us: number): Promise<void> {
  return page.evaluate(([t]) => window.__mirai.player.seek(t as number), [us]);
}

test("cross dissolve blends the exact frame colors through the window", async ({ page }) => {
  await setup(page, "crossDissolve");

  // Before the window: pure outgoing frame.
  await seek(page, 1_016_666);
  await expectPixel(page, 0.5, 0.5, outFrame(1_016_666));

  // p = 0.25: 75% outgoing frame 52 + 25% incoming frame 76.
  await seek(page, 1_750_000);
  await expectPixel(page, 0.5, 0.5, mix(outFrame(1_750_000), inFrame(1_750_000), 0.25));

  // Just past the cut (p ≈ 0.517): the outgoing clip renders PAST its end.
  await seek(page, 2_016_666);
  await expectPixel(page, 0.5, 0.5, mix(outFrame(2_016_666), inFrame(2_016_666), 0.516666));

  // After the window: pure incoming frame.
  await seek(page, 2_616_666);
  await expectPixel(page, 0.5, 0.5, inFrame(2_616_666));
});

test("wipe reveals the incoming clip from the sweeping edge", async ({ page }) => {
  await setup(page, "wipe", { direction: "right" });
  // p = 0.25, edge sweeping right: the left quarter shows the incoming clip,
  // the rest still shows the outgoing one — two different pixel colors at once.
  await seek(page, 1_750_000);
  await expectPixel(page, 0.1, 0.5, inFrame(1_750_000));
  await expectPixel(page, 0.6, 0.5, outFrame(1_750_000));
});

test("slide pushes the incoming clip in over the outgoing one", async ({ page }) => {
  await setup(page, "slide", { direction: "left" });
  // p = 0.25 moving left: the incoming clip's left edge sits at 75% width.
  await seek(page, 1_750_000);
  await expectPixel(page, 0.9, 0.5, inFrame(1_750_000));
  await expectPixel(page, 0.4, 0.5, outFrame(1_750_000));
});

test("dip to black is fully opaque exactly at the cut", async ({ page }) => {
  await setup(page, "dipToBlack");

  // p = 0.25 → overlay alpha 0.5 over the outgoing frame.
  await seek(page, 1_750_000);
  const dimmed = outFrame(1_750_000);
  await expectPixel(page, 0.5, 0.5, { r: dimmed.r / 2, g: dimmed.g / 2, b: dimmed.b / 2 });

  // The cut: pure black — the clip swap underneath is never visible.
  await seek(page, 2_000_000);
  await expectPixel(page, 0.5, 0.5, { r: 0, g: 0, b: 0 });

  // Window over: the incoming clip, no overlay.
  await seek(page, 2_616_666);
  await expectPixel(page, 0.5, 0.5, inFrame(2_616_666));
});

test("the dissolve is baked into exported files (same compositor)", async ({ page }) => {
  test.setTimeout(120_000);
  await setup(page, "crossDissolve");
  const sampled = await page.evaluate(async () => {
    const { project, exportProject } = window.__mirai;
    const bytes = await exportProject(project, {
      format: "webm",
      quality: "draft",
      range: { startUs: 1_000_000, endUs: 3_000_000 },
    });
    const blob = new Blob([bytes as BlobPart], { type: "video/webm" });
    const video = document.createElement("video");
    video.src = URL.createObjectURL(blob);
    video.muted = true;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error("native decoder rejected the export"));
    });
    video.currentTime = 0.75 + 0.016; // timeline 1.766s — mid-window, p ≈ 0.27
    await new Promise((resolve) => (video.onseeked = resolve));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(video, 0, 0);
    const d = ctx.getImageData(Math.round(canvas.width / 2), Math.round(canvas.height / 2), 1, 1).data;
    return { r: d[0]!, g: d[1]!, b: d[2]! };
  });
  // timeline 1.766s: p = 0.266 — a blend, not either pure frame.
  const want = mix(outFrame(1_766_000), inFrame(1_766_000), 0.266);
  const encodeTolerance = 22; // draft VP9 round-trip
  expect(Math.abs(sampled.r - want.r), JSON.stringify({ sampled, want })).toBeLessThanOrEqual(encodeTolerance);
  expect(Math.abs(sampled.g - want.g), JSON.stringify({ sampled, want })).toBeLessThanOrEqual(encodeTolerance);
  expect(Math.abs(sampled.b - want.b), JSON.stringify({ sampled, want })).toBeLessThanOrEqual(encodeTolerance);
});
