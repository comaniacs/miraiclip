import {
  createContext,
  forwardRef,
  Fragment,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { clipSpeed, type Clip, type Track, type Us } from "@miraiclip/core";
import {
  beginClipDrag,
  clipsInRange,
  formatClock,
  pxToUs,
  trackCuts,
  usToPx,
  type ClipDrag,
  type ClipDragMode,
  type ClipDragPreview,
  type TrackCut,
} from "@miraiclip/editor";
import { useProject } from "../project.js";
import { usePlayback } from "../playback.js";
import { useClips, useCommands, useDurationUs, useSelection, useTransitions } from "../state.js";
import { useCompositorPlayhead, usePlayheadFollow, useTimelineZoom, useVisibleRange, type PlayheadFollow } from "../timeline.js";
import { flag, renderChildren, useMergedRef, type RenderChildren } from "./utils.js";

/*
 * <Timeline.*>: unstyled timeline parts. They own the behaviour — layout in
 * time, virtualised lanes, clip drag and trim with snapping, ruler seeking,
 * the compositor-driven playhead — and expose state as data attributes
 * (`data-selected`, `data-dragging`, `data-locked`, …) for your CSS.
 *
 * <Timeline.Root pxPerSecond={…}>
 *   <Timeline.Viewport>                     ← the scroll container
 *     <Timeline.Ruler />                    ← click/drag to seek
 *     {tracks.map((t) => (
 *       <Timeline.Track key={t.id} track={t}>
 *         <Timeline.TrackHeader>…</Timeline.TrackHeader>
 *         <Timeline.Lane>{(clip) => <Timeline.Clip clip={clip}>…</Timeline.Clip>}</Timeline.Lane>
 *       </Timeline.Track>
 *     ))}
 *   </Timeline.Viewport>
 * </Timeline.Root>
 *
 * Needs <ProjectProvider> and <PlaybackProvider> above it.
 */

// ---------------------------------------------------------------- contexts

export interface TimelineContextValue {
  pxPerSecond: number;
  /** Width of the sticky header column inside the viewport, in px. */
  headerWidth: number;
  /** Scrollable length of the timeline. */
  lengthUs: Us;
  /** The scroll container (set by <Timeline.Viewport>). */
  viewportRef: RefObject<HTMLDivElement | null>;
  /** Timeline time under a viewport x (clamped at 0). */
  usAtClientX: (clientX: number) => Us;
  /** Start dragging a clip from a pointer event (what <Timeline.Clip> and <Timeline.TrimHandle> call). */
  beginClipDrag: (event: ReactPointerEvent, clip: Clip, mode: ClipDragMode) => void;
}

const TimelineContext = createContext<TimelineContextValue | null>(null);
const RangeContext = createContext<{ fromUs: Us; toUs: Us }>({ fromUs: 0, toUs: 0 });
const DragContext = createContext<ClipDragPreview | null>(null);
const TrackContext = createContext<Track | null>(null);
const ClipContext = createContext<TimelineClipState | null>(null);

/** The timeline's scale, layout and drag entry point. Use inside <Timeline.Root>. */
export function useTimeline(): TimelineContextValue {
  const ctx = useContext(TimelineContext);
  if (!ctx) throw new Error("useTimeline must be used within <Timeline.Root>");
  return ctx;
}

/** The time range the viewport shows (plus a margin), for virtualising custom rows. */
export function useTimelineRange(): { fromUs: Us; toUs: Us } {
  return useContext(RangeContext);
}

/** The clip being dragged, as it would land now; null when no drag is in progress. */
export function useTimelineDrag(): ClipDragPreview | null {
  return useContext(DragContext);
}

/** The track of the enclosing <Timeline.Track>. */
export function useTimelineTrack(): Track {
  const track = useContext(TrackContext);
  if (!track) throw new Error("useTimelineTrack must be used within <Timeline.Track>");
  return track;
}

/** State of the enclosing <Timeline.Clip>, live while it is dragged. */
export function useTimelineClip(): TimelineClipState {
  const clip = useContext(ClipContext);
  if (!clip) throw new Error("useTimelineClip must be used within <Timeline.Clip>");
  return clip;
}

type DivProps = Omit<HTMLAttributes<HTMLDivElement>, "children">;

// ---------------------------------------------------------------- Root

export interface TimelineRootProps extends DivProps {
  /** Zoom: horizontal pixels per second. */
  pxPerSecond: number;
  /** Called by Ctrl/⌘ + wheel zoom (around the pointer). Leave out to disable wheel zoom. */
  onPxPerSecondChange?: (pxPerSecond: number) => void;
  minPxPerSecond?: number;
  maxPxPerSecond?: number;
  /** Width of a sticky header column at the left of the viewport (default 0). */
  headerWidth?: number;
  /** Scrollable length. Default: the composition plus 5 s, at least 10 s. */
  lengthUs?: Us;
  /** Clip edges snap within this many pixels (default 8; 0 turns snapping off). */
  snapPx?: number;
  children?: ReactNode;
}

interface ActiveDrag {
  drag: ClipDrag;
  startClientX: number;
  lanes: { trackId: string; top: number; bottom: number }[];
}

const Root = forwardRef<HTMLDivElement, TimelineRootProps>(function TimelineRoot(
  {
    pxPerSecond,
    onPxPerSecondChange,
    minPxPerSecond = 4,
    maxPxPerSecond = 400,
    headerWidth = 0,
    lengthUs,
    snapPx = 8,
    children,
    ...rest
  },
  forwardedRef,
) {
  const project = useProject();
  const commands = useCommands();
  const durationUs = useDurationUs();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const ref = useMergedRef(forwardedRef, rootRef);
  const [drag, setDrag] = useState<ClipDragPreview | null>(null);
  const active = useRef<ActiveDrag | null>(null);
  const latest = useRef({ pxPerSecond, snapPx });
  latest.current = { pxPerSecond, snapPx };

  const range = useVisibleRange(viewportRef, pxPerSecond, headerWidth);
  useTimelineZoom(viewportRef, {
    pxPerSecond,
    setPxPerSecond: (v) => onPxPerSecondChange?.(v),
    minPxPerSecond,
    maxPxPerSecond,
    headerWidthPx: headerWidth,
    enabled: !!onPxPerSecondChange,
  });

  const usAtClientX = useCallback(
    (clientX: number) => {
      const el = viewportRef.current;
      if (!el) return 0;
      const x = clientX - el.getBoundingClientRect().left + el.scrollLeft - headerWidth;
      return Math.max(0, pxToUs(x, latest.current.pxPerSecond));
    },
    [headerWidth],
  );

  const beginDrag = useCallback(
    (event: ReactPointerEvent, clip: Clip, mode: ClipDragMode) => {
      event.stopPropagation();
      event.preventDefault();
      commands.select([clip.id]);
      const clipDrag = beginClipDrag(project, clip.id, mode, {
        snapThresholdUs: pxToUs(latest.current.snapPx, latest.current.pxPerSecond),
      });
      if (!clipDrag) return; // locked track: select only

      const lanes = Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-timeline-lane]") ?? []).map((el) => {
        const r = el.getBoundingClientRect();
        return { trackId: el.dataset.trackId!, top: r.top, bottom: r.bottom };
      });
      active.current = { drag: clipDrag, startClientX: event.clientX, lanes };
      setDrag(clipDrag.preview);

      const onMove = (e: PointerEvent) => {
        const a = active.current;
        if (!a) return;
        const lane = a.lanes.find((l) => e.clientY >= l.top && e.clientY <= l.bottom);
        setDrag(a.drag.update(pxToUs(e.clientX - a.startClientX, latest.current.pxPerSecond), lane?.trackId));
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
        const a = active.current;
        active.current = null;
        a?.drag.commit();
        setDrag(null);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    },
    [project, commands],
  );

  const length = lengthUs ?? Math.max(10_000_000, durationUs + 5_000_000);
  const value = useMemo<TimelineContextValue>(
    () => ({ pxPerSecond, headerWidth, lengthUs: length, viewportRef, usAtClientX, beginClipDrag: beginDrag }),
    [pxPerSecond, headerWidth, length, usAtClientX, beginDrag],
  );

  return (
    <TimelineContext.Provider value={value}>
      <RangeContext.Provider value={range}>
        <DragContext.Provider value={drag}>
          <div ref={ref} data-timeline="" data-dragging={drag ? drag.mode : undefined} {...rest}>
            {children}
          </div>
        </DragContext.Provider>
      </RangeContext.Provider>
    </TimelineContext.Provider>
  );
});

