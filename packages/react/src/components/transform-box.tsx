import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SVGProps,
} from "react";
import type { Clip } from "@miraiclip/core";
import {
  beginTransformDrag,
  canTransformClip,
  cornerCursor,
  nudgeClip,
  rotateHandlePosition,
  type TransformDrag,
  type TransformDragMode,
  type TransformGuides,
} from "@miraiclip/editor";
import type { ClipBounds } from "@miraiclip/renderer";
import { useProject } from "../project.js";
import { usePlayback } from "../playback.js";
import { useCommands, useSelection } from "../state.js";
import { isEditableTarget } from "../timeline.js";
import { usePreview } from "./preview.js";
import { flag, useMergedRef } from "./utils.js";

/*
 * <TransformBox.*>: move, scale and rotate the selected clip on the preview.
 * Place inside <Preview> (it reads the preview's size and scale). The parts
 * render only while the preview is live; the geometry and the edits (one
 * undo step per drag, keyframes at the playhead for animated properties)
 * come from @miraiclip/editor's `beginTransformDrag`.
 *
 * <Preview>
 *   <TransformBox.Root>
 *     <TransformBox.Outline target="hover" />
 *     <TransformBox.Guides />
 *     <TransformBox.Outline />
 *     <TransformBox.Body />
 *     {[0, 1, 2, 3].map((i) => <TransformBox.Handle key={i} corner={i} />)}
 *     <TransformBox.RotateLine /><TransformBox.RotateHandle />
 *   </TransformBox.Root>
 * </Preview>
 */

export interface TransformBoxState {
  /** The selected clip's bounds (composition px), when one visual clip is selected and drawn. */
  box: ClipBounds | null;
  /** The clip under the pointer, when it isn't the selection. */
  hover: ClipBounds | null;
  /** Frame lines the current move snapped to (composition px). */
  guides: TransformGuides;
  /** True when the selected clip can be edited (visual, track not locked). */
  editable: boolean;
  /** The drag in progress, if any. */
  dragging: TransformDragMode | null;
  /** Screen px per composition px. */
  scale: number;
  width: number;
  height: number;
  /** Start a drag on the selected box (what the handles call). */
  startDrag: (event: ReactPointerEvent, mode: TransformDragMode) => void;
}

const BoxContext = createContext<TransformBoxState | null>(null);

/** State of the enclosing <TransformBox.Root>, for custom handles and drawing. */
export function useTransformBox(): TransformBoxState {
  const ctx = useContext(BoxContext);
  if (!ctx) throw new Error("useTransformBox must be used within <TransformBox.Root>");
  return ctx;
}

export interface TransformBoxRootProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Move snapping to the frame's edges and center, in screen px (default 6; 0 turns it off). Alt places freely. */
  snapPx?: number;
  /** Movement below this many screen px is a click (default 2). */
  dragThresholdPx?: number;
  /** Arrow keys nudge the selection 1 px (Shift: 10 px) (default true). */
  nudge?: boolean;
  /** Which clips a click can pick. Default: visual clips on unlocked tracks. */
  canSelect?: (clip: Clip) => boolean;
  /** Double-click on a clip (e.g. open its text editor). */
  onClipDoubleClick?: (clipId: string) => void;
  children?: ReactNode;
}

interface Active {
  drag: TransformDrag;
  pointerId: number;
}

const NO_GUIDES: TransformGuides = { x: [], y: [] };

/**
 * The interaction layer (`position: absolute; inset: 0`). Click picks the
 * topmost clip; dragging it moves it right away. `data-dragging` carries the
 * current drag ("move", "scale", "rotate").
 */
