/**
 * Assistant e2e — @miraiclip/assistant in the browser: the agent loop runs
 * real tools on a copy of the project and lands each request as one undo
 * step. Uses the offline scripted model, and a mocked /api/assistant backend
 * for the remote (streaming) path.
 */
import { expect, test, type Page } from "@playwright/test";

type Mirai = { project: { getState(): { doc: { clips: Record<string, { kind: string; startUs: number; durationUs: number; animations?: Record<string, unknown[]> }>; transitions: Record<string, { kind: string; params: Record<string, unknown> }> } }; dispatch(c: unknown): void } };
const doc = (page: Page) => page.evaluate(() => (window as never as { __mirai: Mirai }).__mirai.project.getState().doc);

async function setup(page: Page): Promise<void> {
  await page.goto("/?src=/e2e-tone.webm");
  await page.waitForFunction(() => (window as never as { __mirai?: unknown }).__mirai);
  // A cut (split the video in two) and a title to animate.
  await page.evaluate(() => {
    const { project } = (window as never as { __mirai: Mirai }).__mirai;
    const clips = Object.entries(project.getState().doc.clips);
    const [id, video] = clips.find(([, c]) => c.kind === "video")!;
    project.dispatch({ type: "clip/split", payload: { clipId: id, atUs: Math.round(video.startUs + video.durationUs / 2), newClipId: "second" } });
    const trackId = (project.getState().doc as unknown as { trackOrder: string[] }).trackOrder[0];
    project.dispatch({ type: "track/add", payload: { id: "e2e-titles", kind: "video" } });
    project.dispatch({ type: "clip/add", payload: { kind: "text", id: "e2e-title", trackId: "e2e-titles", startUs: 0, durationUs: 1_500_000, text: "Hello" } });
    void trackId;
  });
  await page.locator(".panel-tabs button", { hasText: "AI" }).click();
}

test("offline model: one request adds a transition and an animation, undone in one step", async ({ page }) => {
  await setup(page);
  await expect(page.locator(".as-model")).toContainText("Offline demo");
  await page.locator(".as-input").fill("smooth the cut and animate the title");
  await page.locator(".as-send").click();
  await expect(page.locator(".as-changes li")).toHaveText([/Added crossDissolve at/, /^(\S+): Pop in · Fade out$/]);
  const animated = (await page.locator(".as-changes li").nth(1).textContent())!.split(":")[0]!;
  const d = await doc(page);
  expect(Object.values(d.transitions).map((t) => t.kind)).toEqual(["crossDissolve"]);
  expect(Object.keys(d.clips[animated]!.animations ?? {}).sort()).toEqual(["opacity", "scale"]);

  await page.locator(".as-log .panel-footer button", { hasText: "Undo" }).click();
  const after = await doc(page);
  expect(Object.keys(after.transitions)).toHaveLength(0);
  expect(after.clips[animated]!.animations ?? {}).toEqual({});
});

test("remote model (mocked backend): streamed reply, review then apply", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/assistant/**", async (route) => {
    const req = route.request();
    if (req.method() === "GET") return route.fulfill({ json: { id: "openai", label: "OpenAI", models: [{ id: "gpt-test" }] } });
    calls++;
    const body = req.postDataJSON() as { request: { messages: { role: string }[]; tools: { name: string }[] } };
    expect(body.request.tools.map((t) => t.name)).toContain("add_transition");
    const lines =
      calls === 1
        ? [{ type: "done", response: { content: "", toolCalls: [{ id: "c1", name: "add_transition", arguments: { kind: "wipe", allCuts: true, direction: "up" } }], finish: "tool_calls" } }]
        : [
            { type: "text", delta: "Added an upward " },
            { type: "text", delta: "wipe." },
            { type: "done", response: { content: "Added an upward wipe.", toolCalls: [], finish: "stop", usage: { inputTokens: 900, outputTokens: 12 } } },
          ];
    return route.fulfill({ contentType: "application/x-ndjson", body: lines.map((l) => JSON.stringify(l)).join("\n") + "\n" });
  });
  await setup(page);
  await expect(page.locator(".as-model")).toContainText("OpenAI · gpt-test");
  await page.locator(".as-review").check();
  await page.locator(".as-input").fill("wipe up on every cut");
  await page.locator(".as-send").click();
  await expect(page.locator(".as-bot").last()).toHaveText("Added an upward wipe.");
  await expect(page.locator(".as-usage")).toContainText("review");
  expect(Object.keys((await doc(page)).transitions)).toHaveLength(0);
  await page.locator(".panel-footer button", { hasText: /Apply 1 change/ }).click();
  const d = await doc(page);
  expect(Object.values(d.transitions)).toMatchObject([{ kind: "wipe", params: { direction: "up" } }]);
});
