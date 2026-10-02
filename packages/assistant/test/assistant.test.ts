import { describe, expect, it } from "vitest";
import { createProject, readAnimation, type Clip } from "@miraiclip/core";
import {
  createAssistant,
  createChatHandler,
  editorTools,
  openAIChatModel,
  remoteChatModel,
  scriptedChatModel,
  toolsFromDefinitions,
  type FetchLike,
} from "../src/index.js";

const S = 1_000_000;

function demo() {
  const p = createProject({ width: 1280, height: 720, fps: 30 });
  p.transaction(() => {
    p.dispatch({ type: "asset/add", payload: { id: "film", kind: "video", src: "film.mp4", durationUs: 40 * S } });
    p.dispatch({ type: "track/add", payload: { id: "v", kind: "video" } });
    p.dispatch({ type: "track/add", payload: { id: "titles", kind: "video" } });
    p.dispatch({ type: "clip/add", payload: { kind: "video", id: "v1", trackId: "v", assetId: "film", startUs: 0, durationUs: 10 * S } });
    p.dispatch({ type: "clip/add", payload: { kind: "video", id: "v2", trackId: "v", assetId: "film", startUs: 10 * S, durationUs: 5 * S, trimStartUs: 11 * S } });
    p.dispatch({ type: "clip/add", payload: { kind: "video", id: "v3", trackId: "v", assetId: "film", startUs: 15 * S, durationUs: 5 * S, trimStartUs: 22 * S } });
    p.dispatch({ type: "clip/add", payload: { kind: "text", id: "title", trackId: "titles", startUs: S, durationUs: 4 * S, text: "Hello" } });
  });
  p.clearHistory();
  return p;
}