// ---------------------------------------------------------------- Viewport

export interface TimelineViewportProps extends DivProps {
  /** Props for the inner element sized to the timeline's length. */
  contentProps?: DivProps;
  children?: ReactNode;
}

/** The scroll container (both axes). Its content is as wide as the header column plus the timeline. */
const Viewport = forwardRef<HTMLDivElement, TimelineViewportProps>(function TimelineViewport(
  { contentProps, style, children, ...rest },
  forwardedRef,
) {
  const { viewportRef, headerWidth, lengthUs, pxPerSecond } = useTimeline();
  const ref = useMergedRef(forwardedRef, viewportRef);
  return (
    <div ref={ref} data-timeline-viewport="" style={{ position: "relative", overflow: "auto", ...style }} {...rest}>
      <div
        data-timeline-content=""
        {...contentProps}
        style={{ position: "relative", width: headerWidth + usToPx(lengthUs, pxPerSecond), minHeight: "100%", ...contentProps?.style }}
      >
        {children}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------- Ruler

export interface RulerTick {
  us: Us;
  /** Offset from the ruler's left edge, px. */
  x: number;
  /** `formatClock(us)`. */
  label: string;
}

export interface TimelineRulerProps extends DivProps {
  /** Tick spacing: a fixed step, or one picked from the zoom. Default: the smallest step at least 60 px apart. */
  stepUs?: Us | ((pxPerSecond: number) => Us);
  /** Render one tick. Default: an absolutely placed `<span data-tick>` with the clock label. */
  renderTick?: (tick: RulerTick) => ReactNode;
  /** Extra content after the ticks (a <Timeline.Playhead> knob, markers). */
  children?: ReactNode;
}

const NICE_STEPS_S = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];

/** Smallest "nice" tick step that keeps ticks at least `minGapPx` apart. */
export function rulerStepUs(pxPerSecond: number, minGapPx = 60): Us {
  for (const s of NICE_STEPS_S) if (s * pxPerSecond >= minGapPx) return s * 1_000_000;
  return NICE_STEPS_S[NICE_STEPS_S.length - 1]! * 1_000_000;
}

/** Time ruler for the lanes area: ticks across the visible range only; press or drag to seek. */
const Ruler = forwardRef<HTMLDivElement, TimelineRulerProps>(function TimelineRuler(
  { stepUs, renderTick, children, style, onPointerDown, onPointerMove, ...rest },
  forwardedRef,
) {
  const { pxPerSecond, lengthUs } = useTimeline();
  const range = useTimelineRange();
  const { seek } = usePlayback();
  const step = Math.max(1, typeof stepUs === "function" ? stepUs(pxPerSecond) : (stepUs ?? rulerStepUs(pxPerSecond)));

  const ticks: RulerTick[] = [];
  const last = Math.min(lengthUs, range.toUs);
  for (let us = Math.max(0, Math.floor(range.fromUs / step) * step); us <= last; us += step) {
    ticks.push({ us, x: usToPx(us, pxPerSecond), label: formatClock(us) });
  }

  const seekAt = (e: ReactPointerEvent<HTMLDivElement>) => {
    const left = e.currentTarget.getBoundingClientRect().left;
    seek(Math.max(0, pxToUs(e.clientX - left, pxPerSecond)));
  };

  return (
    <div
      ref={forwardedRef}
      data-timeline-ruler=""
      style={{ position: "relative", touchAction: "none", ...style }}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        if (e.defaultPrevented || e.button !== 0) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        seekAt(e);
      }}
      onPointerMove={(e) => {
        onPointerMove?.(e);
        if (!e.defaultPrevented && e.buttons === 1) seekAt(e);
      }}
      {...rest}
    >
      {ticks.map((tick) => (
        <Fragment key={tick.us}>
          {renderTick ? (
            renderTick(tick)
          ) : (
            <span data-tick="" style={{ position: "absolute", left: tick.x, pointerEvents: "none" }}>
              {tick.label}
            </span>
          )}
        </Fragment>
      ))}
      {children}
    </div>
  );
});

