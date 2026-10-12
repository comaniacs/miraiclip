import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Project, Us } from "@miraiclip/core";
import {
  beginGesture,
  followPlayheadScroll,
  matchEditorShortcut,
  playheadOffscreenSide,
  revealPlayheadScroll,
  runEditorAction,
  visibleRange,
  wheelZoomFactor,
  zoomAtPoint,
  type EditorAction,
  type Gesture,
} from "@miraiclip/editor";
import { useProject } from "./project.js";
import { usePlayback } from "./playback.js";
import { useDurationUs } from "./state.js";

/**
 * Moves a playhead-driven element without per-frame style recalcs.
 *
 * While playing, the element runs a linear Web Animations transform from the
 * playhead to the end, so the browser's compositor moves it with no main-
 * thread work. The store's playhead only re-syncs it: the animation restarts
 * when the real playhead drifts more than `toleranceUs` from its prediction
 * (seek, loop, buffering stall). Paused, it gets a static transform.
 *
 * `toTransform` maps a time to a CSS transform; list what it depends on in `deps`.
 */
export function useCompositorPlayhead(
  ref: RefObject<HTMLElement | null>,
  toTransform: (us: Us, durationUs: Us) => string,
  deps: readonly unknown[],
  toleranceUs = 40_000,
): void {
  const project = useProject();
  const { isPlaying } = usePlayback();
  const durationUs = useDurationUs();
  const toTransformRef = useRef(toTransform);
  toTransformRef.current = toTransform;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const map = (us: Us) => toTransformRef.current(us, durationUs);
    let anim: Animation | undefined;
    let anchorUs = 0;
    let anchorMs = 0;
    let lastStatic: Us | undefined;

    const setStatic = (us: Us) => {
      if (anim) {
        anim.cancel();
        anim = undefined;
      }
      if (lastStatic === us) return;
      lastStatic = us;
      el.style.transform = map(us);
    };

    const start = (us: Us) => {
      anim?.cancel();
      anim = undefined;
      lastStatic = undefined;
      el.style.transform = map(us);
      const remainingUs = Math.max(0, durationUs - us);
      if (remainingUs <= 0 || typeof el.animate !== "function") return;
      anim = el.animate([{ transform: map(us) }, { transform: map(durationUs) }], {
        duration: remainingUs / 1000,
        easing: "linear",
        fill: "forwards",
      });
      anchorUs = us;
      anchorMs = performance.now();
    };

    const sync = () => {
      const us = project.store.getState().playheadUs;
      if (!isPlaying) return setStatic(us);
      if (!anim) return start(us);
      const predictedUs = anchorUs + (performance.now() - anchorMs) * 1000;
      if (Math.abs(predictedUs - us) > toleranceUs) start(us);
    };

    sync();
    const unsubscribe = project.store.subscribe(sync);
    // A stalled player stops updating the store; catch that drift too.
    const timer = isPlaying ? window.setInterval(sync, 250) : undefined;
    return () => {
      unsubscribe();
      if (timer !== undefined) window.clearInterval(timer);
      anim?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, isPlaying, durationUs, toleranceUs, ...deps]);
}

/**
 * The time range a scrolling timeline should render (see `visibleRange` in
 * @miraiclip/editor). `headerWidthPx` is a sticky header column inside the
 * scroll container, excluded from the lanes' width.
 */
export function useVisibleRange(
  scrollRef: RefObject<HTMLElement | null>,
  pxPerSecond: number,
  headerWidthPx = 0,
): { fromUs: Us; toUs: Us } {
  const [range, setRange] = useState({ fromUs: 0, toUs: 0 });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const next = visibleRange({
        scrollLeftPx: el.scrollLeft,
        viewportWidthPx: el.clientWidth - headerWidthPx,
        pxPerSecond,
      });
      setRange((r) => (r.fromUs === next.fromUs && r.toUs === next.toUs ? r : next));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    el.addEventListener("scroll", schedule, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    observer?.observe(el);
    return () => {
      el.removeEventListener("scroll", schedule);
      observer?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollRef, pxPerSecond, headerWidthPx]);
  return range;
}

export interface PlayheadFollow {
  /** Which side the playhead is scrolled off, or null when visible. */
  side: "left" | "right" | null;
  /** Playhead time when it went off screen (refreshed every 0.5 s while off). */
  us: Us;
  /** Scroll the playhead back into view. */
  reveal: () => void;
}

