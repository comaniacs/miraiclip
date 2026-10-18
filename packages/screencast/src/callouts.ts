/**
 * Step callouts: a tooltip beside what was clicked ("Click “Save”"), using
 * the label the capture log recorded for it. Sensitive targets and clicks on
 * unlabelled elements are skipped.
 */
import type { ProjectDocument } from "@miraiclip/core";
import type { CaptureSession, CaptureTarget } from "@miraiclip/capture";
import { blockCommands, getBuiltinBlock, referenceScale } from "@miraiclip/registry";
import { clamp, framePointToCanvas, rectToFrame, round, screenClip, sessionToClipUs, type Command } from "./map.js";

export interface PlanCalloutsOptions {
  clipId: string;
  /** Track for the callouts (default "callouts"). */
  trackId?: string;
  createTrack?: boolean;
  /** Callout text for a click (default `Click “<label>”`). Return undefined to skip that click. */
  text?: (target: CaptureTarget, index: number) => string | undefined;
  /** How long each callout stays (default 2.2 s; shortened so callouts never overlap). */
  durationUs?: number;
  /** Skip clicks closer than this to the previous callout (default 1.2 s). */
  minGapUs?: number;
  /** Size multiplier (default 0.8). */
  size?: number;
  /** Id prefix (default "callout"). */
  idPrefix?: string;
}

const TOOLTIP = { widthPx: 640, heightPx: 140, arrowInsetPx: 30 };

export function planCallouts(doc: ProjectDocument, session: CaptureSession, options: PlanCalloutsOptions): Command[] {
  const clip = screenClip(doc, options.clipId);
  const block = getBuiltinBlock("callout-tooltip")!;
  const trackId = options.trackId ?? "callouts";
  const length = options.durationUs ?? 2_200_000;
  const minGap = options.minGapUs ?? 1_200_000;
  const size = options.size ?? 0.8;
  const composition = { width: doc.settings.width, height: doc.settings.height };
  const scale = referenceScale(composition) * size;
  const text = options.text ?? ((t) => (t.label ? `Click “${t.label}”` : undefined));

  const picks: { tUs: number; target: CaptureTarget; text: string }[] = [];
  let index = 0;
  for (const e of session.events) {
    if (e.type !== "click" || !e.target || e.target.sensitive) continue;
    const local = sessionToClipUs(clip, session, e.tUs);
    if (local === undefined || local >= clip.durationUs) continue;
    const last = picks[picks.length - 1];
    if (last && local - last.tUs < minGap) continue;
    const label = text(e.target, index++);
    if (label) picks.push({ tUs: local, target: e.target, text: label });
  }

  const commands: Command[] = [];
  let createTrack = options.createTrack ?? !doc.tracks[trackId];
  picks.forEach((pick, i) => {
    const next = picks[i + 1];
    const durationUs = Math.min(length, clip.durationUs - pick.tUs, next ? next.tUs - pick.tUs : Infinity);
    if (durationUs < 300_000) return;
    // Settle where the target is a moment in (after any zoom has landed).
    const at = Math.min(pick.tUs + 300_000, clip.durationUs);
    const box = rectToFrame(session, pick.target.rect);
    const left = framePointToCanvas(doc, clip, at, box.x, box.y + box.height / 2);
    const right = framePointToCanvas(doc, clip, at, box.x + box.width, box.y + box.height / 2);
    const w = (TOOLTIP.widthPx * scale) / composition.width;
    const h = (TOOLTIP.heightPx * scale) / composition.height;
    const inset = (TOOLTIP.arrowInsetPx * scale) / composition.width;
    // The tooltip goes on the roomier side; its arrow points back at the target.
    const onRight = right.x < 1 - left.x;
    const x = onRight ? right.x + w / 2 - inset + 0.01 : left.x - w / 2 + inset - 0.01;
    const y = left.y;
    commands.push(
      ...blockCommands(block, {
        id: `${options.idPrefix ?? "callout"}-${i + 1}`,
        trackId,
        createTrack,
        startUs: clip.startUs + pick.tUs,
        durationUs,
        composition,
        values: { text: pick.text, side: onRight ? "left" : "right" },
        transform: { x: round(clamp(x, w / 2, 1 - w / 2)), y: round(clamp(y, h / 2, 1 - h / 2)), scale: size },
      }),
    );
    createTrack = false;
  });
  return commands;
}