// ---------------------------------------------------------------- Track

export interface TimelineTrackProps extends DivProps {
  track: Track;
  children?: ReactNode;
}

/** One row: usually a <Timeline.TrackHeader> and a <Timeline.Lane>. */
const TrackRow = forwardRef<HTMLDivElement, TimelineTrackProps>(function TimelineTrack({ track, style, children, ...rest }, ref) {
  return (
    <TrackContext.Provider value={track}>
      <div
        ref={ref}
        data-timeline-track=""
        data-kind={track.kind}
        data-locked={flag(track.locked)}
        data-muted={flag(track.muted)}
        data-hidden={flag(track.hidden)}
        style={{ display: "flex", ...style }}
        {...rest}
      >
        {children}
      </div>
    </TrackContext.Provider>
  );
});

/** The track's header cell: sticks to the left edge while the lanes scroll, `headerWidth` wide. */
const TrackHeader = forwardRef<HTMLDivElement, DivProps & { children?: ReactNode }>(function TimelineTrackHeader(
  { style, children, ...rest },
  ref,
) {
  const { headerWidth } = useTimeline();
  return (
    <div
      ref={ref}
      data-timeline-track-header=""
      style={{ position: "sticky", left: 0, zIndex: 2, width: headerWidth, flexShrink: 0, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
});

// ---------------------------------------------------------------- Lane

export interface TimelineLaneProps extends DivProps {
  /** Render one clip (usually a <Timeline.Clip>). Called only for clips in the visible range, plus a dragged clip. */
  children: (clip: Clip) => ReactNode;
  /** Clicking the empty lane clears the selection (default true). */
  deselectOnClick?: boolean;
  /** Extra content after the clips (cut markers, drop indicators). */
  overlay?: ReactNode;
}

/**
 * The track's clips over time. Only clips overlapping the visible range are
 * rendered, so a lane costs what is on screen, not the project's length.
 * `data-drop-target` is set while a clip from another track is dragged over it.
 */
const Lane = forwardRef<HTMLDivElement, TimelineLaneProps>(function TimelineLane(
  { children, deselectOnClick = true, overlay, style, onClick, ...rest },
  ref,
) {
  const track = useTimelineTrack();
  const allClips = useClips(track.id);
  const range = useTimelineRange();
  const drag = useTimelineDrag();
  const commands = useCommands();
  const draggedId = drag?.clipId;
  const clips = useMemo(() => {
    const inRange = clipsInRange(allClips, range.fromUs, range.toUs);
    if (draggedId && !inRange.some((c) => c.id === draggedId)) {
      const dragged = allClips.find((c) => c.id === draggedId);
      if (dragged) inRange.push(dragged);
    }
    return inRange;
  }, [allClips, range.fromUs, range.toUs, draggedId]);
  const dropTarget = !!drag && drag.trackId === track.id && drag.originTrackId !== track.id;

  return (
    <div
      ref={ref}
      data-timeline-lane=""
      data-track-id={track.id}
      data-drop-target={flag(dropTarget)}
      style={{ position: "relative", flex: "1 1 0%", ...style }}
      // A click (not pointerdown): on touch, a swipe that scrolls the timeline must not deselect.
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && deselectOnClick && e.target === e.currentTarget) commands.select([]);
      }}
      {...rest}
    >
      {clips.map((clip) => (
        <Fragment key={clip.id}>{children(clip)}</Fragment>
      ))}
      {overlay}
    </div>
  );
});

