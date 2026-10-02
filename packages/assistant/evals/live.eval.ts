/**
 * Live evals: every case's prompt goes to a real model; the same checks as
 * the scripted suite judge the resulting project.
 *
 *   OPENAI_API_KEY=sk-… pnpm --filter @miraiclip/assistant eval
 *   (or put OPENAI_API_KEY in .env.local at the repo root or in this package)
 *
 * Env:
 *   OPENAI_MODEL       model id (default gpt-5.4-mini)
 *   OPENAI_BASE_URL    any OpenAI-compatible server (no key needed for local ones)
 *   EVAL_FILTER        only cases whose id or category contains this (comma-separated)
 *   EVAL_CONCURRENCY   cases in flight (default 2)
 *   EVAL_TPM           stay under this many tokens per minute (default 150000;
 *                      set ~75% of your account's limit; 0 = no limit)
 *   EVAL_RPM           stay under this many requests per minute (default: none)
 *   EVAL_RERUN         "failed" | "errored": only the cases that failed / errored
 *                      in the last run (evals/results/last.json); the report
 *                      merges them with that run's other results
 *   EVAL_MIN_PASS      fail the run below this pass rate (default 0.85)
 *
 * Rate limits: model calls wait for room under EVAL_TPM / EVAL_RPM, and the
 * OpenAI adapter retries 429s as the server asks. A case that still can't
 * reach the model counts as ERRORED, not failed, and is left out of the pass
 * rate — rerun them with EVAL_RERUN=errored.
 *
 * Writes evals/results/latest.md (summary, failures with the model's trace),
 * last.json (for reruns) and a timestamped JSON.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { ChatModelError, openAIChatModel, rateLimitedChatModel } from "../src/index.js";
import { LIVE_CASES, type EvalCase } from "./cases.js";
import { runCase } from "./harness.js";

const key = process.env.OPENAI_API_KEY;
const baseUrl = process.env.OPENAI_BASE_URL;
const modelId = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const minPass = Number(process.env.EVAL_MIN_PASS ?? 0.85);
const filters = (process.env.EVAL_FILTER ?? "").split(",").map((f) => f.trim()).filter(Boolean);
const resultsDir = join(dirname(fileURLToPath(import.meta.url)), "results");
const lastPath = join(resultsDir, "last.json");
const rerun = process.env.EVAL_RERUN as "failed" | "errored" | undefined;
const previous: Result[] = rerun && existsSync(lastPath) ? (JSON.parse(readFileSync(lastPath, "utf8")) as { results: Result[] }).results : [];
const rerunIds = new Set(previous.filter((r) => (rerun === "errored" ? r.errored : !r.pass)).map((r) => r.id));
let cases = filters.length ? LIVE_CASES.filter((c) => filters.some((f) => c.id.includes(f) || c.category === f)) : LIVE_CASES;
if (rerun) cases = cases.filter((c) => rerunIds.has(c.id));
const enabled = !!(key || baseUrl);
const tpm = Number(process.env.EVAL_TPM ?? 150_000);
const rpm = Number(process.env.EVAL_RPM ?? 0);

interface Result {
  id: string;
  category: string;
  prompt: string;
  pass: boolean;
  /** Couldn't reach the model (rate limit, outage): not counted in the pass rate. */
  errored?: boolean;
  error?: string;
  status: string;
  reply: string;
  changes: string[];
  steps: string[];
  inputTokens: number;
  outputTokens: number;
  ms: number;
}
const results: Result[] = [];

const base = enabled ? openAIChatModel({ model: modelId, ...(key ? { apiKey: key } : {}), ...(baseUrl ? { baseUrl } : {}) }) : null;
const model =
  base && (tpm > 0 || rpm > 0)
    ? rateLimitedChatModel(base, { ...(tpm > 0 ? { tokensPerMinute: tpm } : {}), ...(rpm > 0 ? { requestsPerMinute: rpm } : {}) })
    : base;

/** Infrastructure trouble, not a wrong answer: rate limits, outages, network. */
const isInfraError = (message: string) => /\b(429|rate limit|quota|credits|billing|5\d\d|overloaded|timed? ?out|ECONNRESET|fetch failed)\b/i.test(message);
/** Out of credits or quota: every later case would fail the same way, so they're skipped (as errored) instead of sent. */
const isAccountStop = (message: string) => /quota|credits|billing/i.test(message);
let accountStop: string | undefined;

