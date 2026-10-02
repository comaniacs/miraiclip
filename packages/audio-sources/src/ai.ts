/**
 * The AI surface: audio search and import as LLM tools, the same shape as
 * core's `toToolDefinitions`. `runAudioTool` executes a tool call against a
 * library and a project; results are small JSON objects meant to go straight
 * back to the model. Adding audio still lands as ordinary core commands
 * (one transaction), so undo, history and collaboration behave as usual.
 */
import type { Project } from "@miraiclip/core";
import { importAudio } from "./import.js";
import type { AudioLibrary } from "./library.js";
import type { AudioKind, ResolvedAudio } from "./types.js";

export interface AudioToolDefinitionsOptions {
  /** "anthropic" (default) → `{ name, description, input_schema }`; "openai" → function tools. */
  style?: "anthropic" | "openai";
}

export const AUDIO_TOOL_NAMES = ["search_audio", "add_audio"] as const;
export type AudioToolName = (typeof AUDIO_TOOL_NAMES)[number];

export function audioToolDefinitions(library: AudioLibrary, options: AudioToolDefinitionsOptions = {}): unknown[] {
  const providers = library.searchable();
  const providerIds = providers.map((p) => p.id);
  const kinds = [...new Set(providers.flatMap((p) => p.capabilities.search ?? []))] as AudioKind[];
  const providerList = providers.map((p) => `${p.id} (${p.label}: ${(p.capabilities.search ?? []).join(", ")})`).join("; ");

  const tools: { name: AudioToolName; description: string; schema: Record<string, unknown> }[] = [
    {
      name: "search_audio",
      description:
        `Search stock music and sound effects. Providers: ${providerList || "none"}. ` +
        "Returns items with provider, id, title, kind, durationS and license; pass provider + id to add_audio. " +
        "Set commercialOnly when the video may be used commercially.",
      schema: {
        type: "object",
        properties: {
          query: { type: "string", minLength: 1, description: "Keywords, e.g. \"upbeat acoustic\" or \"whoosh\"." },
          kind: { type: "string", enum: kinds },
          provider: { type: "string", enum: providerIds, description: "Search one provider (default: all)." },
          commercialOnly: { type: "boolean" },
          minDurationS: { type: "number", minimum: 0 },
          maxDurationS: { type: "number", minimum: 0 },
          limit: { type: "integer", minimum: 1, maximum: 20, default: 8 },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "add_audio",
      description:
        "Add a search result to the project as an audio clip (one undoable step). Records source, license and the credit line.",
      schema: {
        type: "object",
        properties: {
          provider: { type: "string", enum: providerIds },
          id: { type: "string", minLength: 1 },
          atSeconds: { type: "number", minimum: 0, description: "Timeline position (default: the playhead)." },
          durationSeconds: { type: "number", exclusiveMinimum: 0, description: "Clip length (default: the whole file)." },
          trackId: { type: "string", description: "Audio track (default: a free one, created if needed)." },
          volume: { type: "number", minimum: 0, maximum: 4, description: "1 = original level; music under speech ≈ 0.25–0.4." },
          fadeInSeconds: { type: "number", minimum: 0 },
          fadeOutSeconds: { type: "number", minimum: 0 },
        },
        required: ["provider", "id"],
        additionalProperties: false,
      },
    },
  ];

  return tools.map((t) =>
    options.style === "openai"
      ? { type: "function", function: { name: t.name, description: t.description, parameters: t.schema } }
      : { name: t.name, description: t.description, input_schema: t.schema },
  );
}

export interface RunAudioToolContext {
  library: AudioLibrary;
  project: Project;
  /**
   * Prepare a resolved file before it's added — typically copy it into your
   * own storage and return `{ ...resolved, src: storedUrl }`.
   */
  store?: (resolved: ResolvedAudio) => Promise<ResolvedAudio>;
  signal?: AbortSignal;
}

export type AudioToolResult = { ok: true; result: unknown } | { ok: false; error: string };

const us = (s: unknown) => (typeof s === "number" && Number.isFinite(s) ? Math.round(s * 1_000_000) : undefined);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);

export async function runAudioTool(name: string, input: unknown, ctx: RunAudioToolContext): Promise<AudioToolResult> {
  const args = (input ?? {}) as Record<string, unknown>;
  try {
    if (name === "search_audio") {
      const query = str(args.query);
      if (!query) return { ok: false, error: "query is required" };
      const limit = Math.min(20, Math.max(1, Number(args.limit ?? 8) || 8));
      const q = {
        query,
        pageSize: limit,
        ...(str(args.kind) ? { kind: args.kind as AudioKind } : {}),
        ...(args.commercialOnly === true ? { commercialOnly: true } : {}),
        ...(typeof args.minDurationS === "number" ? { minDurationS: args.minDurationS } : {}),
        ...(typeof args.maxDurationS === "number" ? { maxDurationS: args.maxDurationS } : {}),
        ...(ctx.signal ? { signal: ctx.signal } : {}),
      };
      const runs = await ctx.library.searchAll(q, str(args.provider) ? [args.provider as string] : undefined);
      const items = runs
        .flatMap((r) => r.result?.items ?? [])
        .slice(0, limit * Math.max(1, runs.length))
        .map((i) => ({
          provider: i.provider,
          id: i.id,
          title: i.title,
          ...(i.kind ? { kind: i.kind } : {}),
          ...(i.durationUs ? { durationS: Math.round(i.durationUs / 100_000) / 10 } : {}),
          license: i.license?.id ?? "unknown",
          commercial: i.license?.commercial ?? false,
          ...(i.creator ? { creator: i.creator } : {}),
        }));
      const errors = runs.filter((r) => r.error).map((r) => `${r.provider}: ${r.error}`);
      return { ok: true, result: { items, ...(errors.length ? { errors } : {}) } };
    }

    if (name === "add_audio") {
      const provider = str(args.provider);
      const id = str(args.id);
      if (!provider || !id) return { ok: false, error: "provider and id are required" };
      const item = await ctx.library.item(provider, id);
      if (!item) return { ok: false, error: `no item ${provider}/${id}; search first` };
      let resolved = await ctx.library.resolve(item, ctx.signal ? { signal: ctx.signal } : undefined);
      if (ctx.store) resolved = await ctx.store(resolved);
      const added = importAudio(ctx.project, resolved, {
        ...(us(args.atSeconds) !== undefined ? { atUs: us(args.atSeconds)! } : {}),
        ...(us(args.durationSeconds) ? { durationUs: us(args.durationSeconds)! } : {}),
        ...(str(args.trackId) ? { trackId: args.trackId as string } : {}),
        ...(typeof args.volume === "number" ? { volume: args.volume } : {}),
        ...(us(args.fadeInSeconds) ? { fadeInUs: us(args.fadeInSeconds)! } : {}),
        ...(us(args.fadeOutSeconds) ? { fadeOutUs: us(args.fadeOutSeconds)! } : {}),
      });
      return {
        ok: true,
        result: {
          ...added,
          title: resolved.name,
          license: resolved.license?.id ?? "unknown",
          ...(resolved.attribution ? { credit: resolved.attribution } : {}),
        },
      };
    }

    return { ok: false, error: `unknown audio tool "${name}"` };
  } catch (err) {
    return { ok: false, error: (err as Error)?.message ?? String(err) };
  }
}
