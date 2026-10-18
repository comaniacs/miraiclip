/**
 * Plugins on the server: a document's `doc.plugins` are code, so the server
 * never runs them unless you say so (`plugins.allow`). Allowed plugin sources
 * are read HERE (https fetch, or a file under the plugin directory),
 * integrity-checked, and handed to the page as text; the page imports and
 * registers them for the one job, then unloads them, so a warm session never
 * leaks one document's kinds into the next.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PluginRef, ProjectDocument } from "@miraiclip/core";

export interface ServerPluginOptions {
  /**
   * Which `doc.plugins` may run: `true` any, a list of allowed URL prefixes
   * (e.g. `["https://cdn.example.com/plugins/"]`), or a predicate. Default:
   * none — a document that declares plugins fails with a clear error.
   */
  allow?: boolean | readonly string[] | ((ref: PluginRef) => boolean);
  /** Refuse plugins without an SRI `integrity` hash (default false). */
  requireIntegrity?: boolean;
  /** Directory relative / file plugin URLs resolve against (default: the assets dir, else cwd). */
  dir?: string;
}

/** What the page receives: the doc's refs rewritten to content-addressed keys, plus each key's source. */
export interface PreparedPlugins {
  refs: PluginRef[];
  sources: Record<string, string>;
}

function isAllowed(ref: PluginRef, allow: ServerPluginOptions["allow"]): boolean {
  if (allow === true) return true;
  if (!allow) return false;
  if (typeof allow === "function") return allow(ref);
  return allow.some((prefix) => ref.url.startsWith(prefix));
}

/** Check an SRI hash ("sha384-<base64>") against UTF-8 source. */
export function checkIntegrity(source: string, integrity: string): boolean {
  const match = /^sha(256|384|512)-(.+)$/.exec(integrity);
  if (!match) return false;
  return createHash(`sha${match[1]}`).update(source, "utf8").digest("base64") === match[2];
}

async function readSource(ref: PluginRef, dir: string): Promise<string> {
  if (/^https?:\/\//.test(ref.url)) {
    const response = await fetch(ref.url);
    if (!response.ok) throw new Error(`plugin "${ref.name}": HTTP ${response.status} fetching ${ref.url}`);
    return response.text();
  }
  if (ref.url.startsWith("data:")) {
    const comma = ref.url.indexOf(",");
    const meta = ref.url.slice(5, comma);
    const body = ref.url.slice(comma + 1);
    return meta.endsWith(";base64") ? Buffer.from(body, "base64").toString("utf8") : decodeURIComponent(body);
  }
  const filePath = ref.url.startsWith("file://") ? new URL(ref.url).pathname : path.resolve(dir, ref.url);
  return readFile(filePath, "utf8");
}

/**
 * Read, gate and verify every plugin a document declares. Returns null when
 * the document declares none.
 */
export async function preparePlugins(
  doc: Pick<ProjectDocument, "plugins">,
  options: ServerPluginOptions | undefined,
  fallbackDir: string | undefined,
): Promise<PreparedPlugins | null> {
  const declared = doc.plugins ?? [];
  if (declared.length === 0) return null;
  const dir = options?.dir ?? fallbackDir ?? process.cwd();
  const refs: PluginRef[] = [];
  const sources: Record<string, string> = {};
  for (const ref of declared) {
    if (!isAllowed(ref, options?.allow)) {
      throw new Error(
        `document declares plugin "${ref.name}" (${ref.url}), which this server does not allow — pass plugins: { allow: … } to run it`,
      );
    }
    if (options?.requireIntegrity && !ref.integrity) {
      throw new Error(`plugin "${ref.name}" has no integrity hash, and this server requires one`);
    }
    const source = await readSource(ref, dir);
    if (ref.integrity && !checkIntegrity(source, ref.integrity)) {
      throw new Error(`plugin "${ref.name}" failed its integrity check (${ref.integrity})`);
    }
    const key = `miraiclip-plugin:${createHash("sha256").update(source, "utf8").digest("hex")}`;
    sources[key] = source;
    refs.push({ ...ref, url: key });
  }
  return { refs, sources };
}