describe.runIf(enabled).concurrent(`assistant live evals · ${modelId} · ${cases.length} cases`, () => {
  it.each(cases.map((c) => [c.id, c] as const))("%s", async (_id, c: EvalCase) => {
    const started = Date.now();
    const steps: string[] = [];
    let run: Awaited<ReturnType<typeof runCase>> | undefined;
    let error: string | undefined;
    let errored = false;
    try {
      if (accountStop) {
        errored = true;
        throw new Error(`not sent: ${accountStop}`);
      }
      run = await runCase(c, model!);
      for (const m of run.turn.messages) {
        if (m.role === "assistant") for (const tc of m.toolCalls ?? []) steps.push(`${tc.name} ${JSON.stringify(tc.arguments).slice(0, 300)}`);
        if (m.role === "tool" && m.content.includes('"ok":false')) steps.push(`  ↳ error: ${m.content.slice(0, 200)}`);
      }
      if (run.turn.status === "failed") {
        errored = isInfraError(run.turn.error ?? "");
        throw new Error(`turn failed: ${run.turn.error}`);
      }
      c.check({ doc: run.project.getState().doc, before: run.before, turn: run.turn });
    } catch (err) {
      error = (err as Error)?.message?.split("\n").slice(0, 6).join("\n") ?? String(err);
      if (err instanceof ChatModelError) errored = isInfraError(`${err.status ?? ""} ${err.message}`);
    }
    const failure = run?.turn.error ?? error ?? "";
    if (errored && !accountStop && isAccountStop(failure)) accountStop = failure.slice(0, 160);
    results.push({
      id: c.id,
      category: c.category,
      prompt: c.prompt,
      pass: !error,
      ...(errored ? { errored: true } : {}),
      ...(error ? { error } : {}),
      status: run?.turn.status ?? "error",
      reply: run?.turn.reply ?? "",
      changes: run?.turn.changes ?? [],
      steps,
      inputTokens: run?.turn.usage.inputTokens ?? 0,
      outputTokens: run?.turn.usage.outputTokens ?? 0,
      ms: Date.now() - started,
    });
    if (errored) console.warn(`[evals] ${c.id}: couldn't reach the model (${error?.slice(0, 120)})`);
    else expect(error ?? "pass").toBe("pass");
  });
});

it.runIf(!enabled)("live evals need OPENAI_API_KEY (or OPENAI_BASE_URL)", () => {
  throw new Error(
    "No OPENAI_API_KEY found, so the live cases were skipped. Set it in the shell (OPENAI_API_KEY=sk-… pnpm --filter @miraiclip/assistant eval) or in .env.local at the repo root or in packages/assistant.",
  );
});

afterAll(() => {
  if (!enabled || results.length === 0) return;
  mkdirSync(resultsDir, { recursive: true });
  // A rerun replaces those cases in the previous run's results.
  const fresh = new Set(results.map((r) => r.id));
  const all = [...previous.filter((r) => !fresh.has(r.id)), ...results].sort((x, y) => x.id.localeCompare(y.id));
  const scored = all.filter((r) => !r.errored);
  const errored = all.filter((r) => r.errored);
  const passed = scored.filter((r) => r.pass).length;
  const rate = scored.length ? passed / scored.length : 0;
  const byCat = new Map<string, { pass: number; total: number; errored: number }>();
  for (const r of all) {
    const e = byCat.get(r.category) ?? { pass: 0, total: 0, errored: 0 };
    if (r.errored) e.errored++;
    else {
      e.total++;
      if (r.pass) e.pass++;
    }
    byCat.set(r.category, e);
  }
  const tokens = results.reduce((t, r) => ({ in: t.in + r.inputTokens, out: t.out + r.outputTokens }), { in: 0, out: 0 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const lines = [
    `# Assistant live evals`,
    ``,
    `Model **${modelId}**${baseUrl ? ` at ${baseUrl}` : ""} · ${new Date().toISOString()}${rerun ? ` · rerun of ${rerun} cases (${results.length}), merged with the previous run` : ""}`,
    ``,
    `**${passed} / ${scored.length} passed (${(rate * 100).toFixed(1)}%)**${errored.length ? ` · ${errored.length} errored (couldn't reach the model; not counted — rerun with \`EVAL_RERUN=errored\`)` : ""}`,
    ``,
    `This run: ${results.length} cases · ${tokens.in.toLocaleString()} input / ${tokens.out.toLocaleString()} output tokens · median ${median(results.map((r) => r.ms)) / 1000}s per case${tpm > 0 ? ` · throttled to ${tpm.toLocaleString()} tokens/min` : ""}`,
    ``,
    `| Category | Passed | Errored |`,
    `| --- | --- | --- |`,
    ...[...byCat].sort().map(([cat, e]) => `| ${cat} | ${e.pass} / ${e.total} | ${e.errored || ""} |`),
    ``,
    `## Failures`,
    ``,
    ...scored
      .filter((r) => !r.pass)
      .flatMap((r) => [
        `### ${r.id} (${r.category})`,
        ``,
        `> ${r.prompt}`,
        ``,
        "```",
        r.error ?? "",
        "```",
        ``,
        `Status: ${r.status}. Reply: ${r.reply || "(none)"}`,
        ``,
        ...(r.steps.length ? ["Tool calls:", "", ...r.steps.map((st) => `- \`${st.replace(/`/g, "'")}\``), ""] : ["No tool calls.", ""]),
      ]),
  ];
  if (passed === scored.length) lines.push("None. 🎉");
  if (errored.length) lines.push("", "## Errored", "", ...errored.map((r) => `- ${r.id}: ${(r.error ?? "").split("\n")[0]!.slice(0, 160)}`));
  const json = JSON.stringify({ model: modelId, baseUrl, rate, results: all }, null, 2);
  writeFileSync(join(resultsDir, "latest.md"), lines.join("\n"));
  writeFileSync(join(resultsDir, "last.json"), json);
  writeFileSync(join(resultsDir, `${stamp}.json`), json);
  console.log(`\n[evals] ${passed}/${scored.length} passed (${(rate * 100).toFixed(1)}%)${errored.length ? `, ${errored.length} errored` : ""} — report: evals/results/latest.md`);
  if (scored.length && rate < minPass) throw new Error(`pass rate ${(rate * 100).toFixed(1)}% is below EVAL_MIN_PASS ${(minPass * 100).toFixed(0)}%`);
});

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
}

