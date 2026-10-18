import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { clipKindRegistration, effectParamsSchema } from "@miraiclip/core";
import { loadDocumentPlugins, verifyPluginIntegrity } from "../src/plugins/loader.js";
import { getClipRenderer } from "../src/compositor/clip-renderers.js";
import { getEffectRenderer } from "../src/effects/pixi-effects.js";

const SOURCE = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../../server-export/test/fixtures/box-plugin.mjs"),
  "utf8",
);
const sri = (s: string) => `sha384-${createHash("sha384").update(s).digest("base64")}`;
const ref = (extra: Record<string, string> = {}) => ({ name: "test-box", version: "1.0.0", url: "https://plugins.test/box.mjs", ...extra });

describe("loadDocumentPlugins", () => {
  it("verifies SRI hashes", async () => {
    expect(await verifyPluginIntegrity(SOURCE, sri(SOURCE))).toBe(true);
    expect(await verifyPluginIntegrity(SOURCE + " ", sri(SOURCE))).toBe(false);
    expect(await verifyPluginIntegrity(SOURCE, "md5-abc")).toBe(false);
  });

  it("registers core and renderer kinds, once per realm, and unloads them", async () => {
    let fetches = 0;
    const fetchSource = async () => {
      fetches++;
      return SOURCE;
    };
    const doc = { plugins: [ref({ integrity: sri(SOURCE) })] };
    const a = await loadDocumentPlugins(doc, { fetchSource, environment: "browser" });
    const b = await loadDocumentPlugins(doc, { fetchSource, environment: "browser" });
    expect(fetches).toBe(1);
    expect(a.plugins[0]!.plugin.name).toBe("test-box");
    expect(clipKindRegistration("test/box")).toBeDefined();
    expect(effectParamsSchema("test/tint")).toBeDefined();
    expect(getClipRenderer("test/box")).toBeDefined();
    expect(getEffectRenderer("test/tint")).toBeDefined();
    a.unload();
    expect(clipKindRegistration("test/box"), "still used by the second load").toBeDefined();
    b.unload();
    b.unload();
    expect(clipKindRegistration("test/box")).toBeUndefined();
    expect(getClipRenderer("test/box")).toBeUndefined();
    expect(effectParamsSchema("test/tint")).toBeUndefined();
  });

  it("a newer version of the same plugin replaces its kinds (hot reload)", async () => {
    const v1 = await loadDocumentPlugins({ plugins: [ref()] }, { fetchSource: async () => SOURCE });
    const first = clipKindRegistration("test/box");
    const SOURCE2 = SOURCE.replace('version: "1.0.0"', 'version: "1.0.1"');
    const v2 = await loadDocumentPlugins({ plugins: [ref({ version: "1.0.1", url: "https://plugins.test/box@2.mjs" })] }, { fetchSource: async () => SOURCE2 });
    expect(clipKindRegistration("test/box")).not.toBe(first);
    v1.unload(); // superseded: must not remove v2's kinds
    expect(clipKindRegistration("test/box")).toBeDefined();
    v2.unload();
    expect(clipKindRegistration("test/box")).toBeUndefined();
  });

  it("fails cleanly: integrity mismatch, refusal, missing register", async () => {
    await expect(
      loadDocumentPlugins({ plugins: [ref({ integrity: sri("other") })] }, { fetchSource: async () => SOURCE }),
    ).rejects.toThrow(/integrity/);
    expect(clipKindRegistration("test/box")).toBeUndefined();
    await expect(loadDocumentPlugins({ plugins: [ref()] }, { allow: () => false, fetchSource: async () => SOURCE })).rejects.toThrow(/not allowed/);
    await expect(loadDocumentPlugins({ plugins: [ref()] }, { requireIntegrity: true, fetchSource: async () => SOURCE })).rejects.toThrow(/integrity/);
    await expect(
      loadDocumentPlugins({ plugins: [ref({ url: "https://plugins.test/bad.mjs" })] }, { fetchSource: async () => "export const x = 1;" }),
    ).rejects.toThrow(/register/);
  });
});