/**
 * Keeps the playhead findable: while playing, pages the timeline so the
 * playhead stays in view (pausing for 1.5 s after the user scrolls by hand),
 * and reports when it is off screen, for an edge indicator.
 */
export function usePlayheadFollow(
  scrollRef: RefObject<HTMLElement | null>,
  pxPerSecond: number,
  headerWidthPx = 0,
): PlayheadFollow {
  const project = useProject();
  const { isPlaying } = usePlayback();
  const [state, setState] = useState<{ side: "left" | "right" | null; us: Us }>({ side: null, us: 0 });
  const userScrolledAt = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = (follow: boolean) => {
      const playheadUs = project.store.getState().playheadUs;
      const view = { playheadUs, pxPerSecond, viewportWidthPx: el.clientWidth - headerWidthPx };
      if (follow && performance.now() - userScrolledAt.current > 1500) {
        const next = followPlayheadScroll({ ...view, scrollLeftPx: el.scrollLeft });
        if (next !== null) el.scrollLeft = next;
      }
      const side = playheadOffscreenSide({ ...view, scrollLeftPx: el.scrollLeft });
      setState((s) =>
        s.side === side && (side === null || Math.abs(s.us - playheadUs) < 500_000) ? s : { side, us: playheadUs },
      );
    };
    const markUser = () => (userScrolledAt.current = performance.now());
    const onScroll = () => check(false);
    el.addEventListener("wheel", markUser, { passive: true });
    el.addEventListener("pointerdown", markUser);
    el.addEventListener("scroll", onScroll, { passive: true });
    const unsubscribe = project.store.subscribe(() => {
      if (!isPlaying) check(false);
    });
    const timer = isPlaying ? window.setInterval(() => check(true), 200) : undefined;
    check(isPlaying);
    return () => {
      el.removeEventListener("wheel", markUser);
      el.removeEventListener("pointerdown", markUser);
      el.removeEventListener("scroll", onScroll);
      unsubscribe();
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [scrollRef, project, pxPerSecond, isPlaying, headerWidthPx]);

  const reveal = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = revealPlayheadScroll({
      playheadUs: project.store.getState().playheadUs,
      pxPerSecond,
      viewportWidthPx: el.clientWidth - headerWidthPx,
    });
  };
  return { ...state, reveal };
}

export interface TimelineZoomOptions {
  pxPerSecond: number;
  setPxPerSecond: (pxPerSecond: number) => void;
  minPxPerSecond: number;
  maxPxPerSecond: number;
  /** Sticky header column width inside the scroll container. */
  headerWidthPx?: number;
  /** Set false to leave Ctrl/⌘ + wheel to the browser (default true). */
  enabled?: boolean;
}

/** Ctrl/⌘ + wheel zooms the timeline around the pointer; plain wheel keeps scrolling. */
export function useTimelineZoom(scrollRef: RefObject<HTMLElement | null>, options: TimelineZoomOptions): void {
  const latest = useRef(options);
  latest.current = options;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const o = latest.current;
      if (!(e.ctrlKey || e.metaKey) || o.enabled === false) return;
      e.preventDefault();
      const next = zoomAtPoint({
        pxPerSecond: o.pxPerSecond,
        scrollLeftPx: el.scrollLeft,
        anchorPx: e.clientX - el.getBoundingClientRect().left - (o.headerWidthPx ?? 0),
        factor: wheelZoomFactor(e.deltaY),
        minPxPerSecond: o.minPxPerSecond,
        maxPxPerSecond: o.maxPxPerSecond,
      });
      o.setPxPerSecond(next.pxPerSecond);
      // Scroll after React lays out the new width.
      requestAnimationFrame(() => (el.scrollLeft = next.scrollLeftPx));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scrollRef]);
}

/** True for inputs, text areas, selects and contenteditable: keys there belong to the field. */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}

/**
 * Binds the default editor keys (see `matchEditorShortcut`) on `window`,
 * limited to `actions`. Keys typed into text fields are left alone.
 */
export function useEditorShortcuts(actions: readonly EditorAction[] = ["delete", "split", "undo", "redo"]): void {
  const project = useProject();
  const key = actions.join(",");
  useEffect(() => {
    const enabled = new Set(key.split(",") as EditorAction[]);
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return;
      const action = matchEditorShortcut(e);
      if (!action || !enabled.has(action)) return;
      if (runEditorAction(project, action)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project, key]);
}

/** Start a live edit that lands in history as one entry (see `beginGesture`). */
export function useGesture(): (label: string) => Gesture {
  const project: Project = useProject();
  return (label) => beginGesture(project, label);
}