describe("agent loop", () => {
  it("runs tools on a copy and lands the whole request as ONE undo step", async () => {
    const project = demo();
    const model = scriptedChatModel([
      { text: "On it.", toolCalls: [{ name: "add_transition", arguments: { kind: "crossDissolve", allCuts: true, durationSeconds: 0.8 } }] },
      { toolCalls: [{ name: "animate_clip", arguments: { clipId: "title", in: "pop", out: "fade" } }] },
      "Added dissolves on both cuts and a pop-in on the title.",
    ]);
    const events: string[] = [];
    const turn = await createAssistant({ model }).run(project, "smooth cuts and animate the title", {
      context: "Selected: clip title.",
      onEvent: (e) => events.push(e.type === "tool-end" ? `end:${e.call.name}:${e.ok}` : e.type),
    });

    expect(turn.status).toBe("applied");
    expect(turn.reply).toBe("Added dissolves on both cuts and a pop-in on the title.");
    expect(turn.changes).toEqual([
      "Added crossDissolve at 10s (0.8s)",
      "Added crossDissolve at 15s (0.8s)",
      "title: Pop in · Fade out",
    ]);
    expect(events).toContain("end:add_transition:true");
    const doc = project.getState().doc;
    expect(Object.values(doc.transitions).map((t) => t.kind)).toEqual(["crossDissolve", "crossDissolve"]);
    expect(readAnimation(doc.clips.title as Clip).recipe).toMatchObject({ in: { preset: "in:pop" }, out: { preset: "out:fade" } });
    // One step back undoes all of it.
    expect(project.canUndo()).toBe(true);
    project.undo();
    expect(Object.keys(project.getState().doc.transitions)).toHaveLength(0);
    expect(project.canUndo()).toBe(false);

    // The model saw the project and the app context in its system prompt, and every tool.
    const first = model.requests[0]!;
    expect(first.messages[0]!.role).toBe("system");
    expect(first.messages[0]!.content).toContain("v2: video");
    expect(first.messages[0]!.content).toContain("Selected: clip title.");
    expect(first.tools!.map((t) => t.name)).toEqual(["get_state", "get_command_schema", "apply_commands", "add_transition", "animate_clip"]);
    // History for the next turn: no system prompt, tool results paired with calls.
    expect(turn.messages[0]).toEqual({ role: "user", content: "smooth cuts and animate the title" });
    expect(turn.messages.filter((m) => m.role === "tool")).toHaveLength(2);
  });

  it("replays commands with the ids the model saw (split → edit the new half)", async () => {
    const project = demo();
    const model = scriptedChatModel([
      { toolCalls: [{ name: "apply_commands", arguments: { commands: [{ type: "clip/split", payload: { clipId: "v1", atUs: 5 * S } }] } }] },
      (request) => {
        // Read the new clip's id from the copy's state, as a model would.
        const last = request.messages.at(-1)!;
        expect(last.role).toBe("tool");
        return { toolCalls: [{ name: "get_state", arguments: {} }] };
      },
      (request) => {
        const state = String(request.messages.at(-1)!.content);
        const id = /(clip-[a-z0-9]+): video/.exec(state)![1]!;
        return { toolCalls: [{ name: "apply_commands", arguments: { commands: [{ type: "clip/set-property", payload: { clipId: id, volume: 0.5 } }] } }] };
      },
      "Split and lowered the second half.",
    ]);
    const turn = await createAssistant({ model }).run(project, "split at 5s and lower the second half");
    expect(turn.status).toBe("applied");
    const halves = Object.values(project.getState().doc.clips).filter((c) => c.trackId === "v" && c.startUs < 10 * S);
    expect(halves.map((c) => [c.startUs, "volume" in c ? c.volume : null])).toEqual([[0, 1], [5 * S, 0.5]]);
  });

  it("feeds tool errors back so the model can correct itself", async () => {
    const project = demo();
    const model = scriptedChatModel([
      { toolCalls: [{ name: "apply_commands", arguments: { commands: [{ type: "clip/move", payload: { clipId: "nope", startUs: 0 } }] } }] },
      (request) => {
        const result = JSON.parse(String(request.messages.at(-1)!.content));
        expect(result).toMatchObject({ ok: false, error: { ok: false, failedIndex: 0, error: { kind: "rejected" } } });
        return { toolCalls: [{ name: "apply_commands", arguments: { commands: [{ type: "clip/move", payload: { clipId: "title", startUs: 2 * S } }] } }] };
      },
      "Moved the title to 2s.",
    ]);
    const turn = await createAssistant({ model }).run(project, "move the title to 2s");
    expect(turn.status).toBe("applied");
    expect(turn.changes).toEqual(["Moved clip title to 2s"]);
    expect(project.getState().doc.clips.title!.startUs).toBe(2 * S);
  });

  it("review mode waits; discard leaves the project untouched; a failed model call changes nothing", async () => {
    const project = demo();
    const before = project.getState().doc;
    const model = scriptedChatModel([{ toolCalls: [{ name: "add_transition", arguments: { kind: "wipe", nearSeconds: 14, direction: "up" } }] }, "Added a wipe."]);
    const turn = await createAssistant({ model }).run(project, "wipe", { apply: "review" });
    expect(turn.status).toBe("review");
    expect(project.getState().doc).toBe(before);
    expect(Object.values(turn.preview.transitions)[0]).toMatchObject({ kind: "wipe", fromClipId: "v2", params: { direction: "up" } });
    turn.discard();
    expect(turn.apply()).toMatchObject({ ok: false });
    expect(project.getState().doc).toBe(before);

    const again = await createAssistant({ model: scriptedChatModel([{ toolCalls: [{ name: "add_transition", arguments: { kind: "wipe", nearSeconds: 14 } }] }, "ok"]) }).run(project, "wipe", { apply: "review" });
    expect(again.apply()).toEqual({ ok: true, applied: 1 });
    expect(Object.keys(project.getState().doc.transitions)).toHaveLength(1);

    const broken = createAssistant({
      model: { id: "x", label: "x", complete: async () => Promise.reject(new Error("rate limited")) },
    });
    const failed = await broken.run(project, "anything");
    expect(failed).toMatchObject({ status: "failed", error: "rate limited" });
  });

  it("skips cuts without spare footage and says why", async () => {
    const project = demo();
    project.dispatch({ type: "clip/trim", payload: { clipId: "v2", trimStartUs: 0 } });
    const model = scriptedChatModel([{ toolCalls: [{ name: "add_transition", arguments: { kind: "dipToBlack", allCuts: true } }] }, "done"]);
    const turn = await createAssistant({ model }).run(project, "dip all cuts");
    const result = JSON.parse(turn.messages.find((m) => m.role === "tool")!.content);
    expect(result.changed).toBe(1);
    expect(result.skipped[0]).toMatchObject({ fromClipId: "v1", toClipId: "v2", reason: expect.stringContaining("second clip") });
  });

  it("reports a conflict instead of applying when the project changed underneath", async () => {
    const project = demo();
    const model = scriptedChatModel([{ toolCalls: [{ name: "animate_clip", arguments: { clipId: "title", in: "fade" } }] }, "Faded in."]);
    const turn = await createAssistant({ model }).run(project, "fade the title", { apply: "review" });
    project.dispatch({ type: "clip/remove", payload: { clipId: "title" } });
    const result = turn.apply();
    expect(result.ok).toBe(false);
    expect(project.getState().doc.clips.title).toBeUndefined();
  });

  it("repairs interrupted history and adopts definition-style tools", async () => {
    const calls: string[] = [];
    const tools = [
      ...editorTools(),
      ...toolsFromDefinitions([{ name: "search_audio", description: "Search", input_schema: { type: "object", properties: { query: { type: "string" } } } }], async (name, input) => {
        calls.push(`${name}:${input.query}`);
        return { ok: true, result: { items: [] } };
      }),
    ];
    const model = scriptedChatModel([{ toolCalls: [{ name: "search_audio", arguments: { query: "rain" } }] }, "Nothing found."]);
    const turn = await createAssistant({ model, tools }).run(demo(), "find rain", {
      history: [
        { role: "user", content: "earlier" },
        { role: "assistant", content: "", toolCalls: [{ id: "lost", name: "get_state", arguments: {} }] },
      ],
    });
    expect(calls).toEqual(["search_audio:rain"]);
    expect(turn.status).toBe("no-changes");
    const sent = model.requests[0]!.messages;
    expect(sent[3]).toMatchObject({ role: "tool", toolCallId: "lost" });
  });
});

