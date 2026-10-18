/**
 * Redaction from the DOM, not from guesswork: every field the capture log
 * flagged as sensitive (passwords, card numbers, tokens, `[data-private]`…)
 * gets a pixelate or blur limited to that field's box, following the page's
 * scrolling, from when the page shows it until it navigates away.
 */
import type { ProjectDocument } from "@miraiclip/core";
import type { CaptureSession, CaptureTarget } from "@miraiclip/capture";
import { rectToFrame, round, screenClip, sessionToClipUsUnclamped, type Command } from "./map.js";

export interface PlanRedactionsOptions {
  clipId: string;
  /** "pixelate" (default) or "blur". */
  effect?: "pixelate" | "blur";
  /** Effect strength: pixelate block size or blur amount, as a fraction of the frame (defaults 0.02 / 0.03). */
  strength?: number;
  /** Grow each box by this many CSS px (default 6). */
  paddingPx?: number;
  /** Soft edge, as a fraction of the box's shorter side (default 0.15). */
  feather?: number;
  /** Also hide these elements (selectors as the log recorded them), sensitive or not. */
  selectors?: string[];
  /** Effect id prefix (default "redact"). */
  idPrefix?: string;
}

export interface RedactionSpan {
  selector: string;
  label?: string;
  /** Session times the element is covered from / until. */
  fromUs: number;
  toUs: number;
  /** The element's box over time (session µs, viewport CSS px, scroll applied). */
  boxes: { tUs: number; rect: CaptureTarget["rect"] }[];
}

/** Which elements to hide, when, and where (session time; before any timeline mapping). */
export function redactionSpans(session: CaptureSession, options: Pick<PlanRedactionsOptions, "selectors"> = {}): RedactionSpan[] {
  const extra = new Set(options.selectors ?? []);
  const navigations = session.events.filter((e) => e.type === "navigate").map((e) => e.tUs);
  const scrolls = session.events.filter((e): e is Extract<typeof e, { type: "scroll" }> => e.type === "scroll" && !e.target);
  const scrollAt = (tUs: number) => {
    let s = { x: 0, y: 0 };
    for (const e of scrolls) {
      if (e.tUs > tUs) break;
      s = { x: e.scrollX, y: e.scrollY };
    }
    return s;
  };
  const sightings = new Map<string, { tUs: number; target: CaptureTarget }[]>();
  for (const e of session.events) {
    const target = "target" in e ? e.target : undefined;
    if (!target || !(target.sensitive || extra.has(target.selector))) continue;
    const list = sightings.get(target.selector) ?? [];
    list.push({ tUs: e.tUs, target });
    sightings.set(target.selector, list);
  }
  const spans: RedactionSpan[] = [];
  for (const [selector, seen] of sightings) {
    // The page that showed the field: from the last navigation before it was first touched
    // to the first navigation after it was last touched (a field is on screen before you click it).
    const firstUs = seen[0]!.tUs;
    const lastUs = seen[seen.length - 1]!.tUs;
    const fromUs = Math.max(0, ...navigations.filter((t) => t <= firstUs));
    const toUs = Math.min(session.durationUs, ...navigations.filter((t) => t > lastUs));
    // Box at each sighting, and moved by every page scroll in between.
    const boxes: RedactionSpan["boxes"] = [];
    const nearest = (tUs: number) => seen.reduce((best, s) => (Math.abs(s.tUs - tUs) < Math.abs(best.tUs - tUs) ? s : best), seen[0]!);
    const moveTo = (tUs: number) => {
      const ref = nearest(tUs);
      const a = scrollAt(ref.tUs);
      const b = scrollAt(tUs);
      return { ...ref.target.rect, x: ref.target.rect.x - (b.x - a.x), y: ref.target.rect.y - (b.y - a.y) };
    };
    const times = new Set<number>([fromUs, ...seen.map((s) => s.tUs), ...scrolls.filter((s) => s.tUs > fromUs && s.tUs < toUs).map((s) => s.tUs)]);
    for (const tUs of [...times].sort((a, b) => a - b)) boxes.push({ tUs, rect: moveTo(tUs) });
    spans.push({ selector, ...(seen[0]!.target.label ? { label: seen[0]!.target.label } : {}), fromUs, toUs, boxes });
  }
  return spans.sort((a, b) => a.fromUs - b.fromUs);
}

/** Where a region waits while its element isn't on screen: a speck outside the frame. */
const OFF_FRAME = { x: -1, y: -1, width: 0.0001, height: 0.0001 };

export function planRedactions(doc: ProjectDocument, session: CaptureSession, options: PlanRedactionsOptions): Command[] {
  const clip = screenClip(doc, options.clipId);
  const effect = options.effect ?? "pixelate";
  const strength = options.strength ?? (effect === "pixelate" ? 0.02 : 0.03);
  const params = effect === "pixelate" ? { size: strength } : { amount: strength };
  const pad = options.paddingPx ?? 6;
  const commands: Command[] = [];
  let n = 0;
  for (const span of redactionSpans(session, options)) {
    // Clip the span to what the screen clip actually shows.
    const rawFrom = sessionToClipUsUnclamped(clip, session, span.fromUs);
    const rawTo = sessionToClipUsUnclamped(clip, session, span.toUs);
    if (rawFrom === undefined || rawTo === undefined) continue;
    const fromLocal = Math.max(0, rawFrom);
    const toLocalUs = Math.min(clip.durationUs, rawTo);
    if (toLocalUs <= fromLocal) continue;
    // Boxes before the clip's start collapse onto its first frame; later ones stay where they are.
    const boxes = span.boxes
      .map((b) => {
        const raw = sessionToClipUsUnclamped(clip, session, b.tUs);
        return { local: raw === undefined ? undefined : Math.max(fromLocal, raw), rect: rectToFrame(session, b.rect, pad) };
      })
      .filter((b): b is { local: number; rect: ReturnType<typeof rectToFrame> } => b.local !== undefined && b.local <= toLocalUs);
    if (boxes.length === 0) continue;
    const effectId = `${options.idPrefix ?? "redact"}-${++n}`;
    // The latest box at or before the span's first visible moment opens it.
    const first = ([...boxes].reverse().find((b) => b.local <= fromLocal) ?? boxes[0]!).rect;
    commands.push({
      type: "effect/add",
      payload: {
        clipId: clip.id,
        kind: effect,
        params,
        effectId,
        region: { x: round(first.x), y: round(first.y), width: round(first.width), height: round(first.height), feather: options.feather ?? 0.15 },
      },
    });
    // Hold keyframes: parked off-frame outside the span (regions can't be zero-sized), the box's position at each step inside it.
    const key = (timeUs: number, r: { x: number; y: number; width: number; height: number }) => {
      for (const property of ["x", "y", "width", "height"] as const) {
        commands.push({ type: "effect/set-region-keyframe", payload: { clipId: clip.id, effectId, property, timeUs: Math.round(timeUs), value: round(r[property]), easing: "hold" } });
      }
    };
    const hidden = OFF_FRAME;
    if (fromLocal > 0) key(0, hidden);
    key(fromLocal, first);
    let last = fromLocal;
    for (const b of boxes) {
      if (b.local <= last) continue;
      key(b.local, b.rect);
      last = b.local;
    }
    if (toLocalUs < clip.durationUs) key(Math.max(toLocalUs, last + 1), hidden);
  }
  return commands;
}
