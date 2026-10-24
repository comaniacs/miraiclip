import { describe, expect, it } from "vitest";
import { createProject } from "@miraiclip/core";
import {
  anthropicChatModel,
  chatModelsFromEnv,
  createAssistant,
  createChatHandler,
  createChatModel,
  editorTools,
  geminiChatModel,
  openAIChatModel,
  remoteChatModel,
  routedChatModel,
  scriptedChatModel,
  toAnthropicMessages,
  toGeminiContents,
  type ChatMessage,
  type FetchLike,
} from "../src/index.js";

function sse(events: unknown[], { eventNames = false } = {}): Response {
  const text = events
    .map((e) => `${eventNames ? `event: ${(e as { type: string }).type}\n` : ""}data: ${JSON.stringify(e)}\n\n`)
    .join("");
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      // Split mid-line to exercise buffering.
      c.enqueue(bytes.slice(0, 41));
      c.enqueue(bytes.slice(41));
      c.close();
    },
  });
  return new Response(body, { headers: { "content-type": "text/event-stream" } });
}

type Sent = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
function recorder(reply: (sent: Sent) => Response | Promise<Response>) {
  const sent: Sent[] = [];
  const fetch: FetchLike = async (url, init) => {
    const s = { url, headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body ? JSON.parse(String(init.body)) : {} };
    sent.push(s);
    return reply(s);
  };
  return { sent, fetch };
}

const conversation: ChatMessage[] = [
  { role: "system", content: "sys" },
  { role: "user", content: "fade it in" },
  {
    role: "assistant",
    content: "",
    toolCalls: [
      { id: "c1", name: "get_state", arguments: {} },
      { id: "c2", name: "animate_clip", arguments: { clipId: "t1" } },
    ],
  },
  { role: "tool", toolCallId: "c1", name: "get_state", content: '{"clips":1}' },
  { role: "tool", toolCallId: "c2", name: "animate_clip", content: "ok" },
];

