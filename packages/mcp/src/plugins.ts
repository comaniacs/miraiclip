/**
 * The MCP server's half of document plugins: it edits documents in Node, so
 * it only needs a plugin's CORE registrations (custom kinds must validate
 * when the agent dispatches `clip/add` / `effect/add`). Rendering happens in
 * the preview/export browser page, which server-export loads separately.
 * Plugin code runs only when the server was started with plugins allowed.
 */
import {
  pluginFromModule,
  pluginZod,
  trackedCorePluginApi,
  unregisterPluginKinds,
  type PluginRef,
  type PluginRegistrations,
  type ProjectDocument,
} from "@miraiclip/core";
import { preparePlugins, type ServerPluginOptions } from "@miraiclip/server-export";

interface Loaded {
  key: string;
  registrations: PluginRegistrations;
}

/** Loads/unloads the core half of a document's plugins as its manifest changes. */
export class NodePluginHost {
  private readonly loaded = new Map<string, Loaded>(); // plugin name → what it registered

  constructor(
    private readonly options: ServerPluginOptions | undefined,
    private readonly dir: string,
  ) {}

  /**
   * Bring registrations in line with `doc.plugins`. Returns human-readable
   * problems (refused, unreadable, failed integrity) instead of throwing, so
   * an edit still lands and the agent sees why a kind is unknown.
   */
  async sync(doc: Pick<ProjectDocument, "plugins">): Promise<string[]> {
    const problems: string[] = [];
    const wanted = new Map((doc.plugins ?? []).map((ref) => [ref.name, ref] as const));
    for (const [name, loaded] of this.loaded) {
      const ref = wanted.get(name);
      if (!ref || keyOf(ref) !== loaded.key) {
        unregisterPluginKinds(loaded.registrations);
        this.loaded.delete(name);
      }
    }
    for (const ref of wanted.values()) {
      if (this.loaded.has(ref.name)) continue;
      try {
        const prepared = await preparePlugins({ plugins: [ref] }, this.options, this.dir);
        const source = prepared!.sources[prepared!.refs[0]!.url]!;
        const url = `data:text/javascript;base64,${Buffer.from(source, "utf8").toString("base64")}`;
        const plugin = pluginFromModule((await import(url)) as Record<string, unknown>, ref);
        const core = trackedCorePluginApi();
        try {
          await plugin.register({ environment: "node", z: pluginZod, core: core.api });
        } catch (error) {
          unregisterPluginKinds(core.registrations);
          throw error;
        }
        this.loaded.set(ref.name, { key: keyOf(ref), registrations: core.registrations });
      } catch (error) {
        problems.push(`plugin "${ref.name}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return problems;
  }

  dispose(): void {
    for (const loaded of this.loaded.values()) unregisterPluginKinds(loaded.registrations);
    this.loaded.clear();
  }
}

const keyOf = (ref: PluginRef): string => `${ref.url}#${ref.integrity ?? ""}#${ref.version}`;
