/** Messages between the recorder tab, the background worker, the loggers in every page and the extension's own pages. */
import type { CaptureEvent, DisplaySurface } from "@miraiclip/capture";

/** Which screen a page is on (pages on another monitor can't be placed in the frame). */
export interface ScreenKey {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A keyboard shortcut relayed to the recorder. */
export type RecorderCommand = "toggle-pause" | "stop-recording" | "toggle-draw";

export type Message =
  /** Recorder → background: a recording started (for a window or screen, every page logs). */
  | { type: "mc-start"; surface: DisplaySurface; screen: ScreenKey }
  /** Recorder → background: it stopped (finished, discarded or restarted). */
  | { type: "mc-stop" }
  /** Recorder → background: paused or resumed (the toolbar badge shows it). */
  | { type: "mc-pause"; paused: boolean }
  /** Logger → background: should this page log? */
  | { type: "mc-state" }
  /** Background → loggers: start or stop logging. */
  | { type: "mc-log"; on: boolean; surface?: Exclude<DisplaySurface, "browser"> }
  /** Logger → background → recorder: one event, in frame coordinates, timed in epoch ms. */
  | { type: "mc-event"; event: CaptureEvent; epochMs: number; screen: ScreenKey }
  /** Background → recorder: another tab or window came to the front. */
  | { type: "mc-switch"; epochMs: number }
  /** Background → recorder: the "mark a step" shortcut was pressed. */
  | { type: "mc-step" }
  /** Background → recorder: the pause or stop shortcut was pressed. */
  | { type: "mc-command"; command: RecorderCommand }
  /** Recorder → background: a one-time token that lets the save page accept this recording. */
  | { type: "mc-token" }
  /** Save page → background: is this token real? (it is used up) */
  | { type: "mc-claim"; token: string }
  /** Recorder → background: open the review page (a saved recording, or the library). */
  | { type: "mc-open-review"; id?: string };

export const epochMs = () => performance.timeOrigin + performance.now();

export function screenKey(): ScreenKey {
  const s = window.screen as Screen & { left?: number; top?: number; availLeft?: number };
  return { left: s.left ?? s.availLeft ?? 0, top: s.top ?? 0, width: s.width, height: s.height };
}

export const sameScreen = (a: ScreenKey, b: ScreenKey) => a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
