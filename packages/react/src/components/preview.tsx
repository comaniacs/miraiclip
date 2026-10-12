import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CanvasHTMLAttributes,
  type HTMLAttributes,
} from "react";
import type { PreviewMode } from "@miraiclip/renderer";
import { usePlayback } from "../playback.js";
import { useSettings } from "../state.js";
import { flag, renderChildren, useMergedRef, type RenderChildren } from "./utils.js";

export interface PreviewState {
  /** CSS size of the canvas, px. */
  width: number;
  height: number;
  /** Screen px per composition px. */
  scale: number;
  /** "live" (renderer drawing), "fallback" (clock only) or "unsupported" (no WebCodecs). */
  mode: PreviewMode;
  lastError: string | null;
}

const PreviewContext = createContext<PreviewState | null>(null);

/** Size and status of the enclosing <Preview>, for overlays. */
export function usePreview(): PreviewState {
  const ctx = useContext(PreviewContext);
  if (!ctx) throw new Error("usePreview must be used within <Preview>");
  return ctx;
}

export interface PreviewProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /**
   * CSS size of the canvas. Give both for a fixed size; leave both out to
   * fit the composition's aspect inside the parent element (measured live).
   */
  width?: number;
  height?: number;
  /** Fit mode only: space kept free around the preview inside the parent, px (default 0). */
  fitPadding?: number;
  /** Props for the `<canvas>`. */
  canvasProps?: CanvasHTMLAttributes<HTMLCanvasElement>;
  /** Drawn over the canvas (selection boxes, messages). A function receives the preview's state. */
  children?: RenderChildren<PreviewState>;
}

/**
 * The preview canvas, wired to <PlaybackProvider>: hands its `<canvas>` to
 * the renderer on mount, keeps the render target matched to its size, and
 * releases it on unmount. The element is `position: relative` and exactly the
 * canvas's size, so overlays can use `position: absolute; inset: 0`.
 * `data-mode` carries the playback mode; `data-error` is set after a render error.
 */
export const Preview = forwardRef<HTMLDivElement, PreviewProps>(function Preview(
  { width, height, fitPadding = 0, canvasProps, style, children, ...rest },
  forwardedRef,
) {
  const settings = useSettings();
  const { attachCanvas, detachCanvas, resizePreview, mode, lastError } = usePlayback();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const ref = useMergedRef(forwardedRef, frameRef);
  const fixed = width !== undefined && height !== undefined;
  const aspect = settings.width / settings.height;
  const [avail, setAvail] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    if (fixed) return;
    const parent = frameRef.current?.parentElement;
    if (!parent) return;
    const measure = () =>
      setAvail((prev) => {
        const next = { w: Math.max(0, parent.clientWidth - fitPadding * 2), h: Math.max(0, parent.clientHeight - fitPadding * 2) };
        return prev && prev.w === next.w && prev.h === next.h ? prev : next;
      });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [fixed, fitPadding]);

  let w: number;
  let h: number;
  if (fixed) {
    w = width;
    h = height;
  } else if (avail && avail.w > 0 && avail.h > 0) {
    h = Math.min(avail.h, avail.w / aspect);
    w = h * aspect;
  } else {
    w = 320;
    h = 320 / aspect;
  }
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));

  const size = useRef({ width: w, height: h });
  size.current = { width: w, height: h };

  // Attach once; detach on unmount. Resizes go through the effect below.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    attachCanvas(canvas, size.current);
    return () => detachCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    resizePreview(w, h);
  }, [w, h, resizePreview]);

  const state = useMemo<PreviewState>(
    () => ({ width: w, height: h, scale: w / settings.width, mode, lastError }),
    [w, h, settings.width, mode, lastError],
  );

  return (
    <PreviewContext.Provider value={state}>
      <div
        ref={ref}
        data-preview=""
        data-mode={mode}
        data-error={flag(!!lastError)}
        style={{ position: "relative", width: w, height: h, flexShrink: 0, ...style }}
        {...rest}
      >
        <canvas
          ref={canvasRef}
          {...canvasProps}
          style={{ display: "block", width: w, height: h, ...canvasProps?.style }}
        />
        {renderChildren(children, state)}
      </div>
    </PreviewContext.Provider>
  );
});
