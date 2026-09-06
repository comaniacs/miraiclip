/**
 * The window-level contract between the Node side (drives the page via
 * Playwright) and the harness bundle (runs in the page). Type-only — both
 * sides import it so the two halves cannot drift.
 */
export interface HarnessExportOptions {
  format: "mp4" | "webm";
  quality?: "draft" | "standard" | "high" | { videoBitrate: number };
  fps?: number;
  width?: number;
  height?: number;
  range?: { startUs: number; endUs: number };
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
    __miraiAbort: () => void;
  }
}
