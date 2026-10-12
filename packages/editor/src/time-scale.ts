import { US_PER_SECOND, type Us } from "@miraiclip/core";

/*
 * Timeline geometry. Zoom is pixels per second of timeline (`pxPerSecond`);
 * horizontal positions are measured from the start of the lanes (time 0), so
 * callers subtract any sticky header column before calling these.
 */

/** Microseconds → pixels at a zoom. */
export function usToPx(us: Us, pxPerSecond: number): number {
  return (us / US_PER_SECOND) * pxPerSecond;
}

/** Pixels → microseconds at a zoom. Not rounded: round (or `snapToFrame`) before dispatching. */
export function pxToUs(px: number, pxPerSecond: number): Us {
  return (px / pxPerSecond) * US_PER_SECOND;
}

/** `mm:ss` (the compact clock used in transport bars and ruler labels). */
export function formatClock(us: Us): string {
  const totalSeconds = Math.max(0, Math.round(us / US_PER_SECOND));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export interface VisibleRangeInput {
  /** Horizontal scroll of the lanes, in px. */
  scrollLeftPx: number;
  /** Width of the lanes' viewport, in px (without a sticky header column). */
  viewportWidthPx: number;
  pxPerSecond: number;
}

/**
 * The time range a timeline should render (virtualisation): what is visible
 * plus one viewport of overscan on each side, snapped to half-viewport steps
 * so ordinary scrolling changes the range only every half screen. Clips
 * outside it need not be in the DOM at all.
 */
export function visibleRange({ scrollLeftPx, viewportWidthPx, pxPerSecond }: VisibleRangeInput): {
  fromUs: Us;
  toUs: Us;
} {
  const view = Math.max(200, viewportWidthPx);
  const stepPx = Math.max(100, Math.round(view / 2));
  const fromPx = Math.max(0, Math.floor((scrollLeftPx - view) / stepPx) * stepPx);
  const toPx = Math.ceil((scrollLeftPx + 2 * view) / stepPx) * stepPx;
  return { fromUs: pxToUs(fromPx, pxPerSecond), toUs: pxToUs(toPx, pxPerSecond) };
}

export interface ZoomAtPointInput {
  pxPerSecond: number;
  scrollLeftPx: number;
  /** Pointer x within the lanes' viewport, in px. The time under it stays put. */
  anchorPx: number;
  /** Multiplier on the current zoom (> 1 zooms in). */
  factor: number;
  minPxPerSecond: number;
  maxPxPerSecond: number;
}

/** Zoom around a point: the new zoom and the scroll that keeps the anchored time under the pointer. */
export function zoomAtPoint(input: ZoomAtPointInput): { pxPerSecond: number; scrollLeftPx: number } {
  const next = Math.min(input.maxPxPerSecond, Math.max(input.minPxPerSecond, input.pxPerSecond * input.factor));
  const anchorSeconds = (input.anchorPx + input.scrollLeftPx) / input.pxPerSecond;
  return { pxPerSecond: next, scrollLeftPx: Math.max(0, anchorSeconds * next - input.anchorPx) };
}

/** Zoom factor for a wheel event's `deltaY` (smooth on trackpads, steady on mice). */
export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * 0.002);
}

export interface PlayheadViewInput {
  playheadUs: Us;
  pxPerSecond: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
}

/** Which side of the viewport the playhead is off, or null when it is visible. */
export function playheadOffscreenSide(input: PlayheadViewInput): "left" | "right" | null {
  const x = usToPx(input.playheadUs, input.pxPerSecond);
  if (x < input.scrollLeftPx) return "left";
  if (x > input.scrollLeftPx + input.viewportWidthPx) return "right";
  return null;
}

/**
 * Page-follow during playback: when the playhead nears the right edge (or is
 * behind the left one), the scroll that puts it 10% in from the left.
 * Returns null when no scroll is needed.
 */
export function followPlayheadScroll(input: PlayheadViewInput & { edgePx?: number }): number | null {
  const x = usToPx(input.playheadUs, input.pxPerSecond);
  const edge = input.edgePx ?? 24;
  if (x > input.scrollLeftPx + input.viewportWidthPx - edge || x < input.scrollLeftPx) {
    return Math.max(0, x - input.viewportWidthPx * 0.1);
  }
  return null;
}

/** The scroll that brings the playhead into view, 30% in from the left. */
export function revealPlayheadScroll(input: Omit<PlayheadViewInput, "scrollLeftPx">): number {
  return Math.max(0, usToPx(input.playheadUs, input.pxPerSecond) - input.viewportWidthPx * 0.3);
}
