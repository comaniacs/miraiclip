/**
 * A capture session: what was recorded (screen, microphone, camera) and the
 * interaction log that goes with it — clicks, keys, scrolls, the cursor path
 * and what was clicked — on one clock that starts with the recording.
 *
 * Plain JSON, so it can be saved next to the media, sent to a server, or fed
 * to the screencast planners (`planZooms`, `planCursor`, `planRedactions`, …)
 * that turn it into editable commands.
 */

/** Microseconds since the recording started. */
export type CaptureUs = number;

/** A rectangle in viewport CSS pixels. */
export interface CaptureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What an event happened on. */
export interface CaptureTarget {
  /** A short CSS selector that found the element at capture time. */
  selector: string;
  /** Lower-case tag name. */
  tag: string;
  /** ARIA role, when there is one. */
  role?: string;
  /**
   * A human label: aria-label, the label of a form field, the button's text,
   * alt text or placeholder (trimmed, at most 80 characters). Never the value
   * of a field.
   */
  label?: string;
  /** The element's box at the time of the event, in viewport CSS pixels. */
  rect: CaptureRect;
  /** The element holds data that shouldn't appear in a video (passwords, card numbers, tokens…). */
  sensitive?: boolean;
}

interface EventBase {
  tUs: CaptureUs;
}

/** Pointer position in viewport CSS pixels. */
export interface PointerEventData {
  x: number;
  y: number;
}

export type CaptureEvent =
  | (EventBase & PointerEventData & { type: "move" })
  | (EventBase & PointerEventData & { type: "click" | "dblclick" | "contextmenu"; button: number; target?: CaptureTarget })
  | (EventBase & {
      type: "key";
      /**
       * The key, for keys that aren't text (Enter, Tab, Escape, ArrowDown,
       * Backspace…) and shortcuts ("Meta+k"). Typed characters are recorded
       * as "text" — the log never contains what was typed.
       */
      key: string;
      target?: CaptureTarget;
    })
  | (EventBase & { type: "scroll"; scrollX: number; scrollY: number; target?: CaptureTarget })
  | (EventBase & { type: "focus"; target: CaptureTarget })
  | (EventBase & { type: "input"; target: CaptureTarget })
  | (EventBase & { type: "navigate"; url: string; title?: string })
  | (EventBase & { type: "resize"; width: number; height: number })
  | (EventBase & { type: "marker"; label: string; data?: Record<string, unknown> })
  /** The pointer left the logged page(s): to another app, or out of the browser. */
  | (EventBase & { type: "leave" });

export type CaptureEventType = CaptureEvent["type"];

/** One recorded media file. */
export interface CaptureMedia {
  /** Where the file is (set by whoever saves it: a path, a URL, a blob: URL). */
  src?: string;
  mimeType: string;
  /** Frame size of a video file. */
  width?: number;
  height?: number;
  durationUs?: CaptureUs;
  /** Offset of the file's first sample from the session clock (normally 0). */
  offsetUs?: CaptureUs;
}

export interface CaptureSession {
  format: 1;
  /** ISO time the recording started. */
  startedAt: string;
  durationUs: CaptureUs;
  /**
   * The page the event log was recorded in: its CSS viewport size and device
   * pixel ratio. Event coordinates are in this viewport's CSS pixels.
   */
  viewport: { width: number; height: number; devicePixelRatio: number };
  /**
   * Where the viewport sits inside the screen recording, as fractions of the
   * video frame (a tab capture is the whole frame: 0, 0, 1, 1).
   */
  viewportInVideo?: { x: number; y: number; width: number; height: number };
  /**
   * What was recorded: a browser tab, a window or a whole screen. For a window
   * or a screen, `viewportInVideo` is an estimate, and only what happened in
   * the logged page is in `events` (not clicks in other apps or tabs).
   */
  surface?: "browser" | "window" | "monitor";
  /**
   * Whether the real mouse pointer was recorded into the screen video. When it
   * was, a drawn cursor would show twice; when it wasn't, one should be drawn.
   */
  cursorInVideo?: boolean;
  media: {
    screen?: CaptureMedia;
    microphone?: CaptureMedia;
    camera?: CaptureMedia;
  };
  events: CaptureEvent[];
}