// ---------------------------------------------------------------- Clip

export interface TimelineClipState {
  clip: Clip;
  /** Live position: the drag preview while this clip is dragged, else the clip's own. */
  startUs: Us;
  durationUs: Us;
  /** Media in-point, live while trimming the start (0 for clips without media). */
  trimStartUs: Us;
  selected: boolean;
  /** What the current drag does to this clip, or null. */
  dragging: ClipDragMode | null;
  /** On a locked track: selectable, not draggable. */
  locked: boolean;
}

export interface TimelineClipProps extends DivProps {
  clip: Clip;
  /** Pixels taken off the left edge (a gap between neighbouring clips; default 0). */
  insetPx?: number;
  /** Narrowest drawn width, px (default 2). */
  minWidthPx?: number;
  children?: RenderChildren<TimelineClipState>;
}

/**
 * A clip, placed at its time. Press and drag to move it (across tracks too);
 * click selects. On touch, the first tap selects and a swipe scrolls; once
 * selected, a drag moves it. Snapping, the minimum length and the single
 * undo step on release come from @miraiclip/editor's `beginClipDrag`.
 */
const ClipItem = forwardRef<HTMLDivElement, TimelineClipProps>(function TimelineClip(
  { clip, insetPx = 0, minWidthPx = 2, children, style, onPointerDown, onClick, ...rest },
  ref,
) {
  const { pxPerSecond, beginClipDrag: begin } = useTimeline();
  const drag = useTimelineDrag();
  const selection = useSelection();
  const commands = useCommands();
  const track = useContext(TrackContext);
  const selected = selection.includes(clip.id);
  const dragging = drag?.clipId === clip.id ? drag : null;
  const startUs = dragging ? dragging.startUs : clip.startUs;
  const durationUs = dragging ? dragging.durationUs : clip.durationUs;
  const baseTrim = "trimStartUs" in clip ? clip.trimStartUs : 0;
  const trimStartUs =
    dragging?.mode === "trim-start" ? Math.max(0, baseTrim + Math.round((startUs - clip.startUs) * clipSpeed(clip))) : baseTrim;
  const locked = !!track?.locked;

  const state: TimelineClipState = {
    clip,
    startUs,
    durationUs,
    trimStartUs,
    selected,
    dragging: dragging ? dragging.mode : null,
    locked,
  };
  const left = usToPx(startUs, pxPerSecond);
  const width = Math.max(minWidthPx, usToPx(durationUs, pxPerSecond) - insetPx);

  return (
    <ClipContext.Provider value={state}>
      <div
        ref={ref}
        data-timeline-clip=""
        data-clip-id={clip.id}
        data-kind={clip.kind}
        data-selected={flag(selected)}
        data-dragging={dragging?.mode}
        data-locked={flag(locked)}
        style={{
          position: "absolute",
          left: left + insetPx,
          width,
          touchAction: selected ? "none" : undefined,
          ...style,
        }}
        onPointerDown={(e) => {
          onPointerDown?.(e);
          if (e.defaultPrevented || e.button !== 0) return;
          if (e.pointerType === "touch" && !selected) return;
          begin(e, clip, "move");
        }}
        onClick={(e) => {
          onClick?.(e);
          if (!e.defaultPrevented && !selected) commands.select([clip.id]);
        }}
        {...rest}
      >
        {renderChildren(children, state)}
      </div>
    </ClipContext.Provider>
  );
});

