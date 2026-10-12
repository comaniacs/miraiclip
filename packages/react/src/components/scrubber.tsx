import { forwardRef, useRef, type HTMLAttributes, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import type { Us } from "@miraiclip/core";
import { formatClock } from "@miraiclip/editor";
import { useProject } from "../project.js";
import { usePlayback } from "../playback.js";
import { useDurationUs, useProjectState } from "../state.js";
import { useCompositorPlayhead } from "../timeline.js";
import { useMergedRef } from "./utils.js";

type DivProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & { children?: ReactNode };

export interface ScrubberRootProps extends DivProps {
  /** Arrow-key step (default 1 s). */
  stepUs?: Us;
  /** Page Up / Page Down and Shift + arrow step (default 5 s). */
  largeStepUs?: Us;
}

const ratioOf = (us: number, durationUs: number) => (durationUs > 0 ? Math.min(1, Math.max(0, us / durationUs)) : 0);

/**
 * A seek bar over the whole composition: an ARIA slider. Press or drag to
 * seek; arrows step (Shift: larger), Page Up/Down, Home and End jump. It
 * re-renders about once a second while playing (for the screen-reader
 * value); <Scrubber.Range> and <Scrubber.Thumb> move on the compositor.
 */
const Root = forwardRef<HTMLDivElement, ScrubberRootProps>(function ScrubberRoot(
  { stepUs = 1_000_000, largeStepUs = 5_000_000, style, onPointerDown, onPointerMove, onKeyDown, children, ...rest },
  ref,
) {
  const project = useProject();
  const { seek } = usePlayback();
  const durationUs = useDurationUs();
  const seconds = useProjectState((s) => Math.floor(s.playheadUs / 1_000_000));

  const seekAt = (e: PointerEvent<HTMLDivElement>) => {
    if (durationUs <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    seek(ratioOf(e.clientX - rect.left, rect.width) * durationUs);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const now = project.getState().playheadUs;
    const small = e.shiftKey ? largeStepUs : stepUs;
    const target =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? now + small
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? now - small
          : e.key === "PageUp"
            ? now + largeStepUs
            : e.key === "PageDown"
              ? now - largeStepUs
              : e.key === "Home"
                ? 0
                : e.key === "End"
                  ? durationUs
                  : null;
    if (target === null) return;
    e.preventDefault();
    seek(Math.min(durationUs, Math.max(0, target)));
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(durationUs / 1000)}
      aria-valuenow={seconds * 1000}
      aria-valuetext={`${formatClock(seconds * 1_000_000)} of ${formatClock(durationUs)}`}
      data-scrubber=""
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
      onKeyDown={onKey}
      {...rest}
    >
      {children}
    </div>
  );
});

/** The played part: scaled horizontally from its left edge (`transform-origin: left`). Size it to the full track. */
const Range = forwardRef<HTMLDivElement, DivProps>(function ScrubberRange({ style, children, ...rest }, forwardedRef) {
  const own = useRef<HTMLDivElement | null>(null);
  const ref = useMergedRef(forwardedRef, own);
  useCompositorPlayhead(own, (us, dur) => `scaleX(${ratioOf(us, dur)})`, []);
  return (
    <div ref={ref} data-scrubber-range="" style={{ transformOrigin: "left", willChange: "transform", ...style }} {...rest}>
      {children}
    </div>
  );
});

/**
 * A full-size layer (`position: absolute; inset: 0`) slid right by the
 * played fraction: put the knob in it at `left: 0` (centered with a
 * negative translate).
 */
const Thumb = forwardRef<HTMLDivElement, DivProps>(function ScrubberThumb({ style, children, ...rest }, forwardedRef) {
  const own = useRef<HTMLDivElement | null>(null);
  const ref = useMergedRef(forwardedRef, own);
  useCompositorPlayhead(own, (us, dur) => `translateX(${ratioOf(us, dur) * 100}%)`, []);
  return (
    <div
      ref={ref}
      data-scrubber-thumb=""
      style={{ position: "absolute", inset: 0, pointerEvents: "none", willChange: "transform", ...style }}
      {...rest}
    >
      {children}
    </div>
  );
});

/** Unstyled seek bar parts: <Scrubber.Root> with <Scrubber.Range> and <Scrubber.Thumb> inside. */
export const Scrubber = { Root, Range, Thumb };
