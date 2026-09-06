import type { ProjectDocument } from "@miraiclip/core";

/** Mirrors the renderer's ExportProgress — re-declared so the Node side has no runtime dependency on the renderer. */
export interface ServerExportProgress {
  phase: "audio" | "video" | "finalizing";
  framesDone: number;
  totalFrames: number;
  audioMixedUs?: number;
  audioTotalUs?: number;
}

export interface BrowserOptions {
  /**
   * Path to a Chrome/Chromium executable. Highest priority. Any distribution
   * works — system Chrome, Chrome for Testing, Playwright's Chromium — but
   * only real Chrome builds carry the proprietary H.264/AAC encoders MP4
   * export needs; free Chromium is WebM-only.
   */
  executablePath?: string;
  /** Extra Chrome flags, appended after the defaults. */
  args?: string[];
  /**
   * Render WebGL on SwiftShader (software GL). Defaults to true on Linux —
   * servers rarely have a GPU, and Chrome's default ANGLE stalls on
   * GPU-less readback — and false elsewhere.
   */
  swiftshader?: boolean;
}

export interface ExportProjectFileOptions {
  format: "mp4" | "webm";
  quality?: "draft" | "standard" | "high" | { videoBitrate: number };
  /** Output frame rate (default: the project's fps). */
  fps?: number;
  /** Output size (default: the project's composition size). */
  width?: number;
  height?: number;
  /** Composition range in µs (default: the whole composition). */
  range?: { startUs: number; endUs: number };
  /**
   * Where each asset's media lives on THIS machine: asset id → local file
   * path. Assets whose `src` is already an http(s) or data URL are fetched
   * as-is and need no entry; every other asset must either have an entry
   * here or a `src` that resolves to a file under `assetsDir`.
   */
  assets?: Record<string, string>;
  /** Base directory for resolving relative asset `src` paths (default: cwd). */
  assetsDir?: string;
  /** Write the encoded file here (created/overwritten). Omit to only get bytes back. */
  out?: string;
  signal?: AbortSignal;
  onProgress?: (progress: ServerExportProgress) => void;
  browser?: BrowserOptions;
}

export interface ExportProjectFileResult {
  bytes: Uint8Array;
  /** Set when `out` was given: the absolute path written. */
  filePath?: string;
}

/** Thrown when the export is cancelled via the AbortSignal. */
export class ServerExportAbortedError extends Error {
  constructor() {
    super("export aborted");
    this.name = "ServerExportAbortedError";
  }
}

export type { ProjectDocument };
