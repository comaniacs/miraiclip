#!/usr/bin/env node
/**
 * miraiclip — add ready-made blocks to a project.
 *
 *   miraiclip catalog [--category lower-third] [--search name] [--registry <url>] [--json]
 *   miraiclip show <block> [--registry <url>]
 *   miraiclip add <block> --project video.miraiclip.json [--at 2.5] [--duration 4] [--track overlays]
 *                 [--id lt-1] [--set name="Ada Lovelace" --set role=Founder] [--x 0.3 --y 0.84 --scale 1]
 *                 [--captions all|cap-1,cap-2] [--registry <url>] [--print]
 *   miraiclip build <out-dir> [--blocks <dir of block .json files>] [--name my-registry]
 *
 * `add` edits the project file (one undo-able transaction, atomic write) or,
 * with --print, prints `{ "commands": [...] }` for an agent's apply_commands.
 */
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { applyCommands, createProject, isCaptionClip, type ProjectDocument } from "@miraiclip/core";
import { blockCommands, captionStyleCommands } from "./apply.js";
import { buildRegistry, builtinBlocks, fetchRegistryBlock, fetchRegistryIndex, getBuiltinBlock, searchBlocks } from "./registry.js";
import { parseBlock, type Block } from "./types.js";

const HELP = `miraiclip — ready-made blocks for Miraiclip videos

  miraiclip catalog [--category <c>] [--search <text>] [--registry <url>] [--json]
  miraiclip show <block> [--registry <url>]
  miraiclip add <block> --project <file> [--at <seconds>] [--duration <seconds>]
                [--track <id>] [--id <clip id>] [--set key=value]... [--x <0..1>] [--y <0..1>]
                [--scale <n>] [--captions all|<id,id>] [--registry <url>] [--print]
  miraiclip build <out-dir> [--blocks <dir>] [--name <registry name>]

Built-in blocks need no network. --registry reads a static registry
(index.json + blocks/*.json) from any URL.
`;

interface Args {
  pos: string[];
  flags: Record<string, string | boolean>;
  sets: string[];
}

function parseArgs(argv: string[]): Args {
  const pos: string[] = [];
  const flags: Record<string, string | boolean> = {};
  const sets: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) {
      pos.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    const value = next !== undefined && !next.startsWith("--") ? (i++, next) : true;
    if (key === "set") {
      if (typeof value !== "string") throw new Error("--set needs key=value");
      sets.push(value);
    } else flags[key] = value;
  }
  return { pos, flags, sets };
}

const str = (v: string | boolean | undefined): string | undefined => (typeof v === "string" ? v : undefined);
const num = (name: string, v: string | boolean | undefined): number | undefined => {
  if (v === undefined) return undefined;
  const n = Number(v);
  if (typeof v !== "string" || !Number.isFinite(n)) throw new Error(`--${name} needs a number`);
  return n;
};

async function loadBlock(name: string, registry: string | undefined): Promise<Block> {
  if (registry) return fetchRegistryBlock(registry, name);
  const block = getBuiltinBlock(name);
  if (!block) {
    const close = searchBlocks(builtinBlocks(), { text: name.split("-")[0] ?? name }).map((b) => b.name);
    throw new Error(`no built-in block "${name}"${close.length ? ` (did you mean: ${close.slice(0, 4).join(", ")}?)` : ""}`);
  }
  return block;
}

async function catalog(args: Args): Promise<void> {
  const registry = str(args.flags["registry"]);
  const query = { text: str(args.flags["search"]) ?? "", category: str(args.flags["category"]) ?? "" };
  const rows = registry
    ? (await fetchRegistryIndex(registry)).blocks.filter(
        (b) =>
          (!query.category || b.category === query.category) &&
          query.text
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean)
            .every((w) => `${b.name} ${b.title} ${b.description} ${b.tags.join(" ")}`.toLowerCase().includes(w)),
      )
    : searchBlocks(builtinBlocks(), { ...(query.text ? { text: query.text } : {}), ...(query.category ? { category: query.category } : {}) });
  if (args.flags["json"]) {
    process.stdout.write(`${JSON.stringify(rows.map((b) => ({ name: b.name, title: b.title, category: b.category, description: b.description })), null, 2)}\n`);
    return;
  }
  let category = "";
  for (const b of rows) {
    if (b.category !== category) {
      category = b.category;
      process.stdout.write(`\n${category}\n`);
    }
    process.stdout.write(`  ${b.name.padEnd(26)} ${b.description}\n`);
  }
}

