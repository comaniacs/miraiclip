/**
 * Auto-zoom: push in on where the action is (clicks, typing), hold while the
 * viewer reads it, ease back out. Every zoom is plain transform keyframes on
 * the screen clip, so it previews, exports and undoes like a hand-made one.
 */
import type { ProjectDocument } from "@miraiclip/core";
import type { CaptureEvent, CaptureSession } from "@miraiclip/capture";
import { clamp, frameExtent, rectToFrame, round, screenClip, sessionToClipUs, type Command } from "./map.js";

export interface PlanZoomsOptions {
  /** The screen recording's clip. */
  clipId: string;
  /** How far to zoom in, relative to the clip's resting scale (default 1.8). */
  scale?: number;
  /** Which events attract a zoom (default clicks, double-clicks and typing). */
  events?: CaptureEvent["type"][];
  /** The zoom is fully in this long before the first event (default 0.3 s). */
  leadUs?: number;
  /** Stay zoomed this long after the last event of a group (default 1.6 s). */
  holdUs?: number;
  /** Length of each zoom in or out (default 0.6 s). */
  rampUs?: number;
  /** Events closer than this share one zoom (default 2 s). */
  mergeGapUs?: number;
  /** Keep the group's points inside this fraction of the frame when zoomed (default 0.75). */
  fitFraction?: number;
  /** Skip zooms that would be weaker than this (default 1.15). */
  minScale?: number;
  /** Clear the clip's existing x / y / scale keyframes first (default true). */
  replace?: boolean;
}

export interface ZoomSegment {
  /** Clip-relative times: ramp in, fully in, start ramping out, fully out. */
  inStartUs: number;
  inEndUs: number;
  outStartUs: number;
  outEndUs: number;
  /** Zoom factor (relative to the resting scale). */
  scale: number;
  /** The focus point, as fractions of the clip's frame. */
  focus: { x: number; y: number };
  /** Clip-relative times of the events in this zoom. */
  eventsUs: number[];
}

interface Point {
  tUs: number;
  x: number;
  y: number;
}

const DEFAULT_EVENTS: CaptureEvent["type"][] = ["click", "dblclick", "input"];

function pointOf(session: CaptureSession, e: CaptureEvent): { x: number; y: number } | undefined {
  if ((e.type === "click" || e.type === "dblclick" || e.type === "contextmenu") && "x" in e) {
    // A click on a field zooms to the field, not the exact pixel.
    if (e.target && e.target.rect.width < session.viewport.width * 0.6) {
      const r = rectToFrame(session, e.target.rect);
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }
    const r = rectToFrame(session, { x: e.x, y: e.y, width: 0, height: 0 });
    return { x: r.x, y: r.y };
  }
  const target = "target" in e ? e.target : undefined;
  if (target && target.rect.width > 0) {
    const r = rectToFrame(session, target.rect);
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }
  return undefined;
}

/** Where the zooms go, before they become keyframes (for previews and custom UIs). */
export function zoomSegments(doc: ProjectDocument, session: CaptureSession, options: PlanZoomsOptions): ZoomSegment[] {
  const clip = screenClip(doc, options.clipId);
  const want = options.scale ?? 1.8;
  const types = new Set(options.events ?? DEFAULT_EVENTS);
  const lead = options.leadUs ?? 300_000;
  const hold = options.holdUs ?? 1_600_000;
  const ramp = options.rampUs ?? 600_000;
  const gap = options.mergeGapUs ?? 2_000_000;
  const fitFraction = options.fitFraction ?? 0.75;
  const minScale = options.minScale ?? 1.15;
  const { kx, ky } = frameExtent(doc, clip);

  const points: Point[] = [];
  for (const e of session.events) {
    if (!types.has(e.type)) continue;
    const local = sessionToClipUs(clip, session, e.tUs);
    if (local === undefined) continue;
    const p = pointOf(session, e);
    if (p) points.push({ tUs: local, ...p });
  }
  points.sort((a, b) => a.tUs - b.tUs);

  const scaleFor = (group: Point[]) => {
    const xs = group.map((p) => p.x);
    const ys = group.map((p) => p.y);
    const bw = (Math.max(...xs) - Math.min(...xs)) * kx;
    const bh = (Math.max(...ys) - Math.min(...ys)) * ky;
    return Math.min(want, bw > 0 ? fitFraction / bw : want, bh > 0 ? fitFraction / bh : want);
  };

  // Group events that are close in time, as long as the group still fits a useful zoom.
  const groups: Point[][] = [];
  for (const p of points) {
    const last = groups[groups.length - 1];
    if (last && p.tUs - last[last.length - 1]!.tUs <= gap && scaleFor([...last, p]) >= minScale) last.push(p);
    else groups.push([p]);
  }

  const segments: ZoomSegment[] = [];
  for (const group of groups) {
    const scale = scaleFor(group);
    if (scale < minScale) continue;
    const xs = group.map((p) => p.x);
    const ys = group.map((p) => p.y);
    const first = group[0]!.tUs;
    const last = group[group.length - 1]!.tUs;
    const inEndUs = Math.max(0, first - lead);
    const inStartUs = Math.max(0, inEndUs - ramp);
    const outStartUs = Math.min(clip.durationUs, Math.max(inEndUs, last + hold));
    const outEndUs = Math.min(clip.durationUs, outStartUs + ramp);
    segments.push({
      inStartUs,
      inEndUs,
      outStartUs,
      outEndUs,
      scale: round(scale, 3),
      focus: { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 },
      eventsUs: group.map((p) => p.tUs),
    });
  }
  return segments;
}

