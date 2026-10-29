/**
 * Preflight for rendering: is everything a render needs present and current?
 *
 * Inside the monorepo the CLI runs from source, so the only build output it depends on is the browser harness
 * (dist/harness.js, which bundles core and renderer) and the renderer's generated stage/three bundles. A stale
 * one renders old behaviour with no error, so the check compares them with their sources and rebuilds when
 * asked to. Outside the monorepo (the published package) only the browser and ffmpeg are checked.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launchBrowser } from "./browser.js";
import type { BrowserOptions } from "./types.js";

export interface DoctorCheck {
  name: string;
  ok: boolean;
  detail: string;
  /** Set when `fix` repaired it. */
  fixed?: boolean;
}

/** The newest file under these directories (skipping node_modules and dist), or null when there are none. */
export function newestFile(dirs: string[]): { file: string; mtimeMs: number } | null {
  let best: { file: string; mtimeMs: number } | null = null;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const mtimeMs = statSync(full).mtimeMs;
        if (!best || mtimeMs > best.mtimeMs) best = { file: full, mtimeMs };
      }
    }
  };
  dirs.filter(existsSync).forEach(walk);
  return best;
}

/** Whether a build output is older than the newest of its sources. A missing output is stale. */
export function isStale(output: string, sourceDirs: string[]): { stale: boolean; newest: string | null } {
  const newest = newestFile(sourceDirs);
  if (!existsSync(output)) return { stale: true, newest: newest?.file ?? null };
  return { stale: !!newest && newest.mtimeMs > statSync(output).mtimeMs, newest: newest?.file ?? null };
}

/** The monorepo root when this module runs from packages/server-export/src, else null (a published install). */
export function workspaceRoot(moduleDir = path.dirname(fileURLToPath(import.meta.url))): string | null {
  const root = path.resolve(moduleDir, "../../..");
  return path.basename(moduleDir) === "src" && existsSync(path.join(root, "packages/core/src")) && existsSync(path.join(root, "pnpm-workspace.yaml")) ? root : null;
}

function run(cmd: string, args: string[], cwd: string): { ok: boolean; out: string } {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", shell: process.platform === "win32" });
  return { ok: r.status === 0, out: `${r.stdout ?? ""}${r.stderr ?? ""}${r.error ? r.error.message : ""}`.trim() };
}

/** The build outputs a render depends on: fresh, or (with fix) rebuilt. Quick: no browser is started. */
export function checkBuild(root: string, fix: boolean): DoctorCheck[] {
  const checks: DoctorCheck[] = [];
  const renderer = path.join(root, "packages/renderer");
  for (const [name, script] of [["stage kit bundle", "bundle-stage.mjs"], ["three.js bundle", "bundle-three.mjs"]] as const) {
    const current = run("node", [`scripts/${script}`, "--check"], renderer).ok;
    if (current || !fix) {
      checks.push({ name, ok: current, detail: current ? "current" : `out of date: run node scripts/${script} in packages/renderer` });
      continue;
    }
    const regen = run("node", [`scripts/${script}`], renderer);
    checks.push({ name, ok: regen.ok, fixed: regen.ok, detail: regen.ok ? "regenerated" : `regeneration failed:\n${regen.out}` });
  }
  const harness = path.join(root, "packages/server-export/dist/harness.js");
  const sources = ["packages/core/src", "packages/renderer/src", "packages/server-export/src/harness"].map((d) => path.join(root, d));
  const { stale, newest } = isStale(harness, sources);
  if (!stale) checks.push({ name: "export harness", ok: true, detail: "current" });
  else if (!fix) checks.push({ name: "export harness", ok: false, detail: `older than ${newest ? path.relative(root, newest) : "its sources"}: run pnpm --filter @miraiclip/server-export build` });
  else {
    const build = run("pnpm", ["--filter", "@miraiclip/server-export", "build"], root);
    checks.push({ name: "export harness", ok: build.ok, fixed: build.ok, detail: build.ok ? `rebuilt (was older than ${newest ? path.relative(root, newest) : "its sources"})` : `rebuild failed:\n${build.out.slice(-2000)}` });
  }
  return checks;
}

/** Every check: build outputs (inside the monorepo), the browser, and ffmpeg/ffprobe. */
export async function runDoctor(options: { fix?: boolean; browser?: BrowserOptions } = {}): Promise<DoctorCheck[]> {
  const root = workspaceRoot();
  const checks = root ? checkBuild(root, options.fix ?? false) : [];
  try {
    const browser = await launchBrowser(options.browser);
    checks.push({ name: "browser", ok: true, detail: `${browser.browserType().name()} ${browser.version()}` });
    await browser.close();
  } catch (error) {
    checks.push({ name: "browser", ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
  for (const tool of ["ffmpeg", "ffprobe"]) {
    const r = spawnSync(tool, ["-version"], { encoding: "utf8" });
    checks.push({ name: tool, ok: r.status === 0, detail: r.status === 0 ? (r.stdout.split("\n")[0] ?? "found") : "not on PATH: needed for contact sheets, parallel joins and probing output" });
  }
  return checks;
}

export function formatDoctor(checks: DoctorCheck[]): string {
  return checks.map((c) => `${c.ok ? (c.fixed ? "FIXED" : "  OK ") : " FAIL"}  ${c.name.padEnd(17)} ${c.detail}`).join("\n");
}
