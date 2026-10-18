/**
 * Self-describing plugins. A document that uses custom kinds lists the
 * plugins that define them in `doc.plugins`, so every place that renders or
 * edits it — the browser, the export worker, the server-export page, the MCP
 * server — can load the same code and treat the custom kinds like built-ins.
 *
 * Core only holds the manifest (commands below) and the plugin contract. The
 * loaders that fetch, verify and import plugin code live with the runtimes
 * that need them (`loadDocumentPlugins` in @miraiclip/renderer, the MCP
 * server's Node loader), so core stays free of I/O.
 */
import { z } from "zod";
import {
  registerClipKind,
  registerEffectKind,
  registerTransitionKind,
  unregisterClipKind,
  unregisterEffectKind,
  unregisterTransitionKind,
  type ClipKindRegistration,
} from "./registry.js";
import type { PluginRef, ProjectDocument } from "./types.js";

/** Where a plugin is being loaded. Plugins can skip work a runtime doesn't need. */
export type PluginEnvironment = "browser" | "worker" | "server" | "node";

/** Core registration API handed to a plugin. Registrations are tracked so the loader can undo them. */
export interface CorePluginApi {
  registerClipKind(kind: string, registration: ClipKindRegistration): void;
  registerEffectKind(kind: string, paramsSchema: z.ZodType): void;
  registerTransitionKind(kind: string, paramsSchema: z.ZodType): void;
}

/**
 * What a plugin's `register` receives. Plugins are loaded as standalone
 * modules (no bare imports), so the runtime hands them everything they need:
 * core's `z` (schemas must come from the same zod instance core validates
 * with), core's registries, and — where something draws — the renderer half.
 */
export interface PluginApi<R = unknown> {
  environment: PluginEnvironment;
  z: typeof z;
  core: CorePluginApi;
  /** Present where rendering happens (browser, worker, server page); absent in Node. */
  renderer?: R;
}

/** A plugin module's default export (or its named `plugin` export). */
export interface MiraiclipPlugin<R = unknown> {
  name: string;
  version?: string;
  register(api: PluginApi<R>): void | Promise<void>;
}

/** Identity helper for typing a plugin module. */
export function definePlugin<R = unknown>(plugin: MiraiclipPlugin<R>): MiraiclipPlugin<R> {
  return plugin;
}

/** The plugins a document declares (empty when none). */
export function documentPlugins(doc: Pick<ProjectDocument, "plugins">): PluginRef[] {
  return doc.plugins ? [...doc.plugins] : [];
}

/** Every kind a plugin registered through a tracked API, for unloading. */
export interface PluginRegistrations {
  clipKinds: string[];
  effectKinds: string[];
  transitionKinds: string[];
}

/**
 * A core API that records what it registers. `replace` lets a newer version
 * of the same plugin redefine its kinds (hot reload); a different plugin
 * still can't take over a kind.
 */
export function trackedCorePluginApi(options: { replace?: boolean } = {}): {
  api: CorePluginApi;
  registrations: PluginRegistrations;
} {
  const registrations: PluginRegistrations = { clipKinds: [], effectKinds: [], transitionKinds: [] };
  const replace = options.replace ? { replace: true } : undefined;
  return {
    registrations,
    api: {
      registerClipKind(kind, registration) {
        registerClipKind(kind, registration, replace);
        registrations.clipKinds.push(kind);
      },
      registerEffectKind(kind, schema) {
        registerEffectKind(kind, schema, replace);
        registrations.effectKinds.push(kind);
      },
      registerTransitionKind(kind, schema) {
        registerTransitionKind(kind, schema, replace);
        registrations.transitionKinds.push(kind);
      },
    },
  };
}

/** Undo a plugin's core registrations (warm-worker cleanup between tenants). */
export function unregisterPluginKinds(registrations: PluginRegistrations): void {
  for (const kind of registrations.clipKinds) unregisterClipKind(kind);
  for (const kind of registrations.effectKinds) unregisterEffectKind(kind);
  for (const kind of registrations.transitionKinds) unregisterTransitionKind(kind);
}

/** Resolve a module namespace to its plugin (default export, or a named `plugin`). */
export function pluginFromModule(namespace: Record<string, unknown>, ref: PluginRef): MiraiclipPlugin {
  const candidate = (namespace["default"] ?? namespace["plugin"]) as Partial<MiraiclipPlugin> | undefined;
  if (!candidate || typeof candidate.register !== "function") {
    throw new Error(`plugin "${ref.name}" (${ref.url}) has no default export with a register(api) function`);
  }
  return candidate as MiraiclipPlugin;
}

export { z as pluginZod };
