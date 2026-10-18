import { describe, expect, it } from "vitest";
import { applyCommands, createProject } from "@miraiclip/core";
import {
  BUILTIN_BLOCKS,
  blockCommands,
  buildRegistry,
  builtinBlocks,
  captionStyleCommands,
  fetchRegistryBlock,
  fetchRegistryIndex,
  getBuiltinBlock,
  parseBlock,
  resolveFieldValues,
  searchBlocks,
} from "../src/index.js";

describe("built-in blocks", () => {
  it("ships at least 20 valid blocks with unique names across the categories", () => {
    const blocks = builtinBlocks();
    expect(blocks.length).toBeGreaterThanOrEqual(20);
    expect(new Set(blocks.map((b) => b.name)).size).toBe(blocks.length);
    const categories = new Set(blocks.map((b) => b.category));
    for (const c of ["lower-third", "callout", "intro", "outro", "cursor", "caption-style"]) expect(categories.has(c as never)).toBe(true);
  });

  it("every html block's placeholders are declared fields, and every field is used", () => {
    for (const block of builtinBlocks()) {
      if (block.content.kind !== "html") continue;
      const used = new Set([...block.content.template.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map((m) => m[1]));
      const declared = new Set(block.fields.map((f) => f.key));
      expect([...used].filter((k) => !declared.has(k!)), block.name).toEqual([]);
      expect([...declared].filter((k) => !used.has(k)), block.name).toEqual([]);
      expect(block.content.template, block.name).not.toMatch(/\$\{/); // no unexpanded interpolation
    }
  });

  it("every block applies to a 16:9 and a 9:16 project through core", () => {
    for (const [width, height] of [[1920, 1080], [1080, 1920]] as const) {
      const p = createProject({ width, height, fps: 30 });
      p.dispatch({ type: "track/add", payload: { id: "c", kind: "video" } });
      p.dispatch({ type: "clip/add", payload: { kind: "caption", id: "cap", trackId: "c", startUs: 0, durationUs: 1_000_000, words: [{ text: "hi", startUs: 0, durationUs: 500_000 }] } });
      for (const block of builtinBlocks()) {
        const commands =
          block.content.kind === "html"
            ? blockCommands(block, { trackId: "o", createTrack: !p.getState().doc.tracks["o"], startUs: 0, composition: { width, height } })
            : captionStyleCommands(block, ["cap"]);
        const result = applyCommands(p, commands);
        expect(result.ok, `${block.name}: ${JSON.stringify(!result.ok && result.error)}`).toBe(true);
      }
    }
  });
});

describe("blockCommands", () => {
  const lt = getBuiltinBlock("lower-third-classic")!;
  it("fills defaults, applies values, scales sized blocks from the 1080p reference", () => {
    const [track, clip] = blockCommands(lt, {
      id: "lt",
      trackId: "o",
      createTrack: true,
      startUs: 2_000_000,
      values: { name: "Grace Hopper" },
      composition: { width: 3840, height: 2160 },
      transform: { y: 0.8 },
    });
    expect(track).toEqual({ type: "track/add", payload: { id: "o", kind: "video" } });
    expect(clip!.payload).toMatchObject({
      kind: "html",
      id: "lt",
      startUs: 2_000_000,
      durationUs: 5_000_000,
      params: { name: "Grace Hopper", role: "Founder, Analytical Co.", accent: "#8b7bff" },
      widthPx: 900,
      animated: true,
      transform: { x: 0.3, y: 0.8, scale: 2 },
    });
  });

  it("keeps a sized block's default spot inside a portrait frame", () => {
    const [clip] = blockCommands(lt, { trackId: "o", startUs: 0, composition: { width: 1080, height: 1920 } });
    const x = (clip!.payload["transform"] as { x: number }).x;
    expect(x - 900 / 2 / 1080).toBeGreaterThanOrEqual(0.04 - 1e-9);
    const [kept] = blockCommands(lt, { trackId: "o", startUs: 0, composition: { width: 1080, height: 1920 }, transform: { x: 0.1 } });
    expect((kept!.payload["transform"] as { x: number }).x).toBe(0.1);
  });

  it("validates and coerces field values", () => {
    expect(() => resolveFieldValues(lt, { nmae: "x" })).toThrow(/no field "nmae"/);
    expect(() => resolveFieldValues(lt, { accent: "not a colour!" })).toThrow(/CSS colour/);
    const block = parseBlock({
      name: "t", title: "T", description: "d", category: "title",
      fields: [{ key: "n", label: "N", type: "number", default: 1 }, { key: "on", label: "On", type: "boolean", default: false }],
      content: { kind: "html", template: "<div>{{n}}{{on}}</div>", durationUs: 1 },
    });
    expect(resolveFieldValues(block, { n: "3", on: "yes" })).toEqual({ n: 3, on: true });
    expect(() => resolveFieldValues(block, { n: "three" })).toThrow(/number/);
    expect(() => parseBlock({ ...block, fields: [{ key: "n", label: "N", type: "number", default: "1" }] })).toThrow(/default/);
  });

  it("refuses to place a caption style, and styles caption clips instead", () => {
    const style = getBuiltinBlock("caption-bold-pop")!;
    expect(() => blockCommands(style, { trackId: "o", startUs: 0, composition: { width: 1, height: 1 } })).toThrow(/caption/);
    expect(captionStyleCommands(style, ["a", "b"])).toHaveLength(2);
  });
});

describe("static registries", () => {
  it("builds index.json + blocks/*.json and reads them back over fetch", async () => {
    const files = buildRegistry(BUILTIN_BLOCKS, { name: "test" });
    const index = JSON.parse(files.get("index.json")!);
    expect(index.format).toBe(1);
    expect(index.blocks).toHaveLength(BUILTIN_BLOCKS.length);
    const fakeFetch = async (url: string) => {
      const key = url.replace("https://reg.test/r/", "");
      const body = files.get(key);
      return { ok: body !== undefined, status: body ? 200 : 404, json: async () => JSON.parse(body!) };
    };
    expect((await fetchRegistryIndex("https://reg.test/r/", fakeFetch)).name).toBe("test");
    const block = await fetchRegistryBlock("https://reg.test/r", "cursor-click", fakeFetch);
    expect(block.category).toBe("cursor");
    await expect(fetchRegistryBlock("https://reg.test/r", "nope", fakeFetch)).rejects.toThrow(/no block/);
    expect(() => buildRegistry([...BUILTIN_BLOCKS, BUILTIN_BLOCKS[0]!])).toThrow(/duplicate/);
  });

  it("searches by text and category", () => {
    expect(searchBlocks(builtinBlocks(), { category: "cursor" }).map((b) => b.name).sort()).toEqual(["cursor-arrow", "cursor-click", "cursor-dot", "cursor-halo", "cursor-hand", "cursor-highlight", "cursor-ring"]);
    expect(searchBlocks(builtinBlocks(), { text: "tutorial step" }).length).toBeGreaterThan(0);
  });
});
