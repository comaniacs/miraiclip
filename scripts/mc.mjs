#!/usr/bin/env node
// `pnpm mc <command> …`: the miraiclip-export CLI from source, in the directory you called it from.
// From source there is nothing to build first: the CLI checks the generated bundles and the export harness
// against their sources and rebuilds what is stale (see packages/server-export/src/doctor.ts).
//
//   pnpm mc doctor [--fix]
//   pnpm mc stills project.json --at 1,9.5,15 --sheet
//   pnpm mc check project.json
//   pnpm mc project.json --out film.mp4 [--workers 4] [--motion-blur]
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tsx = path.join(root, "packages/server-export/node_modules/.bin/tsx");
const cli = path.join(root, "packages/server-export/src/cli.ts");
const r = spawnSync(tsx, [cli, ...process.argv.slice(2)], { stdio: "inherit", cwd: process.env.INIT_CWD || process.cwd(), shell: process.platform === "win32" });
if (r.error) {
  process.stderr.write(`mc: could not start tsx (${r.error.message}); run pnpm install at the repo root\n`);
  process.exit(1);
}
process.exit(r.status ?? 1);
