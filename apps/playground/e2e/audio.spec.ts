/**
 * Audio e2e — the audio-sources package, provenance and fades in the browser:
 * library search → importAudio, the LLM tools, waveform peaks, credits.
 */
import { expect, test, type Page } from "@playwright/test";

interface Doc {
  assets: Record<string, { kind: string; name?: string; src: string; source?: { provider: string; id: string }; license?: { id: string } }>;
  clips: Record<string, { kind: string; assetId: string; startUs: number; volume?: number; fadeInUs?: number }>;
}
const doc = (page: Page) =>
  page.evaluate(() => (window as never as { __mirai: { project: { getState(): { doc: unknown } } } }).__mirai.project.getState().doc) as Promise<Doc>;

async function openAudioTab(page: Page): Promise<void> {
  await page.goto("/?src=/e2e-tone.webm");
  await page.waitForFunction(() => (window as never as { __mirai?: unknown }).__mirai);
  await page.locator(".panel-tabs button", { hasText: "Audio" }).click();
  await expect(page.locator(".au-item").first()).toBeVisible();
}

test("library search → add records source and license in one undo step", async ({ page }) => {
  await openAudioTab(page);
  await page.locator(".au-kind").selectOption("sfx");
  await page.locator(".au-query").fill("transition");
  await expect(page.locator(".au-item strong")).toHaveText(["Whoosh", "Riser"]);

  await page.locator(".au-item", { hasText: "Whoosh" }).locator(".au-add").click();
  await expect.poll(async () => Object.values((await doc(page)).clips).filter((c) => c.kind === "audio").length).toBe(1);
  const d = await doc(page);
  const asset = Object.values(d.assets).find((a) => a.kind === "audio")!;
  expect(asset).toMatchObject({ name: "Whoosh", src: "/audio/sfx-whoosh.webm", source: { provider: "demo", id: "sfx-whoosh" }, license: { id: "CC0-1.0" } });

  await page.locator(".panel-footer button", { hasText: "Undo" }).click();
  await expect.poll(async () => Object.values((await doc(page)).assets).filter((a) => a.kind === "audio").length).toBe(0);
});

test("project audio shows a real waveform and edits fades", async ({ page }) => {
  await openAudioTab(page);
  await page.locator(".au-item", { hasText: "Sunny Steps" }).locator(".au-add").click();
  const wave = page.locator(".au-clip .au-wave").first();
  await expect(wave).toBeVisible();
  // Peaks were decoded and drawn: some lit pixels in the canvas.
  await expect
    .poll(() =>
      wave.evaluate((c: HTMLCanvasElement) => {
        const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        let lit = 0;
        for (let i = 1; i < data.length; i += 4) if (data[i]! > 150) lit++;
        return lit;
      }),
      { timeout: 10_000 },
    )
    .toBeGreaterThan(200);

  const fadeIn = page.locator(".au-clip input[type=range]").nth(1);
  await fadeIn.evaluate((input: HTMLInputElement) => {
    input.value = "2000000";
    input.dispatchEvent(new Event("change"));
  });
  await expect.poll(async () => Object.values((await doc(page)).clips).find((c) => c.kind === "audio")?.fadeInUs).toBe(2_000_000);
});

test("AI tools: search_audio then add_audio by id; credits and license report", async ({ page }) => {
  await openAudioTab(page);
  await page.locator(".au-tool-input").fill(JSON.stringify({ name: "search_audio", input: { query: "chill", provider: "demo" } }));
  await page.locator(".au-run-tool").click();
  await expect(page.locator(".au-tool-out")).toContainText('"id": "lofi-loop"');

  await page.locator(".au-tool-input").fill(JSON.stringify({ name: "add_audio", input: { provider: "demo", id: "lofi-loop", atSeconds: 0.5, volume: 0.3 } }));
  await page.locator(".au-run-tool").click();
  await expect(page.locator(".au-tool-out")).toContainText('"ok": true');
  const clip = Object.values((await doc(page)).clips).find((c) => c.kind === "audio")!;
  expect(clip).toMatchObject({ startUs: 500_000, volume: 0.3 });

  // CC0 needs no credit; an NC-licensed asset is flagged for commercial use.
  await page.evaluate(() => {
    const p = (window as never as { __mirai: { project: { dispatch(c: unknown): void; getState(): { doc: { tracks: Record<string, { kind: string }> } } } } }).__mirai.project;
    const audioTrack = Object.values(p.getState().doc.tracks).find((t) => t.kind === "audio") as unknown as { id: string };
    p.dispatch({
      type: "asset/add",
      payload: {
        id: "nc", kind: "audio", src: "/audio/calm-drift.webm", durationUs: 32_000_000, name: "Jam",
        source: { provider: "openverse", id: "x" },
        license: { id: "CC-BY-NC-4.0", commercial: false, attributionRequired: true },
        attribution: "“Jam” by Ann, CC BY-NC 4.0",
      },
    });
    p.dispatch({ type: "clip/add", payload: { kind: "audio", id: "nc-clip", trackId: audioTrack.id, assetId: "nc", startUs: 40_000_000, durationUs: 1_000_000 } });
  });
  await expect(page.locator(".au-license")).toContainText("“Jam” by Ann, CC BY-NC 4.0");
  await page.locator(".au-commercial-use").check();
  await expect(page.locator(".au-license")).toContainText("[non-commercial]");
});
