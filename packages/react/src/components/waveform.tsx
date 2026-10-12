import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CanvasHTMLAttributes,
} from "react";
import type { Asset, Us } from "@miraiclip/core";
import { isSourceReachable } from "@miraiclip/editor";
import { computeWaveformPeaks, openMediabunnyAudio, peaksForRange, type WaveformPeaks } from "@miraiclip/renderer";
import { useMergedRef } from "./utils.js";

export interface WaveformProps extends Omit<CanvasHTMLAttributes<HTMLCanvasElement>, "children"> {
  /** Peaks for the whole asset (from `useWaveformPeaks` or the renderer's `computeWaveformPeaks`). */
  peaks: WaveformPeaks;
  /** Media range to draw (for a clip: its trim start to trim start + duration). */
  fromUs: Us;
  toUs: Us;
  /** Linear gain applied before drawing, so volume changes show (default 1). */
  gain?: number;
  /** Bar width and gap, CSS px (default 2 and 1). */
  barWidth?: number;
  barGap?: number;
  /** Quietest level drawn, dB (default −60). Heights use a decibel scale so quiet material stays visible. */
  floorDb?: number;
  /** Longest side of the canvas backing store, device px (default 4096). */
  maxCanvasPx?: number;
}

/**
 * Mirrored waveform bars for a media range, filling the canvas's CSS box.
 * Bars use `currentColor`, so the text color styles them. Redraws on resize
 * and when its inputs change; the backing store is capped so very wide clips
 * at high zoom stay within mobile memory limits.
 */
export const Waveform = forwardRef<HTMLCanvasElement, WaveformProps>(function Waveform(
  { peaks, fromUs, toUs, gain = 1, barWidth = 2, barGap = 1, floorDb = -60, maxCanvasPx = 4096, ...rest },
  forwardedRef,
) {
  const own = useRef<HTMLCanvasElement | null>(null);
  const ref = useMergedRef(forwardedRef, own);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = own.current;
    if (!el) return;
    const measure = () =>
      setSize((s) => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const canvas = own.current;
    if (!canvas || !size.w || !size.h) return;
    const dpr = Math.min(window.devicePixelRatio || 1, maxCanvasPx / size.w, maxCanvasPx / size.h);
    canvas.width = Math.max(1, Math.round(size.w * dpr));
    canvas.height = Math.max(1, Math.round(size.h * dpr));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.fillStyle = getComputedStyle(canvas).color;
    const step = Math.max(1, barWidth + barGap);
    const columns = peaksForRange(peaks, fromUs, toUs, Math.floor(size.w / step));
    const mid = size.h / 2;
    for (let x = 0; x < columns.length; x++) {
      const amp = columns[x]! * gain;
      const db = amp > 0 ? 20 * Math.log10(amp) : floorDb;
      const level = Math.min(1, Math.max(0, (db - floorDb) / -floorDb));
      const h = Math.max(1, level * (size.h - 2));
      ctx.fillRect(x * step, mid - h / 2, barWidth, h);
    }
  }, [peaks, fromUs, toUs, gain, barWidth, barGap, floorDb, maxCanvasPx, size]);

  return <canvas ref={ref} data-waveform="" {...rest} />;
});

// ---------------------------------------------------------------- peaks cache

type Entry = WaveformPeaks | "pending" | "none";

const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();
const queue: Asset[] = [];
let running = false;
const keyOf = (asset: Asset) => `${asset.id}|${asset.src}`;

async function peaksFor(asset: Asset): Promise<Entry> {
  if (!asset.durationUs) return "none";
  // A dead URL (session-only blob, 404) fails fast here instead of stalling the queue in the decoder.
  if (!(await isSourceReachable(asset.src))) return "none";
  const source = await openMediabunnyAudio(asset.id, asset.src);
  if (!source) return "none";
  try {
    return await computeWaveformPeaks(source, { durationUs: asset.durationUs });
  } finally {
    source.dispose();
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e: unknown) => (clearTimeout(timer), reject(e)),
    );
  });
}

async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const asset = queue.shift()!;
    let result: Entry = "none";
    try {
      result = await withTimeout(peaksFor(asset), 30_000);
    } catch {
      result = "none"; // missing, undecodable, no audio track or too slow: draw nothing
    }
    cache.set(keyOf(asset), result);
    for (const l of listeners) l();
  }
  running = false;
}

function request(asset: Asset) {
  const key = keyOf(asset);
  if (cache.has(key)) return;
  cache.set(key, "pending");
  queue.push(asset);
  void pump();
}

/**
 * Waveform peaks for an audio or video asset, or null while computing (and
 * when it has no audio). Computed once per asset `src` with a streamed
 * decode, shared by every component that asks, one asset at a time.
 */
export function useWaveformPeaks(asset: Asset | undefined): WaveformPeaks | null {
  const entry = useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => (asset ? cache.get(keyOf(asset)) : undefined),
  );
  if (asset && (asset.kind === "audio" || asset.kind === "video") && entry === undefined) {
    queueMicrotask(() => request(asset)); // schedule outside render
  }
  return entry && entry !== "pending" && entry !== "none" ? entry : null;
}