describe("anthropicChatModel", () => {
  it("maps system, groups tool results into one user turn, replays tool_use", () => {
    const { system, messages } = toAnthropicMessages(conversation);
    expect(system).toBe("sys");
    expect(messages).toEqual([
      { role: "user", content: [{ type: "text", text: "fade it in" }] },
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "c1", name: "get_state", input: {} },
          { type: "tool_use", id: "c2", name: "animate_clip", input: { clipId: "t1" } },
        ],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "c1", content: '{"clips":1}' },
          { type: "tool_result", tool_use_id: "c2", content: "ok" },
        ],
      },
    ]);
  });

  it("streams text and tool input, keeps thinking for the next request", async () => {
    const { sent, fetch } = recorder(() =>
      sse(
        [
          { type: "message_start", message: { model: "claude-test", usage: { input_tokens: 100, cache_read_input_tokens: 20, output_tokens: 1 } } },
          { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Hmm" } },
          { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig" } },
          { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "On " } },
          { type: "content_block_delta", index: 1, delta: { type: "text_delta", text: "it" } },
          { type: "content_block_start", index: 2, content_block: { type: "tool_use", id: "toolu_1", name: "animate_clip", input: {} } },
          { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: '{"clipId"' } },
          { type: "content_block_delta", index: 2, delta: { type: "input_json_delta", partial_json: ':"t1"}' } },
          { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 42 } },
          { type: "message_stop" },
        ],
        { eventNames: true },
      ),
    );
    const model = anthropicChatModel({ apiKey: "sk-ant", model: "claude-test", fetch, params: { thinking: { type: "enabled", budget_tokens: 2000 } } });
    const deltas: string[] = [];
    const res = await model.complete(
      { messages: conversation.slice(0, 2), tools: [{ name: "animate_clip", description: "d", inputSchema: { type: "object" } }] },
      { onText: (d) => deltas.push(d) },
    );
    expect(deltas).toEqual(["On ", "it"]);
    expect(res).toEqual({
      content: "On it",
      toolCalls: [{ id: "toolu_1", name: "animate_clip", arguments: { clipId: "t1" }, meta: { anthropicThinking: [{ type: "thinking", thinking: "Hmm", signature: "sig" }] } }],
      finish: "tool_calls",
      model: "claude-test",
      usage: { inputTokens: 120, outputTokens: 42 },
    });
    expect(sent[0]!.url).toBe("https://api.anthropic.com/v1/messages");
    expect(sent[0]!.headers).toMatchObject({ "x-api-key": "sk-ant", "anthropic-version": "2023-06-01" });
    expect(sent[0]!.body).toMatchObject({
      model: "claude-test",
      max_tokens: 8192,
      system: "sys",
      stream: true,
      thinking: { type: "enabled", budget_tokens: 2000 },
      tools: [{ name: "animate_clip", description: "d", input_schema: { type: "object" } }],
    });

    // The thinking block goes back first in the assistant turn.
    const replay = toAnthropicMessages([...conversation.slice(0, 2), { role: "assistant", content: res.content, toolCalls: res.toolCalls }]);
    expect(replay.messages[1]!.content[0]).toEqual({ type: "thinking", thinking: "Hmm", signature: "sig" });
  });

  it("works without streaming, lists models, sends the browser header, and surfaces errors", async () => {
    const { sent, fetch } = recorder((s) =>
      s.url.endsWith("/v1/models?limit=1000")
        ? Response.json({ data: [{ id: "claude-a", display_name: "Claude A" }] })
        : Response.json({ content: [{ type: "text", text: "Hi" }], stop_reason: "end_turn", model: "m", usage: { input_tokens: 3, output_tokens: 1 } }),
    );
    const model = anthropicChatModel({ apiKey: "k", model: "m", stream: false, browser: true, fetch });
    expect(await model.complete({ messages: [{ role: "user", content: "hi" }] })).toMatchObject({ content: "Hi", finish: "stop", usage: { inputTokens: 3, outputTokens: 1 } });
    expect(sent[0]!.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(await model.listModels!()).toEqual([{ id: "claude-a", label: "Claude A" }]);

    const bad: FetchLike = async () => Response.json({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, { status: 401 });
    await expect(anthropicChatModel({ model: "m", fetch: bad }).complete({ messages: [] })).rejects.toMatchObject({ status: 401, message: expect.stringContaining("invalid x-api-key") });
  });
});

