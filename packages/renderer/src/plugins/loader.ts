/**
 * Loads the plugins a document declares (`doc.plugins`) into this JavaScript
 * realm — the main thread, an export worker, or the server-export page — so
 * its custom clip, effect and transition kinds validate and render here.
 *
 * Each plugin is a standalone ES module (no bare imports). The loader fetches
 * its source, checks the SRI `integrity` hash when one is given, imports it,
 * and calls its `register(api)` with core's registries, core's `z`, and the
 * renderer half (registries plus the Pixi classes drawing needs). Loading is
 * idempotent per realm: the same url + integrity registers once, however many
 * documents or exports ask for it.
 */
import {
  pluginFromModule,
  pluginZod,
  trackedCorePluginApi,
  unregisterPluginKinds,
  type MiraiclipPlugin,
  type PluginApi,
  type PluginEnvironment,
  type PluginRef,
  type PluginRegistrations,
  type ProjectDocument,
} from "@miraiclip/core";
import {
  BlurFilter,
  ColorMatrixFilter,
  Container,
  Filter,
  GlProgram,
  Graphics,
  Sprite,
  Text,
  Texture,
} from "pixi.js";
import {
  registerEffectRenderer,
  unregisterEffectRenderer,
  type EffectRendererFactory,
} from "../effects/pixi-effects.js";
import {
  registerTransitionRenderer,
  unregisterTransitionRenderer,
  type TransitionRenderer,
} from "../transitions/registry.js";
import {
  registerClipRenderer,
  unregisterClipRenderer,
  type ClipRenderer,
} from "../compositor/clip-renderers.js";

/** The Pixi classes a plugin can draw with (the renderer's own copies). */
export const PLUGIN_PIXI = {
  BlurFilter,
  ColorMatrixFilter,
  Container,
  Filter,
  GlProgram,
  Graphics,
  Sprite,
  Text,
  Texture,
} as const;

/** The renderer half of the plugin API. */
export interface RendererPluginApi {
  pixi: typeof PLUGIN_PIXI;
  registerEffectRenderer(kind: string, factory: EffectRendererFactory): void;
  registerTransitionRenderer(kind: string, renderer: TransitionRenderer): void;
  registerClipRenderer(kind: string, renderer: ClipRenderer): void;
}

/** A plugin as it receives the renderer API. */
export type RendererPlugin = MiraiclipPlugin<RendererPluginApi>;

export interface LoadPluginsOptions {
  /** Default: "worker" inside a worker, else "browser". */
  environment?: PluginEnvironment;
  /** Return false to refuse a plugin (it then fails the load). Default: allow all. */
  allow?: (ref: PluginRef) => boolean;
  /** Refuse plugins without an `integrity` hash. Default false. */
  requireIntegrity?: boolean;
  /** Resolve relative plugin URLs against this (default: the page/worker location). */
  baseUrl?: string;
  /** Fetch a plugin's source (default: `fetch(url).text()`). */
  fetchSource?: (url: string) => Promise<string>;
  /**
   * Turn a plugin's verified source into its module (default: import it from a
   * `data:` URL). A page whose Content Security Policy forbids that
   * (`script-src 'self'`) passes this to hand back a module it bundled itself,
   * picked by `ref.name` or `ref.integrity`. The source is still fetched and its
   * integrity hash still checked before this runs, so with an `integrity` on the
   * ref the bundled module answers for exactly the bytes the document names.
   */
  importModule?: (source: string, ref: PluginRef) => Promise<Record<string, unknown>> | Record<string, unknown>;
}

export interface LoadedPlugin {
  ref: PluginRef;
  plugin: MiraiclipPlugin;
}

export interface LoadedPlugins {
  plugins: LoadedPlugin[];
  /**
   * Unregister every kind these plugins added and forget them, so the next
   * document in a warm worker or server page starts clean. Safe to call twice.
   */
  unload(): void;
}

interface RendererRegistrations {
  effects: string[];
  transitions: string[];
  clips: string[];
}

interface CacheEntry {
  promise: Promise<LoadedPlugin>;
  core: PluginRegistrations;
  renderer: RendererRegistrations;
  users: number;
}

const cache = new Map<string, CacheEntry>();
/** name → cache key of the version currently registered (for replace-on-upgrade). */
const loadedNames = new Map<string, string>();

const keyOf = (ref: PluginRef): string => `${ref.url}#${ref.integrity ?? ""}`;

function detectEnvironment(): PluginEnvironment {
  const g = globalThis as { WorkerGlobalScope?: unknown; document?: unknown };
  return g.WorkerGlobalScope !== undefined && g.document === undefined ? "worker" : "browser";
}

function resolveUrl(url: string, baseUrl: string | undefined): string {
  const base = baseUrl ?? (globalThis as { location?: { href: string } }).location?.href;
  try {
    return base ? new URL(url, base).href : url;
  } catch {
    return url;
  }
}

/** Verify a Subresource Integrity hash ("sha384-<base64>") over UTF-8 source. */
export async function verifyPluginIntegrity(source: string, integrity: string): Promise<boolean> {
  const match = /^sha(256|384|512)-(.+)$/.exec(integrity);
  if (!match) return false;
  const algorithm = `SHA-${match[1]}`;
  const digest = new Uint8Array(await crypto.subtle.digest(algorithm, new TextEncoder().encode(source)));
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return btoa(binary) === match[2];
}

