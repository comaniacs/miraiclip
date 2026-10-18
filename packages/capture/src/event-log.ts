/**
 * The interaction log: listens to a document while you record and writes
 * `CaptureEvent`s on the recording's clock. Privacy first: it never records
 * what was typed or the value of any field, and it flags elements that hold
 * secrets (password, card, token fields…) so `planRedactions` can blur them.
 */
import type { CaptureEvent, CaptureRect, CaptureTarget } from "./types.js";

export interface EventLoggerOptions {
  /** The document to listen to (default: `document`). */
  document?: Document;
  /** The session clock in µs (default: performance.now() since `start`). */
  now?: () => number;
  /** Minimum gap between cursor samples, ms (default 33: ~30 per second). */
  moveIntervalMs?: number;
  /**
   * Decide whether an element holds sensitive data. Default: `isSensitiveElement`
   * (password/credit-card/OTP inputs, names and ids like "token" or "ssn",
   * `[data-private]`, `[data-sensitive]`, `.private`).
   */
  isSensitive?: (element: Element) => boolean;
  /**
   * Leave interactions on these elements out of the log entirely, such as a
   * recorder's own controls (inside a shadow root, the host element is what
   * the document sees).
   */
  ignore?: (element: Element) => boolean;
  /** Called with each event as it is logged (to stream it elsewhere, such as another tab). */
  onEvent?: (event: CaptureEvent) => void;
}

export interface EventLogger {
  start(): void;
  stop(): CaptureEvent[];
  /** Add a named marker at the current time (a step, a chapter). */
  mark(label: string, data?: Record<string, unknown>): void;
  /** Ignore interactions until `resume()` (the recording is paused). */
  pause(): void;
  resume(): void;
  /** The events so far (a copy). */
  events(): CaptureEvent[];
  readonly running: boolean;
}

const SENSITIVE_AUTOCOMPLETE = /^(cc-|current-password|new-password|one-time-code)/;
const SENSITIVE_NAME = /pass(word|wd)?|secret|token|api[-_]?key|ssn|social|cvv|cvc|card|iban|account[-_]?number|otp|pin\b/i;

/** The default sensitivity heuristic. */
export function isSensitiveElement(element: Element): boolean {
  if (element.closest("[data-private],[data-sensitive],.private,.sensitive")) return true;
  const field = element as HTMLInputElement;
  if (field.tagName === "INPUT") {
    if (field.type === "password") return true;
    const autocomplete = (field.getAttribute("autocomplete") ?? "").toLowerCase();
    if (SENSITIVE_AUTOCOMPLETE.test(autocomplete)) return true;
  }
  if (field.tagName === "INPUT" || field.tagName === "TEXTAREA") {
    const hint = `${field.name ?? ""} ${field.id ?? ""} ${field.getAttribute("placeholder") ?? ""} ${field.getAttribute("aria-label") ?? ""}`;
    if (SENSITIVE_NAME.test(hint)) return true;
  }
  return false;
}

const round = (n: number) => Math.round(n * 10) / 10;

function rectOf(element: Element): CaptureRect {
  const r = element.getBoundingClientRect();
  return { x: round(r.left), y: round(r.top), width: round(r.width), height: round(r.height) };
}

/** A short selector that finds `element` (id, data-testid, or a tag/nth-of-type path). */
export function selectorFor(element: Element): string {
  const esc = (s: string) => (typeof CSS !== "undefined" && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, "\\$&"));
  if (element.id) return `#${esc(element.id)}`;
  const testId = element.getAttribute("data-testid");
  if (testId) return `[data-testid="${testId.replace(/"/g, '\\"')}"]`;
  const parts: string[] = [];
  let el: Element | null = element;
  while (el && el.nodeType === 1 && parts.length < 4) {
    if (el.id) {
      parts.unshift(`#${esc(el.id)}`);
      break;
    }
    const tag = el.tagName.toLowerCase();
    const parent: Element | null = el.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const same = Array.from(parent.children).filter((c) => c.tagName === el!.tagName);
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(el) + 1})` : tag);
    el = parent;
  }
  return parts.join(" > ");
}

/** A human label for an element — never a field's value. */
export function labelFor(element: Element): string | undefined {
  const clean = (s: string | null | undefined) => {
    const t = (s ?? "").replace(/\s+/g, " ").trim();
    return t ? (t.length > 80 ? `${t.slice(0, 79)}…` : t) : undefined;
  };
  const aria = clean(element.getAttribute("aria-label"));
  if (aria) return aria;
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const text = clean(labelledBy.split(/\s+/).map((id) => element.ownerDocument.getElementById(id)?.textContent ?? "").join(" "));
    if (text) return text;
  }
  const tag = element.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    const field = element as HTMLInputElement;
    const forLabel = field.id ? element.ownerDocument.querySelector(`label[for="${field.id.replace(/"/g, '\\"')}"]`) : null;
    const wrapping = element.closest("label");
    const text = clean((forLabel ?? wrapping)?.textContent) ?? clean(field.getAttribute("placeholder")) ?? clean(field.name);
    if (text) return text;
    if (field.type === "submit" || field.type === "button") return clean(field.value);
    return undefined;
  }
  if (tag === "IMG") return clean(element.getAttribute("alt"));
  return clean(element.textContent) ?? clean(element.getAttribute("title"));
}

/** The element worth describing: the nearest interactive ancestor of the event target. */
function interactiveTarget(node: EventTarget | null): Element | null {
  if (!node || !(node as Element).closest) return null;
  return (node as Element).closest("a,button,input,textarea,select,label,summary,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[role=switch],[contenteditable=''],[contenteditable=true],[tabindex]") ?? (node as Element);
}