describe("geminiChatModel", () => {
  it("maps roles, function calls and responses, and keeps Gemini's call ids", () => {
    const { system, contents } = toGeminiContents([
      ...conversation.slice(0, 2),
      {
        role: "assistant",
        content: "",
        toolCalls: [
          { id: "g1", name: "get_state", arguments: {}, meta: { gemini: { id: "g1", signature: "SIG" } } },
          { id: "c2", name: "animate_clip", arguments: { clipId: "t1" } },
        ],
      },
      { role: "tool", toolCallId: "g1", name: "get_state", content: '{"clips":1}' },
      { role: "tool", toolCallId: "c2", name: "animate_clip", content: "ok" },
    ]);
    expect(system).toBe("sys");
    expect(contents).toEqual([
      { role: "user", parts: [{ text: "fade it in" }] },
      {
        role: "model",
        parts: [
          { functionCall: { id: "g1", name: "get_state", args: {} }, thoughtSignature: "SIG" },
          { functionCall: { name: "animate_clip", args: { clipId: "t1" } } },
        ],
      },
      {
        role: "user",
        parts: [
          { functionResponse: { id: "g1", name: "get_state", response: { clips: 1 } } },
          { functionResponse: { name: "animate_clip", response: { result: "ok" } } },
        ],
      },
    ]);
  });

  it("marks tool calls it didn't sign (another model's) so Gemini accepts the history", () => {
    const { contents } = toGeminiContents(conversation);
    expect(contents[1]!.parts[0]).toMatchObject({ thoughtSignature: "skip_thought_signature_validator" });
    expect(contents[1]!.parts[1]).not.toHaveProperty("thoughtSignature");
  });

  it("streams, keeps thought signatures on the calls, skips thought text", async () => {
    const { sent, fetch } = recorder(() =>
      sse([
        { candidates: [{ content: { role: "model", parts: [{ text: "planning", thought: true }] } }] },
        { candidates: [{ content: { role: "model", parts: [{ text: "Fading " }] } }] },
        { candidates: [{ content: { role: "model", parts: [{ text: "in." }, { functionCall: { name: "animate_clip", args: { clipId: "t1" } }, thoughtSignature: "S1" }] }, finishReason: "STOP" }] },
        { usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 7, thoughtsTokenCount: 3 }, modelVersion: "gemini-test-001" },
      ]),
    );
    const model = geminiChatModel({ apiKey: "g-key", model: "models/gemini-test", fetch, params: { generationConfig: { temperature: 0.2 } } });
    const deltas: string[] = [];
    const res = await model.complete(
      { messages: conversation.slice(0, 2), tools: [{ name: "animate_clip", description: "d", inputSchema: { type: "object", additionalProperties: false } }], maxOutputTokens: 300 },
      { onText: (d) => deltas.push(d) },
    );
    expect(deltas).toEqual(["Fading ", "in."]);
    expect(res).toMatchObject({
      content: "Fading in.",
      toolCalls: [{ name: "animate_clip", arguments: { clipId: "t1" }, meta: { gemini: { signature: "S1" } } }],
      finish: "tool_calls",
      model: "gemini-test-001",
      usage: { inputTokens: 50, outputTokens: 10 },
    });
    expect(sent[0]!.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-test:streamGenerateContent?alt=sse");
    expect(sent[0]!.headers["x-goog-api-key"]).toBe("g-key");
    expect(sent[0]!.body).toMatchObject({
      systemInstruction: { parts: [{ text: "sys" }] },
      tools: [{ functionDeclarations: [{ name: "animate_clip", description: "d", parametersJsonSchema: { type: "object", additionalProperties: false } }] }],
      generationConfig: { maxOutputTokens: 300, temperature: 0.2 },
    });

    // Two calls without ids from two responses still get distinct ids.
    const again = await model.complete({ messages: conversation.slice(0, 2) });
    expect(again.toolCalls[0]!.id).not.toBe(res.toolCalls[0]!.id);
  });

  it("reports blocked prompts and lists only generateContent models", async () => {
    const { fetch } = recorder((s) =>
      s.url.includes("/models?")
        ? Response.json({ models: [{ name: "models/gemini-x", displayName: "Gemini X", supportedGenerationMethods: ["generateContent"] }, { name: "models/embed", supportedGenerationMethods: ["embedContent"] }] })
        : Response.json({ promptFeedback: { blockReason: "SAFETY" } }),
    );
    const model = geminiChatModel({ apiKey: "k", model: "gemini-x", stream: false, fetch });
    expect(await model.complete({ messages: [{ role: "user", content: "x" }] })).toMatchObject({ content: "", finish: "content_filter" });
    expect(await model.listModels!()).toEqual([{ id: "gemini-x", label: "Gemini X" }]);
  });
});

