import { afterEach, describe, expect, it, vi } from "vitest";
import { openAIChatModel, rateLimitedChatModel, retryDelayMs, scriptedChatModel, type FetchLike } from "../src/index.js";

afterEach(() => vi.useRealTimers());

describe("openAIChatModel retries", () => {
  it("waits as asked on 429 and succeeds", async () => {
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls++;
      if (calls < 3) return Response.json({ error: { message: "Rate limit reached … Please try again in 20ms." } }, { status: 429 });
      return Response.json({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] });
    };
    const res = await openAIChatModel({ model: "m", fetch, stream: false }).complete({ messages: [] });
    expect(res.content).toBe("ok");
    expect(calls).toBe(3);
  });
  it("gives up after maxRetries, and never retries client errors", async () => {
    let calls = 0;
    const always429: FetchLike = async () => (calls++, Response.json({ error: { message: "try again in 1ms" } }, { status: 429 }));
    await expect(openAIChatModel({ model: "m", fetch: always429, maxRetries: 2 }).complete({ messages: [] })).rejects.toMatchObject({ status: 429 });
    expect(calls).toBe(3);
    calls = 0;
    const bad: FetchLike = async () => (calls++, Response.json({ error: { message: "bad key" } }, { status: 401 }));
    await expect(openAIChatModel({ model: "m", fetch: bad }).complete({ messages: [] })).rejects.toMatchObject({ status: 401 });
    expect(calls).toBe(1);
    calls = 0;
    const broke: FetchLike = async () => (calls++, Response.json({ error: { message: "You have no credits remaining." } }, { status: 429 }));
    await expect(openAIChatModel({ model: "m", fetch: broke }).complete({ messages: [] })).rejects.toMatchObject({ status: 429 });
    expect(calls).toBe(1); // waiting doesn't add credits
  });
  it("reads Retry-After and the message's hint", () => {
    const h = (o: Record<string, string>) => ({ headers: new Headers(o) });
    expect(retryDelayMs(h({ "retry-after": "2" }), "", 0)).toBeGreaterThanOrEqual(2250);
    expect(retryDelayMs(h({}), "Please try again in 1.5s.", 0)).toBeGreaterThanOrEqual(1750);
    expect(retryDelayMs(h({}), "Please try again in 300ms.", 0)).toBeGreaterThanOrEqual(550);
    expect(retryDelayMs(h({}), "overloaded", 3)).toBeGreaterThanOrEqual(8000);
  });
});

describe("rateLimitedChatModel", () => {
  it("holds calls until the rolling minute has room, then uses real usage", async () => {
    vi.useFakeTimers();
    // scriptedChatModel reports 15 tokens per call.
    const model = rateLimitedChatModel(scriptedChatModel(["a"]), { tokensPerMinute: 1000, estimate: () => 400 });
    const done: number[] = [];
    const call = (i: number) => model.complete({ messages: [] }).then(() => done.push(i));
    void call(1);
    void call(2);
    await vi.advanceTimersByTimeAsync(10);
    // After the two complete, their reservations shrink to the real 15 tokens each, so a third fits right away.
    void call(3);
    await vi.advanceTimersByTimeAsync(10);
    expect(done).toEqual([1, 2, 3]);
  });
  it("waits out the window when estimates fill it", async () => {
    vi.useFakeTimers();
    const slow = { ...scriptedChatModel(["a"]), complete: async () => ({ content: "", toolCalls: [], finish: "stop" as const }) }; // no usage reported
    const model = rateLimitedChatModel(slow, { tokensPerMinute: 1000, estimate: () => 600 });
    const done: number[] = [];
    void model.complete({ messages: [] }).then(() => done.push(1));
    void model.complete({ messages: [] }).then(() => done.push(2));
    await vi.advanceTimersByTimeAsync(1000);
    expect(done).toEqual([1]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(done).toEqual([1, 2]);
  });
  it("limits requests per minute", async () => {
    vi.useFakeTimers();
    const model = rateLimitedChatModel(scriptedChatModel(["a"]), { requestsPerMinute: 2 });
    const done: number[] = [];
    for (const i of [1, 2, 3]) void model.complete({ messages: [] }).then(() => done.push(i));
    await vi.advanceTimersByTimeAsync(100);
    expect(done).toEqual([1, 2]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(done).toEqual([1, 2, 3]);
  });
});
