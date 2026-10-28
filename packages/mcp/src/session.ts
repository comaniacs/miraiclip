import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createProject, type Project, type ProjectDocument } from "@miraiclip/core";
import {
  checkShot,
  type CheckShotResult,
  createRenderSession,
  exportProjectFile,
  type BrowserOptions,
  type ExportProjectFileResult,
  type RenderSession,
  type ServerPluginOptions,
} from "@miraiclip/server-export";
import { NodePluginHost } from "./plugins.js";

export interface ProjectSessionOptions {
  /** The project JSON file this session edits. Created if missing. */
  projectPath: string;
  /**
   * Base directory for resolving relative asset `src` paths for previews and
   * exports (default: the project file's directory).
   */
  assetsDir?: string;
  /** Composition settings for a NEW project file (default 1920×1080 @ 30). */
  defaults?: { width: number; height: number; fps: number };
  /** Browser options for previews and exports (executablePath etc.). */
  browser?: BrowserOptions;
  /**
   * Run the document's `doc.plugins` (custom kinds) — in Node for command
   * validation, and in the preview/export page. Off by default.
   */
  plugins?: ServerPluginOptions;
}

export interface SessionExportOptions {
  /** Output file path; relative paths resolve against the project directory. */
  out: string;
  format: "mp4" | "webm";
  quality?: "draft" | "standard" | "high";
  fps?: number;
  width?: number;
  height?: number;
  range?: { startUs: number; endUs: number };
  /** Shutter motion blur for finals (`{}` = defaults: 180° shutter, 4 to 32 samples). Slower to render. */
  motionBlur?: { shutterAngle?: number; minSamples?: number; maxSamples?: number; gapPx?: number };
}

/**
 * One project, on disk, being edited over MCP: the document loads from (or is
 * created at) `projectPath`, every successful edit autosaves back atomically,
 * and previews render through one warm headless Chrome kept alive across
 * calls. The undo/redo history lives for the lifetime of the server process.
 */
export class ProjectSession {
  readonly project: Project;
  readonly projectPath: string;
  readonly assetsDir: string;
  private readonly browser: BrowserOptions | undefined;
  private readonly pluginOptions: ServerPluginOptions | undefined;
  private readonly pluginHost: NodePluginHost;
  /** Problems from the last plugin sync (refused, unreadable, failed integrity). */
  pluginProblems: string[] = [];
  private renderer: RenderSession | undefined;
  private rendererStarting: Promise<RenderSession> | undefined;

  private constructor(project: Project, options: ProjectSessionOptions) {
    this.project = project;
    this.projectPath = path.resolve(options.projectPath);
    this.assetsDir = options.assetsDir
      ? path.resolve(options.assetsDir)
      : path.dirname(this.projectPath);
    this.browser = options.browser;
    this.pluginOptions = options.plugins;
    this.pluginHost = new NodePluginHost(options.plugins, this.assetsDir);
  }

  static async open(options: ProjectSessionOptions): Promise<ProjectSession> {
    const projectPath = path.resolve(options.projectPath);
    let project: Project;
    if (existsSync(projectPath)) {
      const doc = JSON.parse(await readFile(projectPath, "utf8")) as ProjectDocument;
      project = createProject(doc);
    } else {
      project = createProject(options.defaults ?? { width: 1920, height: 1080, fps: 30 });
    }
    const session = new ProjectSession(project, options);
    await session.syncPlugins();
    if (!existsSync(projectPath)) await session.save();
    return session;
  }

  /** Load/unload plugin kinds to match the document's manifest; returns any problems. */
  async syncPlugins(): Promise<string[]> {
    this.pluginProblems = await this.pluginHost.sync(this.project.getState().doc);
    return this.pluginProblems;
  }

  /** Atomic write: tmp + rename, so a crash never leaves a half project file. */
  async save(): Promise<void> {
    await this.syncPlugins();
    await mkdir(path.dirname(this.projectPath), { recursive: true });
    const tmpPath = `${this.projectPath}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(this.project.toJSON(), null, 2)}\n`, "utf8");
    await rename(tmpPath, this.projectPath);
  }

  /** Render one frame as PNG through the warm render session (started lazily). */
  async preview(options: { timeUs: number; width?: number; height?: number }): Promise<Uint8Array> {
    const renderer = await this.acquireRenderer();
    try {
      return await renderer.renderStill(this.project.toJSON(), options);
    } catch (error) {
      // A dead browser (crashed, host slept) is recoverable: restart once.
      await this.disposeRenderer();
      if (error instanceof Error && /closed|crashed|disconnected/i.test(error.message)) {
        const restarted = await this.acquireRenderer();
        return await restarted.renderStill(this.project.toJSON(), options);
      }
      throw error;
    }
  }

  /** How the project's stage sequences hold together as one continuous shot (nothing is rendered or written). */
  async checkSequence(options: { clipId?: string } = {}): Promise<CheckShotResult> {
    return await checkShot(this.project.toJSON(), {
      ...(options.clipId !== undefined ? { clipId: options.clipId } : {}),
      ...(this.browser !== undefined ? { browser: this.browser } : {}),
    });
  }

  async export(options: SessionExportOptions): Promise<ExportProjectFileResult> {
    const out = path.resolve(path.dirname(this.projectPath), options.out);
    return await exportProjectFile(this.project.toJSON(), {
      format: options.format,
      out,
      assetsDir: this.assetsDir,
      ...(options.quality !== undefined ? { quality: options.quality } : {}),
      ...(options.fps !== undefined ? { fps: options.fps } : {}),
      ...(options.width !== undefined ? { width: options.width } : {}),
      ...(options.height !== undefined ? { height: options.height } : {}),
      ...(options.range !== undefined ? { range: options.range } : {}),
      ...(options.motionBlur !== undefined ? { motionBlur: options.motionBlur } : {}),
      ...(this.browser !== undefined ? { browser: this.browser } : {}),
      ...(this.pluginOptions !== undefined ? { plugins: this.pluginOptions } : {}),
    });
  }

  private acquireRenderer(): Promise<RenderSession> {
    if (this.renderer) return Promise.resolve(this.renderer);
    this.rendererStarting ??= createRenderSession({
      assetsDir: this.assetsDir,
      ...(this.browser !== undefined ? { browser: this.browser } : {}),
      ...(this.pluginOptions !== undefined ? { plugins: this.pluginOptions } : {}),
    }).then(
      (renderer) => {
        this.renderer = renderer;
        this.rendererStarting = undefined;
        return renderer;
      },
      (error: unknown) => {
        this.rendererStarting = undefined;
        throw error;
      },
    );
    return this.rendererStarting;
  }

  private async disposeRenderer(): Promise<void> {
    const renderer = this.renderer;
    this.renderer = undefined;
    this.rendererStarting = undefined;
    await renderer?.close().catch(() => undefined);
  }

  async close(): Promise<void> {
    this.pluginHost.dispose();
    await this.disposeRenderer();
  }
}
