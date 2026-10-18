/**
 * Read a saved capture session (JSON) back, checking its shape and putting
 * events in time order. Unknown event types are dropped, not fatal, so newer
 * recorders' logs still load.
 */
import type { CaptureEvent, CaptureSession } from "./types.js";

const KNOWN = new Set(["move", "click", "dblclick", "contextmenu", "key", "scroll", "focus", "input", "navigate", "resize", "marker", "leave"]);

export function parseCaptureSession(input: unknown): CaptureSession {
  const s = (typeof input === "string" ? JSON.parse(input) : input) as Partial<CaptureSession> | null;
  if (!s || s.format !== 1) throw new Error("not a capture session (expected format: 1)");
  if (!s.viewport || !(s.viewport.width > 0) || !(s.viewport.height > 0)) throw new Error("capture session has no viewport size");
  if (!(typeof s.durationUs === "number" && s.durationUs >= 0)) throw new Error("capture session has no durationUs");
  const events = (Array.isArray(s.events) ? s.events : [])
    .filter((e): e is CaptureEvent => !!e && typeof e === "object" && KNOWN.has((e as { type?: string }).type ?? "") && typeof (e as { tUs?: unknown }).tUs === "number")
    .sort((a, b) => a.tUs - b.tUs);
  return {
    format: 1,
    startedAt: s.startedAt ?? new Date(0).toISOString(),
    durationUs: s.durationUs,
    viewport: { width: s.viewport.width, height: s.viewport.height, devicePixelRatio: s.viewport.devicePixelRatio || 1 },
    ...(s.viewportInVideo ? { viewportInVideo: s.viewportInVideo } : {}),
    ...(s.surface === "browser" || s.surface === "window" || s.surface === "monitor" ? { surface: s.surface } : {}),
    ...(typeof s.cursorInVideo === "boolean" ? { cursorInVideo: s.cursorInVideo } : {}),
    media: s.media ?? {},
    events,
  };
}