describe("createChatModel and the provider catalog", () => {
  it("picks the wire format per provider", async () => {
    const { sent, fetch } = recorder(() => Response.json({ choices: [{ message: { content: "ok" }, finish_reason: "stop" }] }));
    const groq = createChatModel({ provider: "groq", apiKey: "gsk", model: "llama-x", stream: false, fetch });
    expect(groq).toMatchObject({ id: "groq", label: "Groq" });
    await groq.complete({ messages: [{ role: "user", content: "hi" }], maxOutputTokens: 50 });
    expect(sent[0]!.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(sent[0]!.body).toMatchObject({ model: "llama-x", max_tokens: 50 });
    expect(sent[0]!.body).not.toHaveProperty("max_completion_tokens");

    expect(createChatModel({ provider: "anthropic", apiKey: "k" }).models![0]).toEqual({ id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5" });
    expect(createChatModel({ provider: "gemini", apiKey: "k" }).id).toBe("gemini");
    expect(createChatModel({ provider: "ollama", model: "llama3" }).id).toBe("ollama");
  });

  it("explains what's missing", () => {
    expect(() => createChatModel({ provider: "nope" })).toThrow(/Unknown AI provider/);
    expect(() => createChatModel({ provider: "anthropic" })).toThrow(/needs an API key/);
    expect(() => createChatModel({ provider: "groq", apiKey: "k" })).toThrow(/pick a model/);
    expect(() => createChatModel({ provider: "openai-compatible", model: "m" })).toThrow(/base URL/);
  });

  it("builds every configured provider from env, in catalog order", () => {
    const skipped: string[] = [];
    const models = chatModelsFromEnv(
      {
        ANTHROPIC_API_KEY: "a",
        GOOGLE_API_KEY: "g",
        OPENAI_API_KEY: "o",
        OPENAI_MODELS: "gpt-x, gpt-y",
        GROQ_API_KEY: "no-model",
        OLLAMA_MODEL: "llama3",
      },
      { onSkip: (id) => skipped.push(id) },
    );
    expect(models.map((m) => m.id)).toEqual(["openai", "anthropic", "gemini", "ollama"]);
    expect(models[0]!.models!.map((m) => m.id)).toEqual(["gpt-5.4-mini", "gpt-x", "gpt-y"]);
    expect(skipped).toEqual(["groq"]);
  });

  it("keeps OPENAI_BASE_URL's old meaning: an OpenAI-compatible server", () => {
    const [m] = chatModelsFromEnv({ OPENAI_BASE_URL: "http://localhost:11434/v1", OPENAI_MODEL: "llama3", OPENAI_MODELS: "qwen3", OPENAI_LABEL: "My Ollama" });
    expect(m).toMatchObject({ id: "openai-compatible", label: "My Ollama", models: [{ id: "llama3" }, { id: "qwen3" }] });
  });
});

describe("routedChatModel", () => {
  it("routes provider/model references and bare ids", async () => {
    const a = scriptedChatModel(["from a"], { id: "openai" });
    const b = scriptedChatModel(["from b"], { id: "anthropic" });
    Object.assign(b, { models: [{ id: "claude-x" }] });
    const router = routedChatModel([a, b]);
    expect(router.providers).toEqual([{ id: "openai", label: "Scripted model" }, { id: "anthropic", label: "Scripted model" }]);
    expect(router.models).toEqual([{ id: "anthropic/claude-x", label: "Scripted model · claude-x" }]);

    expect((await router.complete({ messages: [], model: "anthropic/claude-x" })).content).toBe("from b");
    expect(b.requests[0]!.model).toBe("claude-x");
    expect((await router.complete({ messages: [], model: "claude-x" })).content).toBe("from b");
    expect((await router.complete({ messages: [] })).content).toBe("from a");
    expect(a.requests[0]).not.toHaveProperty("model");
    expect((await router.complete({ messages: [], model: "openai/gpt-z" })).content).toBe("from a");
    expect(a.requests[1]!.model).toBe("gpt-z");
  });
});

describe("bring your own key", () => {
  const upstream = recorder((s) =>
    s.url.endsWith("/v1/models?limit=1000")
      ? Response.json({ data: [{ id: "claude-user" }] })
      : sse(
          [
            { type: "message_start", message: { model: "claude-user", usage: { input_tokens: 1 } } },
            { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
            { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "user key works" } },
            { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 3 } },
          ],
          { eventNames: true },
        ),
  );

  function browser(handle: (r: Request) => Promise<Response | null>): FetchLike {
    return async (url, init) => (await handle(new Request(new URL(url, "http://app.local"), init))) ?? new Response("nope", { status: 404 });
  }

  it("uses the user's key for that request only, with the server model as fallback", async () => {
    const serverModel = scriptedChatModel(["server model"], { id: "openai" });
    const handle = createChatHandler(serverModel, { basePath: "/api/ai", userKeys: { fetch: upstream.fetch } });
    let creds: { provider: string; apiKey: string } | null = null;
    const remote = await remoteChatModel("/api/ai", { fetch: browser(handle), credentials: () => creds });
    expect(remote.info.userKeys!.providers.map((p) => p.id)).toEqual(["openai", "anthropic", "gemini", "openrouter", "groq", "mistral", "deepseek", "xai", "together"]);
    expect(remote.info.userKeys!.allowBaseUrl).toBe(false);

    expect((await remote.complete({ messages: [{ role: "user", content: "hi" }] })).content).toBe("server model");

    creds = { provider: "anthropic", apiKey: "sk-user" };
    const res = await remote.complete({ messages: [{ role: "user", content: "hi" }], model: "anthropic/claude-user" });
    expect(res.content).toBe("user key works");
    const call = upstream.sent.find((s) => s.url.endsWith("/v1/messages"))!;
    expect(call.headers["x-api-key"]).toBe("sk-user");
    expect(call.body.model).toBe("claude-user");
    expect(await remote.listModels!()).toEqual([{ id: "claude-user" }]);

    // The whole agent loop runs on the user's key.
    const project = createProject({ width: 640, height: 360, fps: 30 });
    const turn = await createAssistant({ model: remote, tools: editorTools() }).run(project, "hello");
    expect(turn).toMatchObject({ status: "no-changes", reply: "user key works" });
  });

  it("refuses providers and addresses the server didn't allow", async () => {
    const handle = createChatHandler(null, { userKeys: { providers: ["gemini"] } });
    const send = (headers: Record<string, string>) =>
      handle(new Request("http://app.local/chat", { method: "POST", headers, body: JSON.stringify({ request: { messages: [] } }) }));
    expect((await send({}))!.status).toBe(401);
    expect(await (await send({}))!.json()).toMatchObject({ needsKey: true });
    expect((await send({ "x-ai-provider": "anthropic", "x-ai-key": "k" }))!.status).toBe(403);
    expect((await send({ "x-ai-provider": "gemini", "x-ai-key": "k", "x-ai-base-url": "http://169.254.169.254" }))!.status).toBe(403);
    expect((await send({ "x-ai-provider": "gemini" }))!.status).toBe(401); // no key
    const info = await (await handle(new Request("http://app.local/")))!.json();
    expect(info).toMatchObject({ id: "byok", needsKey: true, userKeys: { providers: [{ id: "gemini", keyUrl: "https://aistudio.google.com/apikey" }] } });
  });

  it("required: the server's own model is never used", async () => {
    const handle = createChatHandler(scriptedChatModel(["server"]), { userKeys: { required: true } });
    const res = await handle(new Request("http://app.local/chat", { method: "POST", body: JSON.stringify({ request: { messages: [] } }) }));
    expect(res!.status).toBe(401);
  });

  it("needs a model or user keys", () => {
    expect(() => createChatHandler(null)).toThrow(/needs a model/);
  });
});

describe("OpenAI adapter extras", () => {
  it("lists models and can drop stream_options", async () => {
    const { sent, fetch } = recorder((s) => (s.url.endsWith("/models") ? Response.json({ data: [{ id: "b" }, { id: "a" }] }) : sse([{ choices: [{ delta: { content: "x" }, finish_reason: "stop" }] }])));
    const model = openAIChatModel({ model: "m", fetch, streamUsage: false, maxTokensField: "max_tokens" });
    expect(await model.listModels!()).toEqual([{ id: "a" }, { id: "b" }]);
    await model.complete({ messages: [], maxOutputTokens: 10 });
    expect(sent[1]!.body).toMatchObject({ stream: true, max_tokens: 10 });
    expect(sent[1]!.body).not.toHaveProperty("stream_options");
  });
});
