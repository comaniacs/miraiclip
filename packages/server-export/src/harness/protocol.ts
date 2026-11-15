/**
 * The window-level contract between the Node side (drives the page via
 * Playwright) and the harness bundle (runs in the page). Type-only — both
 * sides import it so the two halves cannot drift.
 */
import type { StillText } from "@miraiclip/renderer";
/** Plugins prepared on the Node side: refs keyed by content hash, plus their sources. */
export interface HarnessPlugins {
  refs: { name: string; version: string; url: string; integrity?: string }[];
  sources: Record<string, string>;
}

export interface HarnessExportOptions {
  /** The document's plugins, already gated and read by the Node side. */
  plugins?: HarnessPlugins;
  format: "mp4" | "webm";
  quality?: "draft" | "standard" | "high" | { videoBitrate: number };
  fps?: number;
  width?: number;
  height?: number;
  range?: { startUs: number; endUs: number };
  /**
   * Stream encoded chunks to the harness server's /__output route instead of
   * returning one base64 blob: __miraiExport then resolves with "" and the
   * Node side owns the bytes. Keeps peak memory flat for long outputs.
   */
  stream?: boolean;
  /** Audio mix chunk length in seconds (renderer default: 60). */
  audioChunkSeconds?: number;
  /** Shutter motion blur (see `ExportProjectOptions.motionBlur`). */
  motionBlur?: { shutterAngle?: number; minSamples?: number; maxSamples?: number; gapPx?: number };
}

export interface HarnessStillOptions {
  plugins?: HarnessPlugins;
  /** Composition time to render, in microseconds. */
  timeUs: number;
  /** Output size (default: the project's composition size). */
  width?: number;
  height?: number;
  /** Leave these clips out of the picture (the text a vector PDF lays over it). */
  omitClipIds?: string[];
}

export interface HarnessDescribeOptions {
  plugins?: HarnessPlugins;
  timeUs: number;
  width?: number;
  height?: number;
}

/** What `describeStillText` returns: every visible text clip, laid out for real text. */
export interface HarnessStillText {
  width: number;
  height: number;
  texts: StillText[];
}

export interface HarnessProgress {
  phase: "audio" | "video" | "finalizing";
  framesDone: number;
  totalFrames: number;
  audioMixedUs?: number;
  audioTotalUs?: number;
}

declare global {
  interface Window {
    /** Set by the Node side via exposeFunction BEFORE the export starts. */
    __miraiProgress?: (progress: HarnessProgress) => void;
    __miraiExport: (doc: unknown, options: HarnessExportOptions) => Promise<string>;
    /** Render one composition frame; resolves with the PNG as base64. */
    __miraiRenderStill: (doc: unknown, options: HarnessStillOptions) => Promise<string>;
    /** Lay out the frame's text as the canvas does, for real text over a still. */
    __miraiDescribeStillText: (doc: unknown, options: HarnessDescribeOptions) => Promise<HarnessStillText>;
    __miraiAbort: () => void;
  }
}