export function describeTarget(element: Element, isSensitive: (el: Element) => boolean = isSensitiveElement): CaptureTarget {
  const target: CaptureTarget = { selector: selectorFor(element), tag: element.tagName.toLowerCase(), rect: rectOf(element) };
  const role = element.getAttribute("role");
  if (role) target.role = role;
  const label = labelFor(element);
  if (label) target.label = label;
  if (isSensitive(element)) target.sensitive = true;
  return target;
}

const TEXT_KEY = /^.$/u;

/** Record interactions in a document. */
export function createEventLogger(options: EventLoggerOptions = {}): EventLogger {
  const doc = options.document ?? document;
  const win = doc.defaultView ?? window;
  const sensitive = options.isSensitive ?? isSensitiveElement;
  const moveInterval = options.moveIntervalMs ?? 33;
  let origin = 0;
  const now = options.now ?? (() => Math.round((win.performance.now() - origin) * 1000));
  const events: CaptureEvent[] = [];
  let running = false;
  let paused = false;
  let lastMove = -Infinity;
  const listeners: [EventTarget, string, EventListener, AddEventListenerOptions][] = [];
  const push = (event: CaptureEvent) => {
    events.push(event);
    options.onEvent?.(event);
  };
  const on = (target: EventTarget, type: string, listener: (e: Event) => void, opts: AddEventListenerOptions = { capture: true, passive: true }) => {
    listeners.push([target, type, ((e: Event) => {
      if (paused) return;
      const t = e.target as Element | null;
      if (options.ignore && t && typeof (t as Element).closest === "function" && options.ignore(t)) return;
      listener(e);
    }) as EventListener, opts]);
  };

  // The pointer leaving the page (to the browser's toolbars, another window or app).
  on(doc, "pointerout", (e) => {
    if ((e as PointerEvent).relatedTarget) return;
    if (events[events.length - 1]?.type === "leave") return;
    push({ tUs: now(), type: "leave" });
  });
  on(doc, "pointermove", (e) => {
    const p = e as PointerEvent;
    const t = now();
    if (t - lastMove < moveInterval * 1000) return;
    lastMove = t;
    push({ tUs: t, type: "move", x: round(p.clientX), y: round(p.clientY) });
  });
  for (const type of ["click", "dblclick", "contextmenu"] as const) {
    on(doc, type, (e) => {
      const m = e as MouseEvent;
      const el = interactiveTarget(m.target);
      push({ tUs: now(), type, x: round(m.clientX), y: round(m.clientY), button: m.button, ...(el ? { target: describeTarget(el, sensitive) } : {}) });
    });
  }
  on(doc, "keydown", (e) => {
    const k = e as KeyboardEvent;
    if (k.repeat) return;
    const mods = [k.ctrlKey && "Ctrl", k.metaKey && "Meta", k.altKey && "Alt"].filter(Boolean) as string[];
    const printable = TEXT_KEY.test(k.key);
    // Shortcuts keep their key (Meta+k); typed characters never do.
    const key = printable ? (mods.length ? `${mods.join("+")}+${k.key.toLowerCase()}` : "text") : [...mods, k.shiftKey && k.key !== "Shift" ? "Shift" : "", k.key].filter(Boolean).join("+");
    const el = interactiveTarget(k.target);
    push({ tUs: now(), type: "key", key, ...(el && el !== doc.body ? { target: describeTarget(el, sensitive) } : {}) });
  });
  let scrollQueued = false;
  on(win, "scroll", () => {
    if (scrollQueued) return;
    scrollQueued = true;
    win.requestAnimationFrame(() => {
      scrollQueued = false;
      push({ tUs: now(), type: "scroll", scrollX: round(win.scrollX), scrollY: round(win.scrollY) });
    });
  });
  on(doc, "focusin", (e) => {
    const el = interactiveTarget(e.target);
    if (el && el !== doc.body) push({ tUs: now(), type: "focus", target: describeTarget(el, sensitive) });
  });
  on(doc, "input", (e) => {
    const el = interactiveTarget(e.target);
    if (!el) return;
    const last = events[events.length - 1];
    // One input event per field per burst of typing.
    if (last?.type === "input" && last.target.selector === selectorFor(el) && now() - last.tUs < 1_000_000) return;
    push({ tUs: now(), type: "input", target: describeTarget(el, sensitive) });
  });
  on(win, "resize", () => push({ tUs: now(), type: "resize", width: win.innerWidth, height: win.innerHeight }));
  const navigated = () => push({ tUs: now(), type: "navigate", url: win.location.href, title: doc.title });
  on(win, "popstate", navigated);
  on(win, "hashchange", navigated);

  return {
    get running() {
      return running;
    },
    start() {
      if (running) return;
      running = true;
      paused = false;
      origin = win.performance.now();
      events.length = 0;
      lastMove = -Infinity;
      for (const [target, type, listener, opts] of listeners) target.addEventListener(type, listener, opts);
      push({ tUs: now(), type: "navigate", url: win.location.href, title: doc.title });
    },
    stop() {
      if (running) {
        running = false;
        for (const [target, type, listener, opts] of listeners) target.removeEventListener(type, listener, opts);
      }
      return [...events];
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    mark(label, data) {
      push({ tUs: now(), type: "marker", label, ...(data ? { data } : {}) });
    },
    events: () => [...events],
  };
}