/* ---------- OpenAI adapter ---------- */

function sse(chunks: unknown[]): Response {
  const text = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
  // Split mid-line to exercise buffering.
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(bytes.slice(0, 37));
      c.enqueue(bytes.slice(37));
      c.close();
    },
  });
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

describe("openAIChatModel", () => {
  it("maps messages and tools, streams text, joins tool-call fragments", async () => {
    const sent: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
    const fetch: FetchLike = async (url, init) => {
      sent.push({ url, headers: init!.headers as Record<string, string>, body: JSON.parse(String(init!.body)) });
      return sse([
        { model: "gpt-test", choices: [{ delta: { content: "Hel" } }] },
        { choices: [{ delta: { content: "lo" } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "animate_", arguments: '{"clipId":' } }] } }] },
        { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "clip", arguments: '"t1"}' } }] } }] },
        { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
        { choices: [], usage: { prompt_tokens: 120, completion_tokens: 9 } },
      ]);
    };
    const model = openAIChatModel({ apiKey: "sk-test", model: "gpt-test", fetch, params: { reasoning_effort: "low" } });
    const deltas: string[] = [];
    const res = await model.complete(
      {
        messages: [
          { role: "system", content: "sys" },
          { role: "user", content: "hi" },
          { role: "assistant", content: "", toolCalls: [{ id: "c0", name: "get_state", arguments: {} }] },
          { role: "tool", toolCallId: "c0", name: "get_state", content: "state" },
        ],
        tools: [{ name: "get_state", description: "d", inputSchema: { type: "object" } }],
        maxOutputTokens: 500,
      },
      { onText: (d) => deltas.push(d) },
    );
    expect(deltas).toEqual(["Hel", "lo"]);
    expect(res).toEqual({
      content: "Hello",
      toolCalls: [{ id: "call_1", name: "animate_clip", arguments: { clipId: "t1" } }],
      finish: "tool_calls",
      model: "gpt-test",
      usage: { inputTokens: 120, outputTokens: 9 },
    });
    expect(sent[0]!.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(sent[0]!.headers.Authorization).toBe("Bearer sk-test");
    expect(sent[0]!.body).toMatchObject({
      model: "gpt-test",
      stream: true,
      max_completion_tokens: 500,
      reasoning_effort: "low",
      tools: [{ type: "function", function: { name: "get_state", description: "d", parameters: { type: "object" } } }],
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
        { role: "assistant", content: null, tool_calls: [{ id: "c0", type: "function", function: { name: "get_state", arguments: "{}" } }] },
        { role: "tool", tool_call_id: "c0", content: "state" },
      ],
    });
  });

  it("works against OpenAI-compatible servers without streaming, and surfaces vendor errors", async () => {
    const ok: FetchLike = async () =>
      Response.json({ choices: [{ message: { content: null, tool_calls: [{ id: "a", function: { name: "x", arguments: "not json" } }] }, finish_reason: "tool_calls" }] });
    const local = openAIChatModel({ model: "llama3.1", baseUrl: "http://localhost:11434/v1/", stream: false, id: "ollama", label: "Ollama", fetch: ok });
    expect(local.id).toBe("ollama");
    const res = await local.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(res.toolCalls[0]!.arguments).toEqual({ __invalidArguments: "not json" });

    const bad: FetchLike = async () => Response.json({ error: { message: "Incorrect API key provided" } }, { status: 401 });
    await expect(openAIChatModel({ model: "m", fetch: bad }).complete({ messages: [] })).rejects.toMatchObject({ status: 401, message: expect.stringContaining("Incorrect API key") });
  });
});

