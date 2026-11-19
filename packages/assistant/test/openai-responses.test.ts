import { describe, expect, it } from "vitest";
import { createChatModel, openAIResponsesModel, toResponsesInput, type ChatMessage, type FetchLike } from "../src/index.js";

// OpenAI's Responses API: reasoning models take function tools only here.

function sse(events: unknown[]): Response {
  const text = events.map((e) => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
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

const reasoningItem = { type: "reasoning", id: "rs_1", encrypted_content: "ENC", summary: [] };
const callItem = { type: "function_call", id: "fc_1", call_id: "call_1", name: "look", arguments: '{"page":1}' };
const messageItem = { type: "message", role: "assistant", content: [{ type: "output_text", text: "Hello" }] };

function capture(response: () => Response) {
  const sent: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
  const fetch: FetchLike = async (url, init) => {
    sent.push({ url, body: JSON.parse(String(init!.body)), headers: init!.headers as Record<string, string> });
    return response();
  };
  return { sent, fetch };
}

describe("openAIResponsesModel", () => {
  it("sends tools with reasoning to /v1/responses, statelessly, and reads the stream", async () => {
    const { sent, fetch } = capture(() =>
      sse([
        { type: "response.created", response: { status: "in_progress" } },
        { type: "response.output_item.done", item: reasoningItem },
        { type: "response.output_text.delta", delta: "Hel" },
        { type: "response.output_text.delta", delta: "lo" },
        { type: "response.output_item.done", item: messageItem },
        { type: "response.output_item.done", item: callItem },
        {
          type: "response.completed",
          response: { model: "gpt-6.2-astra", status: "completed", output: [reasoningItem, messageItem, callItem], usage: { input_tokens: 120, output_tokens: 30 } },
        },
      ]),
    );
    const model = openAIResponsesModel({ apiKey: "sk-test", model: "gpt-6.2-astra", reasoningEffort: "medium", fetch });
    const deltas: string[] = [];
    const res = await model.complete(
      {
        messages: [
          { role: "system", content: "sys" },
          { role: "user", content: "hi" },
        ],
        tools: [{ name: "look", description: "Look at a page", inputSchema: { type: "object", properties: { page: { type: "number" } } } }],
        maxOutputTokens: 8192,
      },
      { onText: (d) => deltas.push(d) },
    );
    expect(sent[0]!.url).toBe("https://api.openai.com/v1/responses");
    expect(sent[0]!.headers.Authorization).toBe("Bearer sk-test");
    expect(sent[0]!.body).toMatchObject({
      model: "gpt-6.2-astra",
      instructions: "sys",
      input: [{ role: "user", content: "hi" }],
      tools: [{ type: "function", name: "look", description: "Look at a page", parameters: { type: "object" }, strict: false }],
      max_output_tokens: 8192,
      reasoning: { effort: "medium" },
      store: false,
      include: ["reasoning.encrypted_content"],
      stream: true,
    });
    expect(deltas.join("")).toBe("Hello");
    expect(res).toMatchObject({
      content: "Hello",
      finish: "tool_calls",
      model: "gpt-6.2-astra",
      usage: { inputTokens: 120, outputTokens: 30 },
      toolCalls: [{ id: "call_1", name: "look", arguments: { page: 1 } }],
    });
    // The reasoning rides on the first call, to be handed back next time.
    expect(res.toolCalls[0]!.meta).toEqual({ openaiItemId: "fc_1", openaiReasoning: [reasoningItem] });
  });

  it("hands the reasoning back before the calls it led to, then the outputs and their pictures", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "make a poster" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          { id: "call_1", name: "look", arguments: { page: 1 }, meta: { openaiItemId: "fc_1", openaiReasoning: [reasoningItem] } },
          { id: "call_2", name: "place", arguments: {}, meta: { openaiItemId: "fc_2" } },
        ],
      },
      { role: "tool", toolCallId: "call_1", name: "look", content: "a page", images: [{ mimeType: "image/png", data: "AAAA" }] },
      { role: "tool", toolCallId: "call_2", name: "place", content: "placed" },
      { role: "assistant", content: "Done." },
    ];
    expect(toResponsesInput(messages).input).toEqual([
      { role: "user", content: "make a poster" },
      reasoningItem,
      { type: "function_call", call_id: "call_1", name: "look", arguments: '{"page":1}', id: "fc_1" },
      { type: "function_call", call_id: "call_2", name: "place", arguments: "{}", id: "fc_2" },
      { type: "function_call_output", call_id: "call_1", output: "a page" },
      { type: "function_call_output", call_id: "call_2", output: "placed" },
      {
        role: "user",
        content: [
          { type: "input_text", text: "Images returned by the tool calls above:" },
          { type: "input_text", text: "From look (call_1):" },
          { type: "input_image", image_url: "data:image/png;base64,AAAA" },
        ],
      },
      { role: "assistant", content: "Done." },
    ]);
    // Models without reasoning get neither the reasoning nor the item ids that point at it.
    const plain = toResponsesInput(messages, { reasoning: false }).input;
    expect(plain.some((i) => (i as { type?: string }).type === "reasoning")).toBe(false);
    expect(plain[1]).toEqual({ type: "function_call", call_id: "call_1", name: "look", arguments: '{"page":1}' });
  });

  it("asks nothing about reasoning when no effort is set (models without it refuse those fields)", async () => {
    const { sent, fetch } = capture(() => Response.json({ status: "completed", output: [messageItem] }));
    const res = await openAIResponsesModel({ model: "gpt-4.1", fetch, stream: false }).complete({ messages: [{ role: "user", content: "hi" }] });
    expect(sent[0]!.body.reasoning).toBeUndefined();
    expect(sent[0]!.body.include).toBeUndefined();
    expect(res).toMatchObject({ content: "Hello", finish: "stop", toolCalls: [] });
  });

  it("a reply cut off by the output cap is finish 'length'", async () => {
    const { fetch } = capture(() =>
      sse([{ type: "response.incomplete", response: { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [reasoningItem] } }]),
    );
    const res = await openAIResponsesModel({ model: "m", reasoningEffort: "high", fetch }).complete({ messages: [{ role: "user", content: "hi" }] });
    expect(res.finish).toBe("length");
  });

  it("a failed response or a stream error throws with the vendor's message", async () => {
    const failed = capture(() => sse([{ type: "response.failed", response: { status: "failed", error: { message: "server_error: try again" } } }]));
    await expect(openAIResponsesModel({ model: "m", fetch: failed.fetch }).complete({ messages: [] })).rejects.toThrow("openai: server_error: try again");
    const broken = capture(() => sse([{ type: "error", message: "boom" }]));
    await expect(openAIResponsesModel({ model: "m", fetch: broken.fetch }).complete({ messages: [] })).rejects.toThrow("openai: boom");
  });

  it("an HTTP error carries its status (a 400 is not retried)", async () => {
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls++;
      return Response.json({ error: { message: "bad tool schema" } }, { status: 400 });
    };
    await expect(openAIResponsesModel({ model: "m", fetch }).complete({ messages: [] })).rejects.toMatchObject({ status: 400 });
    expect(calls).toBe(1);
  });

  it("is what the built-in OpenAI provider uses", async () => {
    const { sent, fetch } = capture(() => Response.json({ status: "completed", output: [messageItem] }));
    await createChatModel({ provider: "openai", apiKey: "k", model: "gpt-6.2-luna", fetch, stream: false }).complete({ messages: [{ role: "user", content: "hi" }] });
    expect(sent[0]!.url).toBe("https://api.openai.com/v1/responses");
  });
});
