/**
 * Rewrite a script into clean voiceover with any chat model (the assistant
 * package's `ChatModel` contract, or anything with the same `complete`).
 * Each line gets a word budget from its step's length, so the rewrite
 * mostly fits before alignment has to stretch anything.
 */
import { contentEndUs, segmentSlots, type Script } from "./script.js";
import type { ProjectDocument } from "@miraiclip/core";

/** The slice of a chat model this needs (`@miraiclip/assistant` models fit). */
export interface ScriptModel {
  complete(request: {
    messages: { role: "system" | "user"; content: string }[];
    model?: string;
    maxOutputTokens?: number;
  }, options?: { signal?: AbortSignal }): Promise<{ content: string }>;
}

export interface RewriteOptions {
  /** Voice and tone ("friendly, confident, second person"). */
  style?: string;
  /** Write in this language (default: the script's). */
  language?: string;
  /** Speaking rate for the word budget (default 2.6 words per second). */
  wordsPerSecond?: number;
  /** What the product is, so names come out right. */
  product?: string;
  /** Extra instructions. */
  instructions?: string;
  /** Model id, when the adapter serves several. */
  model?: string;
  signal?: AbortSignal;
}

export const REWRITE_INSTRUCTIONS = `You write voiceover for short product tutorial videos.
You get the steps of a screen recording: what the presenter said during each step (often rambling, with fillers), the step's name, and how many seconds the step lasts.
Rewrite each step as one clean, natural voiceover line:
- Keep the meaning and every concrete detail (names of buttons, menus, fields, values). Drop fillers, false starts and repetition.
- Speak to the viewer ("Click Save", "you'll see"), present tense, short sentences.
- Stay within each step's word budget (maxWords). Shorter is fine.
- If a step has nothing said, write a short line from the step name.
Reply with JSON only: {"segments":[{"id":"…","text":"…"}]} with every id exactly once.`;

/** Pull the first JSON object out of a reply (models sometimes wrap it in prose or fences). */
export function parseJsonReply(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1]! : content;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("the model's reply had no JSON object");
  return JSON.parse(text.slice(start, end + 1));
}

export async function rewriteScript(model: ScriptModel, doc: ProjectDocument, script: Script, options: RewriteOptions = {}): Promise<Script> {
  const wps = options.wordsPerSecond ?? 2.6;
  const slots = new Map(segmentSlots(script, contentEndUs(doc)).map((s) => [s.id, s]));
  const language = options.language ?? script.language;
  const steps = script.segments.map((s) => {
    const slot = slots.get(s.id)!;
    const seconds = Math.max(0.5, (slot.endUs - slot.startUs) / 1e6);
    return {
      id: s.id,
      ...(s.label ? { step: s.label } : {}),
      said: s.sourceText ?? s.text,
      seconds: Math.round(seconds * 10) / 10,
      maxWords: Math.max(3, Math.floor(seconds * wps)),
    };
  });
  const system = [
    REWRITE_INSTRUCTIONS,
    options.style ? `Tone: ${options.style}.` : "",
    language ? `Write in ${language}.` : "",
    options.product ? `The product: ${options.product}.` : "",
    options.instructions ?? "",
  ]
    .filter(Boolean)
    .join("\n");
  const reply = await model.complete(
    {
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify({ steps }) },
      ],
      ...(options.model ? { model: options.model } : {}),
      maxOutputTokens: 400 + steps.length * 120,
    },
    options.signal ? { signal: options.signal } : undefined,
  );
  const parsed = parseJsonReply(reply.content) as { segments?: { id?: unknown; text?: unknown }[] };
  const byId = new Map((parsed.segments ?? []).filter((s) => typeof s.id === "string" && typeof s.text === "string" && s.text.trim()).map((s) => [s.id as string, (s.text as string).trim()]));
  if (byId.size === 0) throw new Error("the model returned no script lines");
  return {
    ...script,
    ...(language ? { language } : {}),
    // Lines the model skipped keep their text.
    segments: script.segments.map((s) => ({ ...s, text: byId.get(s.id) ?? s.text })),
  };
}