export interface TimelineTrimHandleProps extends DivProps {
  /** Which edge it trims. */
  side: "start" | "end";
  children?: ReactNode;
}

/** Drag handle on a clip's edge that trims it. Place inside <Timeline.Clip>. */
const TrimHandle = forwardRef<HTMLDivElement, TimelineTrimHandleProps>(function TimelineTrimHandle(
  { side, style, onPointerDown, children, ...rest },
  ref,
) {
  const { beginClipDrag: begin } = useTimeline();
  const { clip, selected, dragging } = useTimelineClip();
  const mode: ClipDragMode = side === "start" ? "trim-start" : "trim-end";
  return (
    <div
      ref={ref}
      role="presentation"
      aria-label={side === "start" ? "Trim start" : "Trim end"}
      data-timeline-trim-handle=""
      data-side={side}
      data-active={flag(dragging === mode)}
      style={{
        position: "absolute",
        top: 0,
        height: "100%",
        [side === "start" ? "left" : "right"]: 0,
        cursor: "col-resize",
        touchAction: "none",
        ...style,
      }}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        if (e.defaultPrevented || e.button !== 0) return;
        if (e.pointerType === "touch" && !selected) return;
        begin(e, clip, mode);
      }}
      {...rest}
    >
      {children}
    </div>
  );
});