async function add(args: Args): Promise<void> {
  const name = args.pos[1];
  if (!name) throw new Error("add needs a block name (see `miraiclip catalog`)");
  const projectPath = str(args.flags["project"]) ?? process.env["MIRAICLIP_PROJECT"] ?? "video.miraiclip.json";
  const block = await loadBlock(name, str(args.flags["registry"]));
  const doc = JSON.parse(await readFile(projectPath, "utf8")) as ProjectDocument;
  const project = createProject(doc);

  let commands;
  if (block.content.kind === "caption-style") {
    const target = str(args.flags["captions"]) ?? "all";
    const ids =
      target === "all"
        ? Object.values(doc.clips).filter((c) => isCaptionClip(c)).map((c) => c.id)
        : target.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) throw new Error("no caption clips to style (add captions first, or pass --captions <ids>)");
    commands = captionStyleCommands(block, ids);
  } else {
    const values: Record<string, string> = {};
    for (const pair of args.sets) {
      const eq = pair.indexOf("=");
      if (eq <= 0) throw new Error(`--set ${pair}: expected key=value`);
      values[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
    const trackId = str(args.flags["track"]) ?? "overlays";
    const at = num("at", args.flags["at"]) ?? project.getState().playheadUs / 1e6;
    const duration = num("duration", args.flags["duration"]);
    const id = str(args.flags["id"]) ?? uniqueId(doc, block.name);
    const transform: Record<string, number> = {};
    for (const key of ["x", "y", "scale"] as const) {
      const v = num(key, args.flags[key]);
      if (v !== undefined) transform[key] = v;
    }
    commands = blockCommands(block, {
      id,
      trackId,
      createTrack: !doc.tracks[trackId],
      startUs: Math.round(at * 1e6),
      ...(duration !== undefined ? { durationUs: Math.round(duration * 1e6) } : {}),
      values,
      composition: doc.settings,
      transform,
    });
  }

  if (args.flags["print"]) {
    process.stdout.write(`${JSON.stringify({ commands }, null, 2)}\n`);
    return;
  }
  const result = applyCommands(project, commands, { label: `Add ${block.title}` });
  if (!result.ok) {
    throw new Error(`block "${block.name}" didn't apply (command ${result.failedIndex}): ${JSON.stringify(result.error)}`);
  }
  const tmp = `${projectPath}.tmp`;
  await writeFile(tmp, `${JSON.stringify(project.toJSON(), null, 2)}\n`, "utf8");
  await rename(tmp, projectPath);
  process.stderr.write(`miraiclip: added ${block.name} to ${projectPath}\n`);
}

function uniqueId(doc: ProjectDocument, base: string): string {
  if (!doc.clips[base]) return base;
  for (let i = 2; ; i++) if (!doc.clips[`${base}-${i}`]) return `${base}-${i}`;
}

async function build(args: Args): Promise<void> {
  const outDir = args.pos[1];
  if (!outDir) throw new Error("build needs an output directory");
  const blocks: unknown[] = [...builtinBlocks()];
  const extra = str(args.flags["blocks"]);
  if (extra) {
    for (const file of (await readdir(extra)).filter((f) => f.endsWith(".json")).sort()) {
      blocks.push(parseBlock(JSON.parse(await readFile(path.join(extra, file), "utf8"))));
    }
  }
  const files = buildRegistry(blocks as Block[], { ...(str(args.flags["name"]) ? { name: str(args.flags["name"])! } : {}) });
  for (const [rel, content] of files) {
    const target = path.join(outDir, rel);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
  process.stderr.write(`miraiclip: wrote ${files.size - 1} blocks + index.json to ${outDir}\n`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const command = args.pos[0];
  if (!command || args.flags["help"] || command === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (command === "catalog") return catalog(args);
  if (command === "show") {
    const name = args.pos[1];
    if (!name) throw new Error("show needs a block name");
    process.stdout.write(`${JSON.stringify(await loadBlock(name, str(args.flags["registry"])), null, 2)}\n`);
    return;
  }
  if (command === "add") return add(args);
  if (command === "build") return build(args);
  throw new Error(`unknown command "${command}"\n\n${HELP}`);
}

main().catch((error: unknown) => {
  process.stderr.write(`miraiclip: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
