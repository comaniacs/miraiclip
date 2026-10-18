/**
 * Click ripples: a short expanding ring at every click, placed where the
 * click lands on the canvas (zooms included).
 */
import type { ProjectDocument } from "@miraiclip/core";
import type { CaptureSession } from "@miraiclip/capture";
import { blockCommands, getBuiltinBlock } from "@miraiclip/registry";
import { framePointToCanvas, rectToFrame, round, screenClip, sessionToClipUs, type Command } from "./map.js";

export interface PlanClickEffectsOptions {
  clipId: string;
  /** Track for the ripples (default "clicks"). */
  trackId?: string;
  createTrack?: boolean;
  /** Ripple colour (default the block's sky blue). */
  color?: string;
  /** Ripple length (default 0.6 s; shortened when clicks come faster). */
  durationUs?: number;
  /** Ripple size multiplier (default 1). */
  size?: number;
  /** Id prefix (default "click"). */
  idPrefix?: string;
  /** Also mark right-clicks (default false). */
  includeContextMenu?: boolean;
}

export function planClickEffects(doc: ProjectDocument, session: CaptureSession, options: PlanClickEffectsOptions): Command[] {
  const clip = screenClip(doc, options.clipId);
  const trackId = options.trackId ?? "clicks";
  const length = options.durationUs ?? 600_000;
  const block = getBuiltinBlock("cursor-click")!;
  const composition = { width: doc.settings.width, height: doc.settings.height };
  const clicks: { tUs: number; x: number; y: number }[] = [];
  for (const e of session.events) {
    if (!(e.type === "click" || e.type === "dblclick" || (options.includeContextMenu && e.type === "contextmenu"))) continue;
    const local = sessionToClipUs(clip, session, e.tUs);
    if (local === undefined || local >= clip.durationUs) continue;
    const r = rectToFrame(session, { x: e.x, y: e.y, width: 0, height: 0 });
    clicks.push({ tUs: local, x: r.x, y: r.y });
  }
  clicks.sort((a, b) => a.tUs - b.tUs);
  const commands: Command[] = [];
  let createTrack = options.createTrack ?? !doc.tracks[trackId];
  let n = 0;
  clicks.forEach((c, i) => {
    const next = clicks[i + 1];
    // Ripples on one track can't overlap: a fast second click cuts the first one short.
    const durationUs = Math.min(length, clip.durationUs - c.tUs, next ? next.tUs - c.tUs : Infinity);
    if (durationUs < 120_000) return;
    const id = `${options.idPrefix ?? "click"}-${++n}`;
    const p0 = framePointToCanvas(doc, clip, c.tUs, c.x, c.y);
    commands.push(
      ...blockCommands(block, {
        id,
        trackId,
        createTrack,
        startUs: clip.startUs + c.tUs,
        durationUs,
        composition,
        ...(options.color ? { values: { color: options.color } } : {}),
        transform: { x: round(p0.x), y: round(p0.y), scale: options.size ?? 1 },
      }),
    );
    createTrack = false;
    // Follow a zoom that is still moving during the ripple.
    const p1 = framePointToCanvas(doc, clip, c.tUs + durationUs, c.x, c.y);
    if (Math.hypot(p1.x - p0.x, p1.y - p0.y) > 1e-4) {
      for (const [timeUs, p] of [[0, p0], [durationUs, p1]] as const) {
        commands.push({ type: "keyframe/set", payload: { clipId: id, property: "x", timeUs, value: round(p.x), easing: "linear" } });
        commands.push({ type: "keyframe/set", payload: { clipId: id, property: "y", timeUs, value: round(p.y), easing: "linear" } });
      }
    }
  });
  return commands;
}