// ---------------------------------------------------------------- Playhead

/**
 * The playhead, moved by the compositor (no re-render or style recalc per
 * frame). Absolutely placed at its parent's left edge, so put it inside the
 * ruler, or inside a positioned layer that starts where the lanes start.
 */
const Playhead = forwardRef<HTMLDivElement, DivProps & { children?: ReactNode }>(function TimelinePlayhead(
  { style, children, ...rest },
  forwardedRef,
) {
  const { pxPerSecond } = useTimeline();
  const own = useRef<HTMLDivElement | null>(null);
  const ref = useMergedRef(forwardedRef, own);
  useCompositorPlayhead(own, (us) => `translateX(${usToPx(us, pxPerSecond)}px)`, [pxPerSecond]);
  return (
    <div
      ref={ref}
      data-timeline-playhead=""
      style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", willChange: "transform", ...style }}
      {...rest}
    >
      {children}
    </div>
  );
});

// ---------------------------------------------------------------- Cuts

export interface TimelineCut extends TrackCut {
  /** Offset of the cut from the lane's left edge, px. */
  x: number;
}

export interface TimelineCutsProps {
  /** Render one cut. Only cuts in the visible range are passed. */
  children: (cut: TimelineCut) => ReactNode;
  /** Hide cut markers while a clip is dragged (default true). */
  hideWhileDragging?: boolean;
}

/**
 * The track's cuts (one visual clip ending exactly where the next starts —
 * where a transition can go), with the transition on each. Place inside a
 * <Timeline.Track>, usually as a lane's `overlay`.
 */
function Cuts({ children, hideWhileDragging = true }: TimelineCutsProps) {
  const track = useTimelineTrack();
  const clips = useClips(track.id);
  const transitions = useTransitions(track.id);
  const { pxPerSecond } = useTimeline();
  const range = useTimelineRange();
  const drag = useTimelineDrag();
  const all = useMemo(() => trackCuts(clips, transitions), [clips, transitions]);
  if (hideWhileDragging && drag) return null;
  return (
    <>
      {all
        .filter((cut) => cut.atUs >= range.fromUs && cut.atUs < range.toUs)
        .map((cut) => (
          <Fragment key={`${cut.from.id}>${cut.to.id}`}>{children({ ...cut, x: usToPx(cut.atUs, pxPerSecond) })}</Fragment>
        ))}
    </>
  );
}

// ---------------------------------------------------------------- PlayheadFollow

/**
 * Keeps the playhead in view while playing (pausing after a manual scroll),
 * and renders `children` with where the playhead is when it is off screen —
 * for a "jump to playhead" indicator. Render it once inside <Timeline.Root>;
 * it re-renders on its own, never the timeline.
 */
function PlayheadFollowPart({ children }: { children?: (follow: PlayheadFollow) => ReactNode }) {
  const { viewportRef, pxPerSecond, headerWidth } = useTimeline();
  const follow = usePlayheadFollow(viewportRef, pxPerSecond, headerWidth);
  return <>{children?.(follow) ?? null}</>;
}

// ---------------------------------------------------------------- export

/** Unstyled timeline parts. See the module comment for the structure. */
export const Timeline = {
  Root,
  Viewport,
  Ruler,
  Track: TrackRow,
  TrackHeader,
  Lane,
  Clip: ClipItem,
  TrimHandle,
  Playhead,
  Cuts,
  PlayheadFollow: PlayheadFollowPart,
};