/** Import standalone module source through a data: URL (works in pages, workers and Node). */
export async function importModuleSource(source: string): Promise<Record<string, unknown>> {
  const bytes = new TextEncoder().encode(source);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const url = `data:text/javascript;base64,${btoa(binary)}`;
  return (await import(/* @vite-ignore */ url)) as Record<string, unknown>;
}

function trackedRendererApi(replace: boolean): { api: RendererPluginApi; registrations: RendererRegistrations } {
  const registrations: RendererRegistrations = { effects: [], transitions: [], clips: [] };
  const options = replace ? { replace: true } : undefined;
  return {
    registrations,
    api: {
      pixi: PLUGIN_PIXI,
      registerEffectRenderer(kind, factory) {
        registerEffectRenderer(kind, factory, options);
        registrations.effects.push(kind);
      },
      registerTransitionRenderer(kind, renderer) {
        registerTransitionRenderer(kind, renderer, options);
        registrations.transitions.push(kind);
      },
      registerClipRenderer(kind, renderer) {
        registerClipRenderer(kind, renderer, options);
        registrations.clips.push(kind);
      },
    },
  };
}

function unregisterRenderer(registrations: RendererRegistrations): void {
  for (const kind of registrations.effects) unregisterEffectRenderer(kind);
  for (const kind of registrations.transitions) unregisterTransitionRenderer(kind);
  for (const kind of registrations.clips) unregisterClipRenderer(kind);
}

async function loadOne(ref: PluginRef, options: LoadPluginsOptions, environment: PluginEnvironment): Promise<CacheEntry> {
  const key = keyOf(ref);
  const cached = cache.get(key);
  if (cached) {
    cached.users++;
    await cached.promise;
    return cached;
  }
  if (options.allow && !options.allow(ref)) throw new Error(`plugin "${ref.name}" (${ref.url}) is not allowed here`);
  if (options.requireIntegrity && !ref.integrity) {
    throw new Error(`plugin "${ref.name}" has no integrity hash, and this runtime requires one`);
  }
  const previousKey = loadedNames.get(ref.name);
  const replace = previousKey !== undefined && previousKey !== key;
  const core = trackedCorePluginApi({ replace });
  const renderer = trackedRendererApi(replace);
  const entry: CacheEntry = {
    core: core.registrations,
    renderer: renderer.registrations,
    users: 1,
    promise: (async () => {
      const url = resolveUrl(ref.url, options.baseUrl);
      const source = options.fetchSource
        ? await options.fetchSource(url)
        : await fetch(url).then((response) => {
            if (!response.ok) throw new Error(`plugin "${ref.name}": HTTP ${response.status} fetching ${url}`);
            return response.text();
          });
      if (ref.integrity && !(await verifyPluginIntegrity(source, ref.integrity))) {
        throw new Error(`plugin "${ref.name}" failed its integrity check (${ref.integrity})`);
      }
      const module = options.importModule ? await options.importModule(source, ref) : await importModuleSource(source);
      const plugin = pluginFromModule(module, ref);
      const api: PluginApi<RendererPluginApi> = { environment, z: pluginZod, core: core.api, renderer: renderer.api };
      await (plugin as RendererPlugin).register(api);
      return { ref, plugin };
    })(),
  };
  cache.set(key, entry);
  loadedNames.set(ref.name, key);
  try {
    await entry.promise;
  } catch (error) {
    cache.delete(key);
    if (loadedNames.get(ref.name) === key) loadedNames.delete(ref.name);
    unregisterPluginKinds(entry.core);
    unregisterRenderer(entry.renderer);
    throw error;
  }
  if (previousKey && previousKey !== key) cache.delete(previousKey); // superseded version
  return entry;
}

/**
 * Load every plugin `doc.plugins` lists (in order) into this realm. Resolves
 * once all have registered; rejects on the first failure (fetch, integrity,
 * import, or a `register` that throws) after undoing that plugin's kinds.
 */
export async function loadDocumentPlugins(
  doc: Pick<ProjectDocument, "plugins">,
  options: LoadPluginsOptions = {},
): Promise<LoadedPlugins> {
  const environment = options.environment ?? detectEnvironment();
  const entries: { ref: PluginRef; entry: CacheEntry }[] = [];
  for (const ref of doc.plugins ?? []) {
    entries.push({ ref, entry: await loadOne(ref, options, environment) });
  }
  const plugins: LoadedPlugin[] = [];
  for (const { entry } of entries) plugins.push(await entry.promise);
  let unloaded = false;
  return {
    plugins,
    unload() {
      if (unloaded) return;
      unloaded = true;
      for (const { ref, entry } of entries) {
        entry.users--;
        if (entry.users > 0) continue;
        const key = keyOf(ref);
        if (cache.get(key) !== entry) continue;
        cache.delete(key);
        if (loadedNames.get(ref.name) === key) loadedNames.delete(ref.name);
        unregisterPluginKinds(entry.core);
        unregisterRenderer(entry.renderer);
      }
    },
  };
}
