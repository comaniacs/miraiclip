/**
 * Where the page sits inside a window or whole-screen recording.
 *
 * A tab recording is the page itself, so the event log maps 1:1 onto the
 * video. When a window or a whole screen is recorded instead, the page is a
 * rectangle somewhere inside the frame: below the browser's toolbars, and
 * (for a screen) wherever the window is. The browser doesn't report that
 * rectangle, so it is estimated from the window's geometry. Exact for a tab,
 * close for a still window, and wrong if the window moves while recording.
 */

import type { CaptureEvent, CaptureTarget } from "./types.js";

export type DisplaySurface = "browser" | "window" | "monitor";

/** The bits of `window` the estimate reads (so it can be tested without a browser). */
export interface WindowGeometry {
  innerWidth: number;
  innerHeight: number;
  outerWidth: number;
  outerHeight: number;
  screenX: number;
  screenY: number;
  devicePixelRatio: number;
  /** The screen the window is on; `left`/`top` (or `availLeft`/`availTop`) place it among several. */
  screen: { width: number; height: number; left?: number; top?: number; availLeft?: number; availTop?: number };
}

export interface VideoFrameSize {
  /** The recording's frame, in device pixels (the video track's settings). */
  width: number;
  height: number;
}

/**
 * Where the page's top-left corner is in a window or whole-screen frame, and
 * the frame's size, both in CSS pixels. For a tab, the page is the frame.
 */
export function pageInFrame(surface: DisplaySurface, win: WindowGeometry): { x: number; y: number; frameWidth: number; frameHeight: number } {
  if (surface === "browser") return { x: 0, y: 0, frameWidth: win.innerWidth, frameHeight: win.innerHeight };
  const side = Math.max(0, (win.outerWidth - win.innerWidth) / 2);
  const toolbars = Math.max(0, win.outerHeight - win.innerHeight - side);
  if (surface === "window") return { x: side, y: toolbars, frameWidth: win.outerWidth, frameHeight: win.outerHeight };
  const screenLeft = win.screen.left ?? win.screen.availLeft ?? 0;
  const screenTop = win.screen.top ?? 0;
  return { x: win.screenX - screenLeft + side, y: win.screenY - screenTop + toolbars, frameWidth: win.screen.width, frameHeight: win.screen.height };
}

/**
 * An event from a page, moved into frame coordinates (CSS px from the frame's
 * top-left): pointer positions and target boxes shift by the page's offset.
 * Use it to log several pages (tabs, windows) of one window or screen
 * recording on a single frame-sized viewport.
 */
export function eventToFrame<E extends CaptureEvent>(event: E, offset: { x: number; y: number }): E {
  const r = (n: number) => Math.round(n * 10) / 10;
  const out: Record<string, unknown> = { ...event };
  if ("x" in event && "y" in event && typeof event.x === "number") {
    out["x"] = r(event.x + offset.x);
    out["y"] = r((event as { y: number }).y + offset.y);
  }
  const target = (event as { target?: CaptureTarget }).target;
  if (target) out["target"] = { ...target, rect: { ...target.rect, x: r(target.rect.x + offset.x), y: r(target.rect.y + offset.y) } };
  return out as E;
}

/**
 * A tab recording keeps its first frame size: when the tab is resized (or
 * zoomed) while recording, the new picture is scaled to fit inside that frame,
 * centred. This moves the events logged after each `resize` into the starting
 * viewport's CSS pixels, so they line up with that video. Events before any
 * resize, and the resize events themselves, are unchanged.
 */
export function fitResizedEvents(events: CaptureEvent[], start: { width: number; height: number }): CaptureEvent[] {
  if (!(start.width > 0 && start.height > 0)) return events;
  const r = (n: number) => Math.round(n * 10) / 10;
  let fit: { s: number; x: number; y: number } | undefined;
  return events.map((event) => {
    if (event.type === "resize") {
      const same = event.width === start.width && event.height === start.height;
      const s = Math.min(start.width / event.width, start.height / event.height);
      fit = same || !(s > 0 && Number.isFinite(s)) ? undefined : { s, x: (start.width - event.width * s) / 2, y: (start.height - event.height * s) / 2 };
      return event;
    }
    if (!fit) return event;
    const { s, x, y } = fit;
    const out: Record<string, unknown> = { ...event };
    if ("x" in event && "y" in event && typeof event.x === "number") {
      out["x"] = r(x + event.x * s);
      out["y"] = r(y + (event as { y: number }).y * s);
    }
    const target = (event as { target?: CaptureTarget }).target;
    if (target) {
      const b = target.rect;
      out["target"] = { ...target, rect: { x: r(x + b.x * s), y: r(y + b.y * s), width: r(b.width * s), height: r(b.height * s) } };
    }
    return out as unknown as CaptureEvent;
  });
}

/**
 * The page's box in the recorded frame, as fractions of the frame, or
 * undefined when it can't be placed (an unknown surface, or a frame that
 * doesn't match the window or screen, such as another monitor).
 */
export function estimateViewportInVideo(
  surface: DisplaySurface | undefined,
  frame: VideoFrameSize,
  win: WindowGeometry,
): { x: number; y: number; width: number; height: number } | undefined {
  if (surface === "browser") return { x: 0, y: 0, width: 1, height: 1 };
  if (surface !== "window" && surface !== "monitor") return undefined;
  if (!(frame.width > 0 && frame.height > 0 && win.innerWidth > 0 && win.innerHeight > 0)) return undefined;
  const dpr = win.devicePixelRatio || 1;
  const frameW = frame.width / dpr;
  const frameH = frame.height / dpr;
  // Browser chrome: side borders split evenly, the rest of the height is toolbars on top
  // (a bottom border as thick as a side one).
  const side = Math.max(0, (win.outerWidth - win.innerWidth) / 2);
  const toolbars = Math.max(0, win.outerHeight - win.innerHeight - side);
  let left: number;
  let top: number;
  let expectW: number;
  let expectH: number;
  if (surface === "window") {
    left = side;
    top = toolbars;
    expectW = win.outerWidth;
    expectH = win.outerHeight;
  } else {
    const screenLeft = win.screen.left ?? win.screen.availLeft ?? 0;
    const screenTop = win.screen.top ?? 0;
    left = win.screenX - screenLeft + side;
    top = win.screenY - screenTop + toolbars;
    expectW = win.screen.width;
    expectH = win.screen.height;
  }
  // A frame much bigger or smaller than expected is something else (another monitor, a scaled capture).
  const off = (a: number, b: number) => Math.abs(a - b) / b > 0.15;
  if (off(frameW, expectW) || off(frameH, expectH)) return undefined;
  const box = { x: left / frameW, y: top / frameH, width: win.innerWidth / frameW, height: win.innerHeight / frameH };
  // The page must be (mostly) inside the frame.
  if (box.x < -0.02 || box.y < -0.02 || box.x + box.width > 1.02 || box.y + box.height > 1.02) return undefined;
  const r = (n: number) => Math.round(n * 10000) / 10000;
  return { x: r(Math.max(0, box.x)), y: r(Math.max(0, box.y)), width: r(Math.min(box.width, 1 - Math.max(0, box.x))), height: r(Math.min(box.height, 1 - Math.max(0, box.y))) };
}