/** Commands that animate the screen clip into each zoom and back out. */
export function planZooms(doc: ProjectDocument, session: CaptureSession, options: PlanZoomsOptions): Command[] {
  const clip = screenClip(doc, options.clipId);
  const segments = zoomSegments(doc, session, options);
  if (segments.length === 0) return [];
  const ramp = options.rampUs ?? 600_000;
  const { kx, ky } = frameExtent(doc, clip);
  const base = clip.transform;

  // The clip position that puts the focus at the canvas centre without exposing the frame's edges.
  const centreFor = (focus: number, extent: number, rest: number, scale: number) => {
    const s = base.scale * scale;
    const ideal = 0.5 - (focus - 0.5) * s * extent;
    const half = (extent * (s - base.scale)) / 2;
    return clamp(ideal, rest - half, rest + half);
  };

  type State = { tUs: number; scale: number; x: number; y: number };
  const states: State[] = [];
  const rest = (tUs: number): State => ({ tUs, scale: base.scale, x: base.x, y: base.y });
  segments.forEach((seg, i) => {
    const zoomed = (tUs: number): State => ({
      tUs,
      scale: base.scale * seg.scale,
      x: centreFor(seg.focus.x, kx, base.x, seg.scale),
      y: centreFor(seg.focus.y, ky, base.y, seg.scale),
    });
    const prev = segments[i - 1];
    // Back-to-back zooms pan from one to the next instead of zooming out in between.
    const chained = prev !== undefined && seg.inStartUs <= prev.outEndUs;
    if (chained) {
      states.pop(); // no zoom-out between the two
      const holding = states[states.length - 1]!;
      holding.tUs = Math.max(prev.inEndUs, Math.min(prev.outStartUs, seg.inEndUs - ramp));
    } else {
      states.push(rest(seg.inStartUs));
    }
    states.push(zoomed(Math.max(seg.inEndUs, states.at(-1)?.tUs ?? 0)));
    states.push(zoomed(seg.outStartUs));
    states.push(rest(seg.outEndUs));
  });

  // Keyframe times must be strictly increasing; drop collapsed duplicates.
  const keyed: State[] = [];
  for (const s of states) {
    const prev = keyed[keyed.length - 1];
    if (prev && s.tUs <= prev.tUs) keyed[keyed.length - 1] = { ...s, tUs: prev.tUs };
    else keyed.push(s);
  }

  const commands: Command[] = [];
  if (options.replace !== false) {
    for (const property of ["x", "y", "scale"]) commands.push({ type: "keyframe/clear", payload: { clipId: clip.id, property } });
  }
  for (const s of keyed) {
    for (const property of ["scale", "x", "y"] as const) {
      commands.push({
        type: "keyframe/set",
        payload: { clipId: clip.id, property, timeUs: Math.round(s.tUs), value: round(s[property]), easing: "easeInOut" },
      });
    }
  }
  return commands;
}
