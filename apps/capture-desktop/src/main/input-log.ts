/**
 * The click log outside the browser: system-wide mouse, key and wheel events
 * (uiohook) turned into Miraiclip capture events on the recorded screen.
 *
 * - Positions are in the recorded display's CSS px (DIP), from its top-left,
 *   so the session's viewport is the display and maps 1:1 onto the video.
 * - Clicks are a press and release in the same spot (a drag is moves only);
 *   a right click is a "contextmenu", a second quick click adds "dblclick".
 * - Keys follow the browser logger's rule: non-text keys (Enter, Tab,
 *   arrows…) and shortcuts (Ctrl+c, Meta+k) keep their name; typed
 *   characters are only ever "text". What was typed is never recorded.
 * - The pointer leaving the screen is one "leave"; the recorder's own
 *   windows (pill, camera) and its shortcuts aren't logged.
 *
 * Pure: the hook, the coordinate conversion and the clock are passed in.
 */
import type { CaptureEvent } from "@miraiclip/capture";

/** A capture event before the recorder puts it on its clock (no `tUs` yet). */
export type LoggedEvent = CaptureEvent extends infer E ? (E extends CaptureEvent ? Omit<E, "tUs"> : never) : never;

/** The subset of uiohook's events this reads. */
export interface RawMouse {
  x: number;
  y: number;
  button?: unknown;
  clicks?: number;
}
export interface RawWheel extends RawMouse {
  rotation: number;
  amount: number;
  /** 3 vertical, 4 horizontal. */
  direction: number;
}
export interface RawKey {
  keycode: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export interface InputLogOptions {
  /** Raw hook coordinates → DIP on the virtual desktop. */
  toDip: (p: { x: number; y: number }) => { x: number; y: number };
  /** The recorded display's area in DIP. */
  area: { x: number; y: number; width: number; height: number };
  /** True for points over the recorder's own windows. */
  isOwn?: (p: { x: number; y: number }) => boolean;
  /** Key names by uiohook keycode. */
  keyNames: Map<number, string>;
  /** Shortcuts that belong to the recorder (e.g. "Alt+Shift+x"): never logged. */
  ownShortcuts?: Set<string>;
  emit: (event: LoggedEvent) => void;
  /** Minimum gap between logged moves (default 33 ms). */
  moveIntervalMs?: number;
  /** Clock in ms (default Date.now). */
  now?: () => number;
}

const MODIFIERS = new Set(["Ctrl", "CtrlRight", "Alt", "AltRight", "Shift", "ShiftRight", "Meta", "MetaRight", "CapsLock", "NumLock", "ScrollLock"]);
/** Keys that type a character (letters, digits, punctuation, space, numpad digits). */
const isTextKey = (name: string) => /^[A-Z0-9]$/.test(name) || name === "Space" || /^Numpad[0-9]$/.test(name) || PUNCTUATION.has(name);
const PUNCTUATION = new Set(["Semicolon", "Equal", "Comma", "Minus", "Period", "Slash", "Backquote", "BracketLeft", "Backslash", "BracketRight", "Quote", "NumpadMultiply", "NumpadAdd", "NumpadSubtract", "NumpadDecimal", "NumpadDivide"]);
/** How a key reads in a shortcut, like the browser's `KeyboardEvent.key` (lower-case letters). */
const SHORTCUT_CHAR: Record<string, string> = { Semicolon: ";", Equal: "=", Comma: ",", Minus: "-", Period: ".", Slash: "/", Backquote: "`", BracketLeft: "[", Backslash: "\\", BracketRight: "]", Quote: "'", Space: " " };
/** uiohook's names → the browser's `KeyboardEvent.key` names. */
const DOM_NAME: Record<string, string> = { NumpadEnter: "Enter", Space: " " };

/** uiohook mouse buttons (1 left, 2 right, 3 middle) → DOM buttons (0, 2, 1). */
const domButton = (b: unknown) => (b === 2 ? 2 : b === 3 ? 1 : b === 1 ? 0 : typeof b === "number" ? b - 1 : 0);

const round = (n: number) => Math.round(n * 10) / 10;
const CLICK_SLOP = 6; // DIP

export interface InputLog {
  mouseDown(e: RawMouse): void;
  mouseUp(e: RawMouse): void;
  mouseMove(e: RawMouse): void;
  wheel(e: RawWheel): void;
  keyDown(e: RawKey): void;
}

export function createInputLog(o: InputLogOptions): InputLog {
  const now = o.now ?? Date.now;
  const moveInterval = o.moveIntervalMs ?? 33;
  let lastMove = -Infinity;
  let outside = false;
  let down: { x: number; y: number; button: number } | null = null;
  let scroll = { x: 0, y: 0 };
  let lastScroll = -Infinity;

  /** In the recorded area (and not over our own windows): area-relative DIP; else null. */
  const place = (e: RawMouse): { x: number; y: number } | null => {
    const p = o.toDip(e);
    const a = o.area;
    const inside = p.x >= a.x && p.y >= a.y && p.x < a.x + a.width && p.y < a.y + a.height;
    if (!inside) {
      if (!outside) o.emit({ type: "leave" });
      outside = true;
      return null;
    }
    outside = false;
    if (o.isOwn?.(p)) return null;
    return { x: round(p.x - a.x), y: round(p.y - a.y) };
  };

  return {
    mouseMove(e) {
      const t = now();
      if (t - lastMove < moveInterval) return;
      const p = place(e);
      if (!p) return;
      lastMove = t;
      o.emit({ type: "move", ...p });
    },
    mouseDown(e) {
      const p = place(e);
      down = p ? { ...p, button: domButton(e.button) } : null;
    },
    mouseUp(e) {
      const start = down;
      down = null;
      if (!start) return;
      const p = place(e);
      if (!p || Math.hypot(p.x - start.x, p.y - start.y) > CLICK_SLOP) return; // a drag, or released elsewhere
      const button = domButton(e.button);
      if (button === 2) {
        o.emit({ type: "contextmenu", x: start.x, y: start.y, button });
        return;
      }
      o.emit({ type: "click", x: start.x, y: start.y, button });
      if ((e.clicks ?? 1) === 2) o.emit({ type: "dblclick", x: start.x, y: start.y, button });
    },
    wheel(e) {
      if (!place(e)) return;
      // A desktop has no page offset: accumulate the wheel into a virtual one (≈ 40 px a notch, like browsers).
      const delta = e.rotation * Math.max(1, e.amount) * 40 / 3;
      if (e.direction === 4) scroll = { ...scroll, x: round(scroll.x + delta) };
      else scroll = { ...scroll, y: round(scroll.y + delta) };
      const t = now();
      if (t - lastScroll < 100) return; // one event per ~100 ms of scrolling, like the browser logger's per-frame batching
      lastScroll = t;
      o.emit({ type: "scroll", scrollX: scroll.x, scrollY: scroll.y });
    },
    keyDown(e) {
      const name = o.keyNames.get(e.keycode);
      if (!name || MODIFIERS.has(name)) return;
      const mods = [e.ctrlKey && "Ctrl", e.metaKey && "Meta", e.altKey && "Alt"].filter(Boolean) as string[];
      let key: string;
      if (isTextKey(name)) {
        if (!mods.length) key = "text"; // typed characters are never recorded
        else key = `${mods.join("+")}+${SHORTCUT_CHAR[name] ?? name.replace(/^Numpad/, "").toLowerCase()}`;
      } else {
        key = [...mods, e.shiftKey ? "Shift" : "", DOM_NAME[name] ?? name].filter(Boolean).join("+");
      }
      if (isTextKey(name) && o.ownShortcuts?.has([...mods, e.shiftKey ? "Shift" : ""].filter(Boolean).join("+") + "+" + name.toLowerCase())) return;
      o.emit({ type: "key", key });
    },
  };
}

/** uiohook's key table → names by code (first name wins for shared codes). */
export function keyNamesFrom(table: Record<string, number>): Map<number, string> {
  const out = new Map<number, string>();
  for (const [name, code] of Object.entries(table)) if (typeof code === "number" && !out.has(code)) out.set(code, name);
  return out;
}
