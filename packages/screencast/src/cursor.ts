/**
 * A clean cursor: the recorded pointer path, smoothed, simplified and drawn
 * as an html cursor clip whose x / y keyframes follow the screen clip's
 * zooms. Record with `cursor: "never"` so the system cursor isn't baked into
 * the video as well.
 */
import type { ProjectDocument, VideoClip } from "@miraiclip/core";
import type { CaptureSession } from "@miraiclip/capture";
import { blockCommands, getBuiltinBlock, referenceScale } from "@miraiclip/registry";
import { framePointToCanvas, rectToFrame, round, screenClip, sessionToClipUs, sessionToClipUsUnclamped, zoomAt, type Command } from "./map.js";

/** How the drawn cursor looks; each is a registry block with its hot spot at the block's centre. */
export type CursorStyle = "arrow" | "highlight" | "hand" | "halo" | "dot" | "ring";

/**
 * `pointer`: the style draws a pointer of its own (use it when the real one
 * isn't in the video). The others only mark the spot, so they also work as a
 * highlight around a real pointer that is in the video; they follow it
 * exactly (no smoothing) by default.
 */
export const CURSOR_STYLES: Record<CursorStyle, { block: string; label: string; pointer: boolean }> = {
  arrow: { block: "cursor-arrow", label: "Arrow", pointer: true },
  highlight: { block: "cursor-highlight", label: "Arrow with highlight", pointer: true },
  hand: { block: "cursor-hand", label: "Hand", pointer: true },
  halo: { block: "cursor-halo", label: "Halo", pointer: false },
  dot: { block: "cursor-dot", label: "Dot", pointer: false },
  ring: { block: "cursor-ring", label: "Ring", pointer: false },
};

export interface PlanCursorOptions {
  /** The screen recording's clip (already zoomed, if you plan zooms: plan those first). */
  clipId: string;
  /** Track for the cursor clip (default "cursor"). */
  trackId?: string;
  /** Add the track first (default true when it doesn't exist). */
  createTrack?: boolean;
  /** Cursor clip id (default "cursor"). */
  id?: string;
  /** How it looks (default "arrow"). */
  style?: CursorStyle;
  /** Arrow and hand colours. */
  fill?: string;
  stroke?: string;
  /** The highlight circle's colour ("highlight"), or the dot's or ring's. */
  highlight?: string;
  /** Cursor size multiplier (default 1). */
  size?: number;
  /** Grow the cursor with the zoom, by this share of it (0 = constant size; default 0.5). */
  zoomFollow?: number;
  /** Smoothing window (default 120 ms; 0 keeps the raw path). */
  smoothingUs?: number;
  /** Path simplification tolerance as a fraction of the frame (default 0.002). */
  tolerance?: number;
}

interface Sample {
  tUs: number;
  x: number;
  y: number;
  pin?: boolean;
}

