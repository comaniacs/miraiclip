/**
 * Plumbing the vendor adapters share: POST with retries on rate limits and
 * server errors, server-sent-event reading, and tool-argument parsing.
 */
import { ChatModelError, type FetchLike } from "./types.js";

/** Parse a tool call's JSON arguments; unparseable JSON is reported to the model as a tool error. */
export function parseToolArguments(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : { __invalidArguments: raw };
  } catch {
    return { __invalidArguments: raw };
  }
}

/** How long the server asked us to wait (Retry-After header, or "try again in 1.2s / 350ms"), else exponential backoff. */
export function retryDelayMs(res: Pick<Response, "headers">, message: string, attempt: number): number {
  const header = Number(res.headers.get("retry-after-ms") ?? NaN) || Number(res.headers.get("retry-after") ?? NaN) * 1000;
  const m = /try again in ([\d.]+)\s*(ms|s)/i.exec(message);
  const asked = header || (m ? Number(m[1]) * (m[2]!.toLowerCase() === "ms" ? 1 : 1000) : 0);
  const backoff = Math.min(30_000, 1000 * 2 ** attempt);
  // A little extra and some jitter, so parallel callers don't all retry at the same instant.
  return Math.round(Math.min(60_000, Math.max(asked + 250, asked ? 0 : backoff)) * (1 + Math.random() * 0.25));
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error("aborted"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => (clearTimeout(t), reject(signal.reason ?? new Error("aborted"))), { once: true });
  });
}

/** 529 is Anthropic's "overloaded". */
const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);

/** The message out of the error bodies vendors send ({ error: { message } }, { error: "…" }, { message }). */
export function errorMessage(body: unknown, status: number): string {
  const b = body as { error?: { message?: string } | string; message?: string } | null;
  const msg = typeof b?.error === "string" ? b.error : (b?.error?.message ?? b?.message);
  return msg || `HTTP ${status}`;
}

/**
 * Send a request, retrying 429s and 5xx (waiting as long as the server asks,
 * else 1 s, 2 s, 4 s… capped at 30 s). A 429 for an exhausted quota, missing
 * credits or billing won't clear by waiting, so it fails at once.
 */
export async function sendWithRetry(
  provider: string,
  doFetch: FetchLike,
  url: string,
  init: RequestInit,
  options: { maxRetries?: number; signal?: AbortSignal } = {},
): Promise<Response> {
  const maxRetries = options.maxRetries ?? 4;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await doFetch(url, { ...init, ...(options.signal ? { signal: options.signal } : {}) });
    } catch (err) {
      if ((err as Error)?.name === "AbortError" || options.signal?.aborted) throw err;
      throw new ChatModelError(provider, `request failed: ${(err as Error)?.message ?? err}`);
    }
    if (res.ok) return res;
    const message = errorMessage(await res.json().catch(() => null), res.status);
    const permanent = /quota|credit|billing/i.test(message);
    if (attempt >= maxRetries || !RETRYABLE.has(res.status) || permanent) throw new ChatModelError(provider, message, res.status);
    await sleep(retryDelayMs(res, message, attempt), options.signal);
  }
}

/** GET a JSON document, as a ChatModelError on failure. */
export async function getJson(provider: string, doFetch: FetchLike, url: string, headers: Record<string, string>, signal?: AbortSignal): Promise<unknown> {
  const res = await sendWithRetry(provider, doFetch, url, { method: "GET", headers }, { maxRetries: 1, ...(signal ? { signal } : {}) });
  return res.json();
}

/**
 * Server-sent events: calls `onData` with each `data:` line's payload. Every
 * vendor here sends one JSON object per data line, and handling lines one by
 * one also copes with servers that skip the blank line between events.
 */
export async function readSse(body: ReadableStream<Uint8Array>, onData: (data: string) => void): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const line = (raw: string) => {
    const l = raw.replace(/\r$/, "");
    if (l.startsWith("data:")) onData(l.slice(5).trim());
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      line(buffer.slice(0, nl));
      buffer = buffer.slice(nl + 1);
    }
    if (done) break;
  }
  if (buffer) line(buffer);
}

/** True when a response is an event stream we should read incrementally. */
export const isEventStream = (res: Response) => !!res.body && (res.headers.get("content-type") ?? "").includes("event-stream");

export const trimSlash = (url: string) => url.replace(/\/+$/, "");

/** The adapter's model list: the default first (keeping its label if `others` has one), then the rest. */
export function modelList(model: string, others: readonly { id: string; label?: string }[] = []): { id: string; label?: string }[] {
  return [others.find((m) => m.id === model) ?? { id: model }, ...others.filter((m) => m.id !== model)];
}
