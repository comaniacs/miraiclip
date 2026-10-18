/**
 * The vendor-neutral translation contract and two adapters: any chat model
 * (good with context and tone) and DeepL (fast, cheap, glossary-safe).
 */

export interface TranslateOptions {
  /** Target language (BCP-47 / ISO 639-1, e.g. "fr", "pt-BR", "hi"). */
  to: string;
  /** Source language (default: detect). */
  from?: string;
  /** What the texts are for ("UI labels in a product tutorial"), to steer word choice. */
  context?: string;
  /** Terms to keep exactly as written (product names, button labels in an untranslated UI). */
  keep?: string[];
  signal?: AbortSignal;
}

export interface Translator {
  id: string;
  label: string;
  /** Translate a batch, same order and length out as in. */
  translate(texts: string[], options: TranslateOptions): Promise<string[]>;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const defaultFetch = (): FetchLike => {
  if (typeof fetch !== "function") throw new Error("No global fetch: pass `fetch` to the translator.");
  return (input, init) => fetch(input, init);
};

// --------------------------------------------------------------------------- chat model

/** The slice of a chat model this needs (`@miraiclip/assistant` models fit). */
export interface TranslationModel {
  complete(request: { messages: { role: "system" | "user"; content: string }[]; model?: string; maxOutputTokens?: number }, options?: { signal?: AbortSignal }): Promise<{ content: string }>;
}

export function chatTranslator(model: TranslationModel, options: { model?: string; id?: string; label?: string; batchSize?: number } = {}): Translator {
  const batch = options.batchSize ?? 60;
  return {
    id: options.id ?? "chat",
    label: options.label ?? "Chat model",
    async translate(texts, opts) {
      const out: string[] = [];
      for (let i = 0; i < texts.length; i += batch) {
        const chunk = texts.slice(i, i + batch);
        const system = [
          `Translate each string into ${opts.to}${opts.from ? ` from ${opts.from}` : ""}.`,
          "Keep meaning, tone and length close to the original; these are short texts in a video (titles, captions, voiceover lines).",
          "Keep placeholders like {{name}}, numbers, URLs and emoji unchanged.",
          opts.keep?.length ? `Never translate these terms: ${opts.keep.map((k) => JSON.stringify(k)).join(", ")}.` : "",
          opts.context ? `Context: ${opts.context}` : "",
          'Reply with JSON only: {"translations":["…", …]} with exactly as many items as the input, in order.',
        ]
          .filter(Boolean)
          .join("\n");
        const reply = await model.complete(
          { messages: [{ role: "system", content: system }, { role: "user", content: JSON.stringify({ strings: chunk }) }], ...(options.model ? { model: options.model } : {}), maxOutputTokens: 200 + chunk.join(" ").length * 3 },
          opts.signal ? { signal: opts.signal } : undefined,
        );
        const json = reply.content.slice(reply.content.indexOf("{"), reply.content.lastIndexOf("}") + 1);
        let parsed: { translations?: unknown };
        try {
          parsed = JSON.parse(json);
        } catch {
          throw new Error("the model's translation reply wasn't JSON");
        }
        const list = parsed.translations;
        if (!Array.isArray(list) || list.length !== chunk.length || list.some((t) => typeof t !== "string")) {
          throw new Error(`the model returned ${Array.isArray(list) ? list.length : "no"} translations for ${chunk.length} strings`);
        }
        out.push(...(list as string[]));
      }
      return out;
    },
  };
}

// --------------------------------------------------------------------------- DeepL

export interface DeepLTranslatorOptions {
  /** Omit when `baseUrl` is a proxy that authenticates for you. Free keys end in ":fx". */
  apiKey?: string;
  /** Default: api-free.deepl.com for ":fx" keys, else api.deepl.com. */
  baseUrl?: string;
  formality?: "default" | "more" | "less" | "prefer_more" | "prefer_less";
  fetch?: FetchLike;
  id?: string;
  label?: string;
}

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unescapeXml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** DeepL (`POST /v2/translate`). Kept terms are wrapped in an ignored XML tag, so DeepL leaves them alone. */
export function deeplTranslator(options: DeepLTranslatorOptions = {}): Translator {
  const doFetch = options.fetch ?? defaultFetch();
  const base = (options.baseUrl ?? (options.apiKey?.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com")).replace(/\/+$/, "");
  return {
    id: options.id ?? "deepl",
    label: options.label ?? "DeepL",
    async translate(texts, opts) {
      if (!texts.length) return [];
      const keep = [...(opts.keep ?? [])].sort((a, b) => b.length - a.length);
      const protect = (s: string) => {
        let x = escapeXml(s);
        for (const term of keep) x = x.split(escapeXml(term)).join(`<x>${escapeXml(term)}</x>`);
        // Template placeholders stay too.
        return x.replace(/\{\{[^}]+\}\}/g, (m) => `<x>${m}</x>`);
      };
      const out: string[] = [];
      for (let i = 0; i < texts.length; i += 50) {
        const chunk = texts.slice(i, i + 50);
        const res = await doFetch(`${base}/v2/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(options.apiKey ? { Authorization: `DeepL-Auth-Key ${options.apiKey}` } : {}) },
          body: JSON.stringify({
            text: chunk.map(protect),
            target_lang: opts.to.toUpperCase(),
            ...(opts.from ? { source_lang: opts.from.split("-")[0]!.toUpperCase() } : {}),
            ...(opts.context ? { context: opts.context } : {}),
            ...(options.formality ? { formality: options.formality } : {}),
            tag_handling: "xml",
            ignore_tags: ["x"],
          }),
          ...(opts.signal ? { signal: opts.signal } : {}),
        });
        if (!res.ok) throw new Error(`[deepl] HTTP ${res.status}${res.status === 456 ? " (quota exceeded)" : ""}`);
        const body = (await res.json()) as { translations?: { text: string }[] };
        if (!body.translations || body.translations.length !== chunk.length) throw new Error("[deepl] unexpected response");
        out.push(...body.translations.map((t) => unescapeXml(t.text.replace(/<\/?x>/g, ""))));
      }
      return out;
    },
  };
}
