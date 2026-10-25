import { describe, expect, it } from "vitest";
import { toAnthropicMessages } from "../src/anthropic.js";
import { toGeminiContents } from "../src/gemini.js";
import { toOpenAIMessages } from "../src/openai.js";
import { recentImagesOnly } from "../src/run.js";
import type { ChatMessage } from "../src/types.js";

const img = { mimeType: "image/jpeg", data: "QUJD" };
const convo: ChatMessage[] = [
  { role: "user", content: "make a scene" },
  { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "design_scene", arguments: {} }, { id: "c2", name: "get_state", arguments: {} }] },
  { role: "tool", toolCallId: "c1", name: "design_scene", content: '{"ok":true}', images: [img] },
  { role: "tool", toolCallId: "c2", name: "get_state", content: '{"clips":0}' },
  { role: "assistant", content: "done" },
];

describe("tool result images", () => {
  it("Anthropic: images inside the tool_result", () => {
    const { messages } = toAnthropicMessages(convo);
    const results = messages[2]!.content as { type: string; content?: unknown }[];
    expect(results[0]).toMatchObject({ type: "tool_result", tool_use_id: "c1" });
    expect(results[0]!.content).toEqual([{ type: "text", text: '{"ok":true}' }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "QUJD" } }]);
    expect(results[1]).toMatchObject({ type: "tool_result", content: '{"clips":0}' });
  });

  it("OpenAI: tool messages stay together, then one user message with the images", () => {
    const out = toOpenAIMessages(convo);
    expect(out.map((m) => m.role)).toEqual(["user", "assistant", "tool", "tool", "user", "assistant"]);
    const parts = out[4]!.content as { type: string; image_url?: { url: string } }[];
    expect(parts.find((p) => p.type === "image_url")?.image_url?.url).toBe("data:image/jpeg;base64,QUJD");
  });

  it("Gemini: inline images after the function responses, in the same user turn", () => {
    const { contents } = toGeminiContents(convo);
    const turn = contents[2]!;
    expect(turn.role).toBe("user");
    expect(turn.parts.map((p) => (p.functionResponse ? "fr" : p.inlineData ? "img" : "text"))).toEqual(["fr", "fr", "text", "text", "img"]);
  });

  it("keeps images only on the latest results", () => {
    const many: ChatMessage[] = [1, 2, 3].map((n) => ({ role: "tool", toolCallId: `c${n}`, name: "design_scene", content: "{}", images: [img] }));
    const out = recentImagesOnly(many, 2);
    expect(out.map((m) => (m.role === "tool" && m.images ? 1 : 0))).toEqual([0, 1, 1]);
    expect((out[0] as { content: string }).content).toContain("shown earlier");
  });
});

import { createProject } from "@miraiclip/core";
import { ChatModelError, createAssistant, defineTool, scriptedChatModel } from "../src/index.js";

describe("tool images in a turn", () => {
  const look = defineTool({ name: "look", description: "returns a picture", inputSchema: { type: "object", properties: {} }, run: () => ({ ok: true, result: { seen: true }, images: [img] }) });

  it("sends a tool's images to the model with its result", async () => {
    const model = scriptedChatModel([{ toolCalls: [{ name: "look", arguments: {} }] }, "Done."]);
    await createAssistant({ model, tools: [look] }).run(createProject({ width: 640, height: 360, fps: 30 }), "look");
    const tool = model.requests[1]!.messages.find((m) => m.role === "tool")!;
    expect(tool.role === "tool" && tool.images).toEqual([img]);
  });

  it("hands the tool's images to the app in the tool-end event", async () => {
    const model = scriptedChatModel([{ toolCalls: [{ name: "look", arguments: {} }] }, "Done."]);
    const seen: unknown[] = [];
    await createAssistant({ model, tools: [look] }).run(createProject({ width: 640, height: 360, fps: 30 }), "look", {
      onEvent: (e) => {
        if (e.type === "tool-end") seen.push(e.images);
      },
    });
    expect(seen).toEqual([[img]]);
  });

  it("retries without images when the model refuses them", async () => {
    const inner = scriptedChatModel([{ toolCalls: [{ name: "look", arguments: {} }] }, "Done.", "Done again."]);
    let refused = 0;
    const model = {
      ...inner,
      async complete(request: Parameters<typeof inner.complete>[0], opts?: Parameters<typeof inner.complete>[1]) {
        if (request.messages.some((m) => m.role === "tool" && m.images?.length)) {
          refused++;
          throw new ChatModelError("test", "image input is not supported", 400);
        }
        return inner.complete(request, opts);
      },
    };
    const turn = await createAssistant({ model, tools: [look] }).run(createProject({ width: 640, height: 360, fps: 30 }), "look");
    expect(refused).toBe(1);
    expect(turn.reply).toBe("Done.");
  });
});