const Root = forwardRef<HTMLDivElement, TransformBoxRootProps>(function TransformBoxRoot(
  { snapPx = 6, dragThresholdPx = 2, nudge = true, canSelect, onClipDoubleClick, style, children, ...rest },
  forwardedRef,
) {
  const project = useProject();
  const commands = useCommands();
  const selection = useSelection();
  const { getClipBounds, hitTest } = usePlayback();
  const { width, height, scale, mode } = usePreview();
  const own = useRef<HTMLDivElement | null>(null);
  const ref = useMergedRef(forwardedRef, own);
  const selectedId = selection.length === 1 ? selection[0]! : null;
  const live = mode === "live";

  const [box, setBox] = useState<ClipBounds | null>(null);
  const [hover, setHover] = useState<ClipBounds | null>(null);
  const [guides, setGuides] = useState<TransformGuides>(NO_GUIDES);
  const [dragging, setDragging] = useState<TransformDragMode | null>(null);
  const active = useRef<Active | null>(null);

  const selectable = useCallback(
    (clip: Clip) => (canSelect ? canSelect(clip) : canTransformClip(project, clip.id)),
    [canSelect, project],
  );

  // Follow the selected clip's bounds. Polled per frame (playback, keyframes
  // and async rasters move it without a store change); state changes only
  // when the box moved.
  useEffect(() => {
    if (!selectedId || !live) {
      setBox(null);
      return;
    }
    let raf = 0;
    let last = "";
    const loop = () => {
      const b = getClipBounds(selectedId);
      const key = b ? b.corners.map((p) => `${p.xPx.toFixed(1)},${p.yPx.toFixed(1)}`).join(" ") : "";
      if (key !== last) {
        last = key;
        setBox(b);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [selectedId, live, getClipBounds]);

  const toComp = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const r = own.current!.getBoundingClientRect();
      return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
    },
    [scale],
  );

  const begin = useCallback(
    (e: ReactPointerEvent, dragMode: TransformDragMode, bounds: ClipBounds) => {
      const drag = beginTransformDrag(project, bounds, dragMode, toComp(e), {
        snapThresholdPx: snapPx / scale,
        dragThresholdPx: dragThresholdPx / scale,
      });
      if (!drag) return;
      e.stopPropagation();
      e.preventDefault();
      own.current?.setPointerCapture?.(e.pointerId);
      active.current = { drag, pointerId: e.pointerId };
      setDragging(dragMode);
    },
    [project, toComp, snapPx, dragThresholdPx, scale],
  );

  const startDrag = useCallback(
    (e: ReactPointerEvent, dragMode: TransformDragMode) => {
      if (e.button !== 0 || !box) return;
      begin(e, dragMode, box);
    },
    [begin, box],
  );

  const end = () => {
    const a = active.current;
    if (!a) return;
    active.current = null;
    a.drag.end();
    setGuides(NO_GUIDES);
    setDragging(null);
    own.current?.releasePointerCapture?.(a.pointerId);
  };

  // Arrow-key nudges (not while typing in a field).
  useEffect(() => {
    if (!nudge || !selectedId || !live) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.key.startsWith("Arrow") || isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return;
      const b = getClipBounds(selectedId);
      if (!b) return;
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      if (nudgeClip(project, b, dx, dy)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nudge, selectedId, live, project, getClipBounds]);

  const selectedClip = selectedId ? project.getState().doc.clips[selectedId] : undefined;
  const editable = !!box && !!selectedClip && canTransformClip(project, selectedClip.id);

  const state = useMemo<TransformBoxState>(
    () => ({ box, hover, guides, editable, dragging, scale, width, height, startDrag }),
    [box, hover, guides, editable, dragging, scale, width, height, startDrag],
  );

  if (!live) return null;

  return (
    <BoxContext.Provider value={state}>
      <div
        ref={ref}
        data-transform-box=""
        data-dragging={dragging ?? undefined}
        style={{ position: "absolute", inset: 0, touchAction: "none", userSelect: "none", ...style }}
        onPointerDown={(e) => {
          rest.onPointerDown?.(e);
          if (e.defaultPrevented || e.button !== 0) return;
          const p = toComp(e);
          const id = hitTest(p.x, p.y, selectable);
          if (!id) {
            commands.select([]);
            return;
          }
          if (id !== selectedId) commands.select([id]);
          const b = getClipBounds(id);
          if (b) begin(e, "move", b);
        }}
        onPointerMove={(e) => {
          rest.onPointerMove?.(e);
          const a = active.current;
          if (a) {
            setGuides(a.drag.update(toComp(e), { altKey: e.altKey, shiftKey: e.shiftKey }));
            return;
          }
          const p = toComp(e);
          const id = hitTest(p.x, p.y, selectable);
          const next = id && id !== selectedId ? getClipBounds(id) : null;
          setHover((prev) => (prev?.clipId === next?.clipId ? prev : next));
        }}
        onPointerUp={(e) => {
          rest.onPointerUp?.(e);
          end();
        }}
        onPointerCancel={(e) => {
          rest.onPointerCancel?.(e);
          end();
        }}
        onPointerLeave={(e) => {
          rest.onPointerLeave?.(e);
          if (!active.current) setHover(null);
        }}
        onDoubleClick={(e) => {
          rest.onDoubleClick?.(e);
          if (!onClipDoubleClick) return;
          const p = toComp(e);
          const id = hitTest(p.x, p.y, selectable);
          if (id) onClipDoubleClick(id);
        }}
        {...omitHandlers(rest)}
      >
        {children}
      </div>
    </BoxContext.Provider>
  );
});

const HANDLERS = ["onPointerDown", "onPointerMove", "onPointerUp", "onPointerCancel", "onPointerLeave", "onDoubleClick"] as const;
function omitHandlers<T extends object>(props: T): T {
  const out = { ...props } as Record<string, unknown>;
  for (const h of HANDLERS) delete out[h];
  return out as T;
}

// ---------------------------------------------------------------- drawing parts

const svgStyle = { position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" } as const;

function points(b: ClipBounds, scale: number): string {
  return b.corners.map((c) => `${c.xPx * scale},${c.yPx * scale}`).join(" ");
}

export interface TransformBoxOutlineProps extends SVGProps<SVGPolygonElement> {
  /** The selected clip (default) or the clip under the pointer. */
  target?: "selection" | "hover";
}

/** The outline of the selected (or hovered) clip, as an SVG polygon. Style it with `stroke` / `className`. */
function Outline({ target = "selection", ...polygon }: TransformBoxOutlineProps) {
  const { box, hover, scale, width, height } = useTransformBox();
  const b = target === "hover" ? hover : box;
  if (!b) return null;
  return (
    <svg data-transform-outline={target} style={svgStyle} width={width} height={height}>
      <polygon points={points(b, scale)} fill="none" {...polygon} />
    </svg>
  );
}

/** Snapping guides while moving: full-height and full-width lines. Props go to each `<line>`. */
function Guides(line: SVGProps<SVGLineElement>) {
  const { guides, scale, width, height } = useTransformBox();
  if (!guides.x.length && !guides.y.length) return null;
  return (
    <svg data-transform-guides="" style={svgStyle} width={width} height={height}>
      {guides.x.map((x) => (
        <line key={`x${x}`} x1={x * scale} y1={0} x2={x * scale} y2={height} {...line} />
      ))}
      {guides.y.map((y) => (
        <line key={`y${y}`} x1={0} y1={y * scale} x2={width} y2={y * scale} {...line} />
      ))}
    </svg>
  );
}

/** The selected clip's area as a drag target (move), under the handles. Only while editable. */
function Body(polygon: SVGProps<SVGPolygonElement>) {
  const { box, editable, scale, width, height, startDrag, dragging } = useTransformBox();
  if (!box || !editable) return null;
  return (
    <svg data-transform-body="" style={svgStyle} width={width} height={height}>
      <polygon
        points={points(box, scale)}
        fill="transparent"
        style={{ pointerEvents: "all", cursor: dragging === "move" ? "grabbing" : "move" }}
        onPointerDown={(e) => startDrag(e, "move")}
        {...polygon}
      />
    </svg>
  );
}

type HandleProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & { children?: ReactNode };

/** A corner handle (0 top-left, clockwise) that scales uniformly. Centered on the corner; size it with CSS. */
const Handle = forwardRef<HTMLDivElement, HandleProps & { corner: 0 | 1 | 2 | 3 }>(function TransformBoxHandle(
  { corner, style, children, ...rest },
  ref,
) {
  const { box, editable, scale, startDrag, dragging } = useTransformBox();
  if (!box || !editable) return null;
  const c = box.corners[corner];
  return (
    <div
      ref={ref}
      role="presentation"
      data-transform-handle=""
      data-corner={corner}
      data-active={flag(dragging === "scale")}
      style={{
        position: "absolute",
        left: c.xPx * scale,
        top: c.yPx * scale,
        transform: "translate(-50%, -50%)",
        cursor: cornerCursor(corner, box.rotationDeg),
        ...style,
      }}
      onPointerDown={(e) => startDrag(e, "scale")}
      {...rest}
    >
      {children}
    </div>
  );
});

/** The rotate handle, `distance` screen px beyond the top edge (default 26). Shift: 15° steps. */
const RotateHandle = forwardRef<HTMLDivElement, HandleProps & { distance?: number }>(function TransformBoxRotateHandle(
  { distance = 26, style, children, ...rest },
  ref,
) {
  const { box, editable, scale, startDrag, dragging } = useTransformBox();
  if (!box || !editable) return null;
  const { handle } = rotateHandlePosition(box, distance / scale);
  return (
    <div
      ref={ref}
      role="presentation"
      data-transform-rotate=""
      data-active={flag(dragging === "rotate")}
      style={{
        position: "absolute",
        left: handle.xPx * scale,
        top: handle.yPx * scale,
        transform: "translate(-50%, -50%)",
        cursor: dragging === "rotate" ? "grabbing" : "grab",
        ...style,
      }}
      onPointerDown={(e) => startDrag(e, "rotate")}
      {...rest}
    >
      {children}
    </div>
  );
});

/** The line from the top edge to the rotate handle. Props go to the `<line>`. */
function RotateLine({ distance = 26, ...line }: SVGProps<SVGLineElement> & { distance?: number }) {
  const { box, editable, scale, width, height } = useTransformBox();
  if (!box || !editable) return null;
  const { handle, anchor } = rotateHandlePosition(box, distance / scale);
  return (
    <svg data-transform-rotate-line="" style={svgStyle} width={width} height={height}>
      <line x1={anchor.xPx * scale} y1={anchor.yPx * scale} x2={handle.xPx * scale} y2={handle.yPx * scale} {...line} />
    </svg>
  );
}

/** Unstyled transform-box parts for the preview. See the module comment for the structure. */
export const TransformBox = { Root, Outline, Guides, Body, Handle, RotateHandle, RotateLine };
