/**
 * Static registries: a folder of JSON any web host can serve (GitHub Pages,
 * a CDN, your own site). `index.json` lists the blocks; each block lives in
 * `blocks/<name>.json`. No server, no database — publishing is copying files.
 */
import { BUILTIN_BLOCKS } from "./blocks.js";
import { parseBlock, type Block, type BlockInput, type RegistryEntry, type RegistryIndex } from "./types.js";

let builtins: Block[] | undefined;

/** The blocks that ship with this package, validated. */
export function builtinBlocks(): Block[] {
  builtins ??= BUILTIN_BLOCKS.map((b) => parseBlock(b));
  return builtins;
}

/** A built-in block by name (undefined when there is none). */
export function getBuiltinBlock(name: string): Block | undefined {
  return builtinBlocks().find((b) => b.name === name);
}

/** Search blocks by text (name, title, description, tags) and/or category. */
export function searchBlocks(
  blocks: readonly Block[],
  query: { text?: string; category?: string } = {},
): Block[] {
  const words = (query.text ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  return blocks.filter((b) => {
    if (query.category && b.category !== query.category) return false;
    const hay = `${b.name} ${b.title} ${b.description} ${b.tags.join(" ")}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Build a static registry: path → file contents (JSON), ready to write to a folder. */
export function buildRegistry(blocks: readonly BlockInput[], options: { name?: string } = {}): Map<string, string> {
  const parsed = blocks.map((b) => parseBlock(b));
  const seen = new Set<string>();
  const files = new Map<string, string>();
  const entries: RegistryEntry[] = [];
  for (const block of parsed) {
    if (seen.has(block.name)) throw new Error(`duplicate block name "${block.name}"`);
    seen.add(block.name);
    const path = `blocks/${block.name}.json`;
    files.set(path, `${JSON.stringify(block, null, 2)}\n`);
    const entry: RegistryEntry = {
      name: block.name,
      title: block.title,
      description: block.description,
      category: block.category,
      tags: block.tags,
      version: block.version,
      aspects: block.aspects,
      path,
    };
    if (block.preview) entry.preview = block.preview;
    entries.push(entry);
  }
  entries.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const index: RegistryIndex = { format: 1, name: options.name ?? "miraiclip", blocks: entries };
  files.set("index.json", `${JSON.stringify(index, null, 2)}\n`);
  return files;
}

export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const join = (base: string, path: string): string => `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

/** Read a registry's index.json. */
export async function fetchRegistryIndex(baseUrl: string, fetchImpl: FetchLike = fetch as unknown as FetchLike): Promise<RegistryIndex> {
  const response = await fetchImpl(join(baseUrl, "index.json"));
  if (!response.ok) throw new Error(`registry ${baseUrl}: HTTP ${response.status} for index.json`);
  const index = (await response.json()) as RegistryIndex;
  if (index?.format !== 1 || !Array.isArray(index.blocks)) throw new Error(`registry ${baseUrl}: not a format-1 index.json`);
  return index;
}

/** Fetch and validate one block from a registry. */
export async function fetchRegistryBlock(
  baseUrl: string,
  name: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
): Promise<Block> {
  const index = await fetchRegistryIndex(baseUrl, fetchImpl);
  const entry = index.blocks.find((b) => b.name === name);
  if (!entry) throw new Error(`registry ${baseUrl} has no block "${name}"`);
  const response = await fetchImpl(join(baseUrl, entry.path));
  if (!response.ok) throw new Error(`registry ${baseUrl}: HTTP ${response.status} for ${entry.path}`);
  return parseBlock(await response.json());
}
