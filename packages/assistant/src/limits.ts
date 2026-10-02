import type { ChatModel, ChatRequest } from "./types.js";

export interface RateLimitOptions {
  /** Tokens per rolling minute across every caller of this model (input + output). */
  tokensPerMinute?: number;
  /** Requests per rolling minute. */
  requestsPerMinute?: number;
  /** Token estimate for a request before it's sent (default: JSON length ÷ 4, plus room for the reply). */
  estimate?: (request: ChatRequest) => number;
}

/**
 * Wrap a model so calls wait for room under your provider's per-minute
 * limits instead of failing with 429s — for batch jobs (evals, bulk edits)
 * and for a server sharing one key. Each call reserves an estimate, which is
 * replaced by the real usage when the response reports it.
 */
export function rateLimitedChatModel(model: ChatModel, options: RateLimitOptions): ChatModel {
  const tpm = options.tokensPerMinute ?? Infinity;
  const rpm = options.requestsPerMinute ?? Infinity;
  const estimate = options.estimate ?? ((r: ChatRequest) => Math.ceil(JSON.stringify(r).length / 4) + (r.maxOutputTokens ?? 1000));
  const window: { at: number; tokens: number }[] = [];
  let gate: Promise<void> = Promise.resolve();

  const prune = (now: number) => {
    while (window.length && now - window[0]!.at >= 60_000) window.shift();
  };
  const used = () => window.reduce((n, e) => n + e.tokens, 0);

  /** Wait (in arrival order) until this request fits, then reserve it. */
  const reserve = (tokens: number, signal?: AbortSignal) => {
    const want = Math.min(tokens, tpm); // a single request bigger than the limit still goes, alone
    const turn = gate.then(async () => {
      for (;;) {
        if (signal?.aborted) throw signal.reason ?? new Error("aborted");
        const now = Date.now();
        prune(now);
        if (window.length < rpm && used() + want <= tpm) break;
        const oldest = window[0];
        await new Promise((r) => setTimeout(r, oldest ? Math.max(50, 60_000 - (now - oldest.at)) : 50));
      }
      const entry = { at: Date.now(), tokens: want };
      window.push(entry);
      return entry;
    });
    gate = turn.then(
      () => undefined,
      () => undefined,
    );
    return turn;
  };

  return {
    ...model,
    async complete(request, opts = {}) {
      const entry = await reserve(estimate(request), opts.signal);
      const response = await model.complete(request, opts);
      const real = (response.usage?.inputTokens ?? 0) + (response.usage?.outputTokens ?? 0);
      if (real > 0) entry.tokens = real;
      return response;
    },
  };
}