describe("server handler + remote model", () => {
  it("streams through the backend; the browser never sees the key", async () => {
    let seenAuth = "";
    const upstream: FetchLike = async (_url, init) => {
      seenAuth = (init!.headers as Record<string, string>).Authorization!;
      return sse([{ choices: [{ delta: { content: "Hi " } }] }, { choices: [{ delta: { content: "there" }, finish_reason: "stop" }] }]);
    };
    const handle = createChatHandler(openAIChatModel({ apiKey: "server-key", model: "gpt-test", fetch: upstream }), {
      basePath: "/api/assistant",
      prepare: (r) => ({ ...r, maxOutputTokens: 100 }),
    });
    const browserFetch: FetchLike = async (url, init) => (await handle(new Request(new URL(url, "http://app.local"), init))) ?? new Response("nope", { status: 404 });

    const remote = await remoteChatModel("/api/assistant", { fetch: browserFetch });
    expect(remote).toMatchObject({ id: "openai", label: "OpenAI", models: [{ id: "gpt-test" }] });
    const deltas: string[] = [];
    const res = await remote.complete({ messages: [{ role: "user", content: "hello" }] }, { onText: (d) => deltas.push(d) });
    expect(res.content).toBe("Hi there");
    expect(deltas).toEqual(["Hi ", "there"]);
    expect(seenAuth).toBe("Bearer server-key");

    // The full loop works through the proxy.
    const turn = await createAssistant({ model: remote }).run(demo(), "hello");
    expect(turn).toMatchObject({ status: "no-changes", reply: "Hi there" });

    const failing = createChatHandler(openAIChatModel({ model: "m", fetch: async () => Response.json({ error: { message: "quota" } }, { status: 429 }) }));
    const failFetch: FetchLike = async (url, init) => (await failing(new Request(new URL(url, "http://app.local"), init)))!;
    const r2 = await remoteChatModel("", { fetch: failFetch, info: { id: "openai", label: "OpenAI" } });
    await expect(r2.complete({ messages: [] })).rejects.toMatchObject({ status: 429 });
    expect((await failFetch("/chat", { method: "POST", body: "{" })).status).toBe(400);
  });
});
