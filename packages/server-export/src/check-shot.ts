import { scriptedFrameDocument, registerStageKit, requestedLibraries, substituteParams } from "@miraiclip/renderer";
import type { HtmlClip } from "@miraiclip/core";
import { launchBrowser } from "./browser.js";
import type { BrowserOptions, ProjectDocument } from "./types.js";

export interface ShotFinding {
  rule: string;
  severity: "warning";
  /** Seconds into the sequence, or null for whole-sequence findings. */
  t: number | null;
  message: string;
  hint: string;
}

export interface ShotBoundary {
  label: string;
  t: number;
  kind: "carried" | "anchored" | "bare" | "exempt";
  survivor: string | null;
  note: string;
  gone?: string | null;
  came?: string | null;
  hint?: string;
}

export interface ShotReport {
  version: 1 | 2;
  /** The sound moments declared with `tl.hit` (and added by carries, presses, impacts, shakes), in time order. */
  events: { name: string; t: number; kind: string; pan: number }[];
  duration: number;
  labels: Record<string, number>;
  /** (carried + anchored/2) / scored boundaries, or null when nothing was scored. */
  score: number | null;
  carried: number;
  anchored: number;
  bare: number;
  exempt: number;
  boundaries: ShotBoundary[];
  coverage: { labels: number; boundaries: number; enough: boolean };
  framing: { subject: string; from: number; to: number; kind: string }[];
  rhythm: { shots: number[]; cv: number; restShare: number; rests: number; bursts: number; hardCuts: number; cutsOutsideBursts: number[] };
  findings: ShotFinding[];
}

export interface ClipShotReport {
  clipId: string;
  /** Start of the clip on the composition timeline, in seconds. */
  startSec: number;
  report: ShotReport | null;
  /** Why no report: not a stage sequence, or the sequence failed to build. */
  skipped?: string;
}

export interface CheckShotResult {
  clips: ClipShotReport[];
  /** Across clips: bare joins between consecutive sequence clips on one track. */
  across: ShotFinding[];
  findings: ShotFinding[];
}

export interface CheckShotOptions {
  /** Check only this clip. */
  clipId?: string;
  browser?: BrowserOptions;
  /** Half-width of the window around each label, in seconds (default 0.2). */
  window?: number;
}

const US = 1_000_000;

/**
 * Check how a continuous shot holds together. Loads each stage sequence (version 1 or 2) in headless Chromium,
 * seeks it around every label and reports what survives each beat, whether subjects leave the frame,
 * and how the beats are paced. Nothing is rendered or exported; warnings never block an export.
 */
export async function checkShot(doc: ProjectDocument, options: CheckShotOptions = {}): Promise<CheckShotResult> {
  registerStageKit();
  const compW = doc.settings.width;
  const compH = doc.settings.height;
  const clips = Object.entries(doc.clips as Record<string, unknown>)
    .map(([id, c]) => ({ id, clip: c as HtmlClip & { startUs?: number; start?: number; trackId?: string } }))
    .filter(({ id, clip }) => clip.kind === "html" && (!options.clipId || id === options.clipId))
    .sort((a, b) => (startOf(a.clip) - startOf(b.clip)));
  const out: ClipShotReport[] = [];
  const browser = await launchBrowser(options.browser);
  try {
    for (const { id, clip } of clips) {
      const markup = substituteParams(clip.template, clip.params ?? {});
      const startSec = startOf(clip) / US;
      if (!requestedLibraries(markup).includes("stage")) {
        out.push({ clipId: id, startSec, report: null, skipped: "not a stage sequence" });
        continue;
      }
      const w = clip.widthPx ?? compW;
      const h = clip.heightPx ?? compH;
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      try {
        await page.setContent(scriptedFrameDocument(markup, w, h), { waitUntil: "load" });
        const result = await page.evaluate(async (win) => {
          const g = window as unknown as { __miraiclipReady?: Promise<void>; __miraiclipProbe?: (o: object) => { report: unknown } };
          if (g.__miraiclipReady) await g.__miraiclipReady;
          const stage = document.querySelector(".stage");
          const error = stage?.getAttribute("data-stage-error") ?? null;
          if (error) return { error };
          if (!g.__miraiclipProbe) return { error: "the stage kit did not start" };
          return { report: g.__miraiclipProbe({ window: win }).report };
        }, options.window ?? 0.2);
        if ("error" in result && result.error) out.push({ clipId: id, startSec, report: null, skipped: `the sequence failed to build: ${result.error}` });
        else out.push({ clipId: id, startSec, report: (result as { report: ShotReport }).report });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  const across = acrossClips(out);
  const findings = [...out.flatMap((c) => c.report?.findings.map((f) => ({ ...f, t: f.t === null ? null : f.t + c.startSec })) ?? []), ...across];
  return { clips: out, across, findings };
}

function startOf(clip: { startUs?: number; start?: number }): number {
  return clip.startUs ?? clip.start ?? 0;
}

/** Consecutive sequence clips join with a hard cut unless a carry runs across the join; flag every join. */
function acrossClips(clips: ClipShotReport[]): ShotFinding[] {
  const seqs = clips.filter((c) => c.report).sort((a, b) => a.startSec - b.startSec);
  const found: ShotFinding[] = [];
  for (let i = 1; i < seqs.length; i++) {
    const prev = seqs[i - 1]!;
    const gap = seqs[i]!.startSec - (prev.startSec + prev.report!.duration);
    if (Math.abs(gap) < 0.05) {
      found.push({
        rule: "act-join",
        severity: "warning",
        t: round(seqs[i]!.startSec),
        message: `clip ${prev.clipId} hands over to clip ${seqs[i]!.clipId} with a hard cut`,
        hint: "end the first clip on an element the next one starts from, or join them with a carry transition",
      });
    }
  }
  return found;
}

const round = (x: number) => Math.round(x * 1000) / 1000;
