import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Live evals: real model calls (pnpm eval). Not part of `pnpm test`.
 *
 * Reads OPENAI_* / EVAL_* from the shell, or from .env / .env.local in this
 * package or the repo root (shell wins). Keep keys in .env.local: it's
 * gitignored.
 */
const here = fileURLToPath(new URL(".", import.meta.url));
const WANTED = /^(OPENAI_|EVAL_)/;

/** KEY=value lines of a dotenv file (quotes stripped, # comments skipped), OPENAI_* / EVAL_* only. */
function readEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || !WANTED.test(m[1]!)) continue;
    out[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

const fromFiles = Object.assign({}, ...[`${here}../../.env`, `${here}../../.env.local`, `${here}.env`, `${here}.env.local`].map(readEnvFile));
const env = { ...fromFiles, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => WANTED.test(k))) } as Record<string, string>;

export default defineConfig({
  test: {
    include: ["evals/**/*.eval.ts"],
    env,
    // Throttled cases can wait in line for a while.
    testTimeout: 900_000,
    hookTimeout: 60_000,
    maxConcurrency: Number(env.EVAL_CONCURRENCY ?? 2),
  },
});
