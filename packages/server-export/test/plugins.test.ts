/**
 * Self-describing plugins through the real server pipeline: a document lists
 * its plugin, the server reads and verifies it (only when allowed), and the
 * page registers it for the job — custom clip and effect kinds render, and
 * the next job starts clean.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createProject, registerClipKind, unregisterClipKind, pluginZod } from "@miraiclip/core";
import { createRenderSession, type RenderSession } from "../src/render-session.js";
import { preparePlugins } from "../src/plugins.js";

const CANDIDATES = [process.env["MIRAICLIP_BROWSER"], "/opt/pw-browsers/chromium"].filter(
  (p): p is string => p !== undefined && existsSync(p),
);
const browserPath = CANDIDATES[0];
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const SOURCE = readFileSync(path.join(FIXTURES, "box-plugin.mjs"), "utf8");
const INTEGRITY = `sha384-${createHash("sha384").update(SOURCE).digest("base64")}`;

/** PNG header check: signature plus IHDR width/height (big-endian at 16..23). */
function pngSize(bytes: Uint8Array): { width: number; height: number } {
  expect(Array.from(bytes.subarray(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Minimal PNG decode (8-bit RGB/RGBA, all five row filters) → one pixel. */
function pngPixel(bytes: Uint8Array, x: number, y: number): [number, number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const channels = bytes[25] === 6 ? 4 : 3;
  const idat: Uint8Array[] = [];
  for (let off = 8; off < bytes.length; ) {
    const len = view.getUint32(off);
    const type = String.fromCharCode(...bytes.subarray(off + 4, off + 8));
    if (type === "IDAT") idat.push(bytes.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  let prev = new Uint8Array(stride);
  let row = new Uint8Array(stride);
  for (let r = 0; r <= y; r++) {
    const base = r * (stride + 1);
    const filter = raw[base]!;
    row = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const v = raw[base + 1 + i]!;
      const a = i >= channels ? row[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      row[i] = (v + [0, a, b, (a + b) >> 1, paeth][filter]!) & 0xff;
    }
    prev = row;
  }
  return [row[x * channels]!, row[x * channels + 1]!, row[x * channels + 2]!];
}


/**
 * The doc is built through core commands, so core needs the clip kind while
 * building it (the page gets the plugin from the manifest, not from us).
 */
const BOX_KIND = { propsSchema: pluginZod.object({}).passthrough(), trackKinds: ["video"] as const };

function boxDoc(withPlugin = true, integrity: string | null = INTEGRITY) {
  registerClipKind("test/box", BOX_KIND);
  try {
    const project = createProject({ width: 160, height: 90, fps: 30 });
    project.transaction(() => {
      if (withPlugin) {
        project.dispatch({
          type: "plugin/add",
          payload: { name: "test-box", version: "1.0.0", url: "box-plugin.mjs", ...(integrity ? { integrity } : {}) },
        });
      }
      project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
      project.dispatch({
        type: "clip/add",
        payload: { kind: "test/box", id: "b", trackId: "v1", startUs: 0, durationUs: 1_000_000, props: { color: "#ff0000", widthFrac: 1, heightFrac: 1 } },
      });
    });
    return project.toJSON();
  } finally {
    unregisterClipKind("test/box");
  }
}

describe("preparePlugins (Node side gate)", () => {
  it("refuses plugins unless allowed, checks integrity, and keys sources by content", async () => {
    const doc = boxDoc();
    await expect(preparePlugins(doc, undefined, FIXTURES)).rejects.toThrow(/does not allow/);
    await expect(preparePlugins(doc, { allow: ["https://cdn.example/"] }, FIXTURES)).rejects.toThrow(/does not allow/);
    const ok = await preparePlugins(doc, { allow: true }, FIXTURES);
    expect(ok!.refs[0]!.url).toMatch(/^miraiclip-plugin:[0-9a-f]{64}$/);
    expect(ok!.sources[ok!.refs[0]!.url]).toBe(SOURCE);
    await expect(preparePlugins(boxDoc(true, "sha384-AAAA"), { allow: true }, FIXTURES)).rejects.toThrow(/integrity/);
    await expect(preparePlugins(boxDoc(true, null), { allow: true, requireIntegrity: true }, FIXTURES)).rejects.toThrow(/no integrity/);
    expect(await preparePlugins({}, undefined, FIXTURES)).toBeNull();
  });
});

describe.skipIf(browserPath === undefined)("document plugins (integration)", () => {
  let session: RenderSession;
  beforeAll(async () => {
    session = await createRenderSession({
      assetsDir: FIXTURES,
      browser: { executablePath: browserPath!, swiftshader: true },
      plugins: { allow: true },
    });
  }, 60_000);
  afterAll(async () => {
    await session?.close();
  });

  it("renders a plugin clip kind and a plugin effect", async () => {
    const red = await session.renderStill(boxDoc(), { timeUs: 500_000 });
    const [r, g] = pngPixel(red, 80, 45);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(40);

    const tinted = (() => {
      const doc = boxDoc();
      // Add the plugin effect straight into the document (core here doesn't know test/tint).
      (doc.clips["b"] as { effects?: unknown[] }).effects = [{ id: "t", kind: "test/tint", enabled: true, params: { amount: 1 } }];
      return doc;
    })();
    const green = await session.renderStill(tinted, { timeUs: 500_000 });
    const [r2, g2] = pngPixel(green, 80, 45);
    expect(r2).toBeLessThan(40);
    expect(g2).toBeGreaterThan(200);
  }, 60_000);

  it("unloads after each job: the same warm page renders nothing for an undeclared kind", async () => {
    await session.renderStill(boxDoc(), { timeUs: 500_000 }); // loads + unloads
    const bare = await session.renderStill(boxDoc(false), { timeUs: 500_000 });
    const [r] = pngPixel(bare, 80, 45);
    expect(r, "no plugin → custom kind draws nothing").toBeLessThan(40);
  }, 60_000);
});