/** Ramer–Douglas–Peucker over time-parametrised points; pinned samples always stay. */
function simplify(points: Sample[], tolerance: number): Sample[] {
  if (points.length <= 2) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  points.forEach((p, i) => {
    if (p.pin) keep[i] = true;
  });
  const stack: [number, number][] = [];
  // Split at pins first so segments never straddle a pinned sample.
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (keep[i]) {
      stack.push([start, i]);
      start = i;
    }
  }
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const pa = points[a]!;
    const pb = points[b]!;
    let worst = -1;
    let worstAt = -1;
    for (let i = a + 1; i < b; i++) {
      const p = points[i]!;
      // Where the straight line from a to b would be at p's time.
      const f = pb.tUs === pa.tUs ? 0 : (p.tUs - pa.tUs) / (pb.tUs - pa.tUs);
      const d = Math.hypot(p.x - (pa.x + (pb.x - pa.x) * f), p.y - (pa.y + (pb.y - pa.y) * f));
      if (d > worst) {
        worst = d;
        worstAt = i;
      }
    }
    if (worst > tolerance) {
      keep[worstAt] = true;
      stack.push([a, worstAt], [worstAt, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** The pointer path in the clip's frame (fractions), smoothed. Clicks are pinned exactly. */
export function cursorPath(doc: ProjectDocument, session: CaptureSession, options: Pick<PlanCursorOptions, "clipId" | "smoothingUs">): Sample[] {
  const clip = screenClip(doc, options.clipId);
  const raw: Sample[] = [];
  for (const e of session.events) {
    if (e.type !== "move" && e.type !== "click" && e.type !== "dblclick" && e.type !== "contextmenu") continue;
    const local = sessionToClipUs(clip, session, e.tUs);
    if (local === undefined) continue;
    const r = rectToFrame(session, { x: e.x, y: e.y, width: 0, height: 0 });
    raw.push({ tUs: local, x: r.x, y: r.y, ...(e.type !== "move" ? { pin: true } : {}) });
  }
  raw.sort((a, b) => a.tUs - b.tUs);
  const window = options.smoothingUs ?? 120_000;
  if (window <= 0) return raw;
  // A centred moving average; clicks keep their exact spot (the cursor must land on the button).
  return raw.map((p, i) => {
    if (p.pin) return p;
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let j = i; j >= 0 && p.tUs - raw[j]!.tUs <= window / 2; j--) {
      sx += raw[j]!.x;
      sy += raw[j]!.y;
      n++;
    }
    for (let j = i + 1; j < raw.length && raw[j]!.tUs - p.tUs <= window / 2; j++) {
      sx += raw[j]!.x;
      sy += raw[j]!.y;
      n++;
    }
    return { tUs: p.tUs, x: sx / n, y: sy / n };
  });
}

/**
 * Stretches (clip-local µs) when the pointer was outside the logged page(s):
 * from each "leave" to the next pointer event (open-ended when there is none).
 */
export function pointerGaps(session: CaptureSession, clip: VideoClip): { from: number; to?: number }[] {
  const gaps: { from: number; to?: number }[] = [];
  let open: number | undefined;
  for (const e of session.events) {
    if (e.type === "leave") {
      if (open === undefined) open = e.tUs;
    } else if (open !== undefined && (e.type === "move" || e.type === "click" || e.type === "dblclick" || e.type === "contextmenu")) {
      const from = sessionToClipUsUnclamped(clip, session, open);
      const to = sessionToClipUsUnclamped(clip, session, e.tUs);
      if (from !== undefined && to !== undefined && to > 0 && from < clip.durationUs) gaps.push({ from: Math.max(0, from), to });
      open = undefined;
    }
  }
  if (open !== undefined) {
    const from = sessionToClipUsUnclamped(clip, session, open);
    if (from !== undefined && from < clip.durationUs) gaps.push({ from: Math.max(0, from) });
  }
  return gaps;
}

/** Commands that add a cursor clip over the screen clip, following the recorded pointer. */
export function planCursor(doc: ProjectDocument, session: CaptureSession, options: PlanCursorOptions): Command[] {
  const clip = screenClip(doc, options.clipId);
  const style = CURSOR_STYLES[options.style ?? "arrow"];
  // A highlight over a real pointer must sit exactly on it: no smoothing, tight simplification.
  const exact = !style.pointer;
  const smoothingUs = options.smoothingUs ?? (exact ? 0 : 120_000);
  const path = simplify(cursorPath(doc, session, { clipId: options.clipId, smoothingUs }), options.tolerance ?? (exact ? 0.0005 : 0.002));
  if (path.length === 0) return [];
  const trackId = options.trackId ?? "cursor";
  const id = options.id ?? "cursor";
  const block = getBuiltinBlock(style.block)!;
  const accepts = (key: string) => block.fields.some((f) => f.key === key);
  const composition = { width: doc.settings.width, height: doc.settings.height };
  const baseScale = referenceScale(composition) * (options.size ?? 1);
  const follow = options.zoomFollow ?? 0.5;
  const first = path[0]!;
  const start = framePointToCanvas(doc, clip, first.tUs, first.x, first.y);
  const commands: Command[] = blockCommands(block, {
    id,
    trackId,
    createTrack: options.createTrack ?? !doc.tracks[trackId],
    startUs: clip.startUs,
    durationUs: clip.durationUs,
    composition,
    values: {
      ...(options.fill && accepts("fill") ? { fill: options.fill } : {}),
      ...(options.stroke && accepts("stroke") ? { stroke: options.stroke } : {}),
      ...(options.highlight && accepts("highlight") ? { highlight: options.highlight } : {}),
    },
    transform: { x: round(start.x), y: round(start.y), scale: options.size ?? 1 },
  });

  // Key the canvas position at each path point, and wherever the zoom changes in between,
  // so the cursor stays glued to the recording while it pans and zooms.
  const zoomKeys = new Set<number>();
  for (const prop of ["x", "y", "scale"] as const) for (const k of clip.animations?.[prop] ?? []) if (!k.anchor) zoomKeys.add(k.timeUs);
  const times = new Map<number, Sample>();
  for (const p of path) times.set(p.tUs, p);
  const at = (tUs: number): Sample => {
    // Linear interpolation on the simplified path (what the keyframes will do anyway).
    let i = path.findIndex((p) => p.tUs >= tUs);
    if (i === -1) return { ...path[path.length - 1]!, tUs };
    if (i === 0) return { ...path[0]!, tUs };
    const a = path[i - 1]!;
    const b = path[i]!;
    const f = (tUs - a.tUs) / (b.tUs - a.tUs);
    return { tUs, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  };
  // Inside a zoom ramp the mapping changes continuously: sample it at 10 per second.
  const zoomTimes = [...zoomKeys].sort((a, b) => a - b);
  for (let k = 0; k + 1 < zoomTimes.length; k++) {
    const a = zoomTimes[k]!;
    const b = zoomTimes[k + 1]!;
    for (let t = a; t <= b; t += 100_000) if (!times.has(t)) times.set(Math.round(t), at(t));
    if (!times.has(b)) times.set(b, at(b));
  }
  const keys = [...times.values()].filter((s) => s.tUs >= 0 && s.tUs <= clip.durationUs).sort((a, b) => a.tUs - b.tUs);
  for (const s of keys) {
    const p = framePointToCanvas(doc, clip, s.tUs, s.x, s.y);
    commands.push({ type: "keyframe/set", payload: { clipId: id, property: "x", timeUs: s.tUs, value: round(p.x), easing: "linear" } });
    commands.push({ type: "keyframe/set", payload: { clipId: id, property: "y", timeUs: s.tUs, value: round(p.y), easing: "linear" } });
  }
  // Hide the cursor while the pointer is outside the logged page(s) (another app, the
  // browser's toolbars): fade out where it left, back in where it next moves.
  const gaps = pointerGaps(session, clip);
  if (gaps.length) {
    const FADE = 150_000;
    const keys = new Map<number, number>([[0, 1]]);
    for (const g of gaps) {
      keys.set(Math.max(0, g.from), 1);
      keys.set(Math.min(clip.durationUs, g.from + FADE), 0);
      if (g.to !== undefined && g.to < clip.durationUs) {
        keys.set(Math.max(g.from + FADE, g.to), 0);
        keys.set(Math.min(clip.durationUs, Math.max(g.from + FADE, g.to) + FADE), 1);
      }
    }
    for (const [timeUs, value] of [...keys].sort((x, y) => x[0] - y[0])) {
      commands.push({ type: "keyframe/set", payload: { clipId: id, property: "opacity", timeUs, value, easing: "linear" } });
    }
  }
  if (follow > 0 && zoomTimes.length) {
    for (const t of zoomTimes) {
      if (t > clip.durationUs) continue;
      const scale = baseScale * (1 + (zoomAt(clip, t) - 1) * follow);
      commands.push({ type: "keyframe/set", payload: { clipId: id, property: "scale", timeUs: t, value: round(scale), easing: "easeInOut" } });
    }
  }
  return commands;
}
