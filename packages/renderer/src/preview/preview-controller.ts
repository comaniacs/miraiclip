import type { Clip, Project } from "@miraiclip/core";
import { createPixiBackend, type PixiBackendOptions } from "../compositor/pixi-backend.js";
import type { ClipBounds, SceneBackend } from "../compositor/types.js";
import { createWebAudioOutput, openMediabunnyAudio } from "../audio/webaudio.js";
import type { AudioOutput } from "../audio/types.js";
import {
  createWebCodecsDecoderFactory,
  isWebCodecsSupported,
  openMediabunnyDemuxer,
} from "../media/webcodecs.js";
import type { Us } from "../media/types.js";
import { createPlayer, type CreatePlayerOptions, type Player } from "../player.js";

/**
 * - `live`: real decode + WebGL compositing on the attached canvas.
 * - `fallback`: no live renderer (no canvas yet, or it failed to build); a
 *   requestAnimationFrame clock still moves the playhead so timelines work.
 * - `unsupported`: this browser has no WebCodecs; same clock as `fallback`.
 */
export type PreviewMode = "live" | "fallback" | "unsupported";

/** Everything a transport UI renders. A new object whenever any field changes. */
export interface PreviewState {
  playing: boolean;
  mode: PreviewMode;
  /** Last renderer or media error, as text (null after a successful attach). */
  lastError: string | null;
  /** Preview monitoring volume, 0..1. Never written to the project or exports. */
  volume: number;
  muted: boolean;
}

/** A preview audio output whose level can be changed after creation. */
export interface MonitoredAudioOutput {
  output: AudioOutput;
  /** Set the monitoring gain (0..1); implementations should ramp to avoid clicks. */
  setGain(gain: number): void;
}

export interface PreviewControllerOptions {
  /** Extra `createPixiBackend` options (e.g. `htmlRaster`, `background`). */
  backend?: Omit<PixiBackendOptions, "canvas" | "width" | "height">;
  /** Extra `createPlayer` options (e.g. `memory`, `factories`, `loop`). */
  player?: Omit<
    CreatePlayerOptions,
    "backend" | "openDemuxer" | "createDecoder" | "audioOutput" | "openAudio" | "onError"
  >;
  /** Longest decoded frame side, in px (default 1920). Decoding never exceeds the preview's own size. */
  maxDecodeDimensionPx?: number;
  /** devicePixelRatio cap for the render target (default 2). */
  maxPixelRatio?: number;
  /** Starting monitoring volume, 0..1 (default 1). */
  initialVolume?: number;
  /** Runs after the player is built, before the preview goes live (e.g. load web fonts). */
  beforeLive?: (project: Project) => Promise<void>;
  /** Called once per live player, e.g. to expose stats to a dev overlay. */
  onPlayerReady?: (player: Player) => void;
  /** Media failures per clip. Also reflected in `lastError`. */
  onError?: (error: Error, clipId: string) => void;

  // --- injectable for tests and custom stacks ---
  isSupported?: () => boolean;
  createBackend?: (options: PixiBackendOptions) => Promise<SceneBackend>;
  createPlayer?: (project: Project, options: CreatePlayerOptions) => Player;
  createAudioOutput?: (gain: number) => MonitoredAudioOutput;
  devicePixelRatio?: () => number;
  raf?: (callback: (timeMs: number) => void) => number;
  cancelRaf?: (handle: number) => void;
}

export interface PreviewController {
  getState(): PreviewState;
  /** Called after every state change. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;

  play(): void;
  pause(): void;
  toggle(): void;
  /** Seek, clamped to [0, composition end]. */
  seek(timeUs: Us): void;

  /** Build the live renderer on `canvas`. `size` is its CSS size; safe to call again on the same canvas. */
  attach(canvas: HTMLCanvasElement, size: { width: number; height: number }): void;
  /** The canvas's CSS size changed (zoom, layout). */
  resize(width: number, height: number): void;
  /** Tear the live renderer down; the preview falls back to the clock-only mode. */
  detach(): void;

  setVolume(volume: number): void;
  toggleMute(): void;

  /** Where a clip is drawn now, in composition px (null when not live or not drawn). */
  getClipBounds(clipId: string): ClipBounds | null;
  /** Topmost clip at a composition-px point (null when not live or nothing there). */
  hitTest(xPx: number, yPx: number, filter?: (clip: Clip) => boolean): string | null;
  /** The live player, when there is one. */
  readonly player: Player | null;

  /** Detach and drop every listener. The controller can't be used afterwards. */
  destroy(): void;
}

/** End of the last clip. */
function compositionEndUs(project: Project): Us {
  let end = 0;
  for (const clip of Object.values(project.getState().doc.clips)) {
    end = Math.max(end, clip.startUs + clip.durationUs);
  }
  return end;
}

/**
 * The preview half of an editor, without any UI framework: owns the canvas's
 * renderer and player, a fallback clock, and the monitoring volume. Framework
 * adapters subscribe to it (`getState` / `subscribe`) and forward DOM events.
 *
 * Safe under React StrictMode: an `attach` → `detach` → `attach` on the same
 * canvas builds one renderer, never two on one WebGL context.
 */
export function createPreviewController(
  project: Project,
  options: PreviewControllerOptions = {},
): PreviewController {
  const isSupported = options.isSupported ?? isWebCodecsSupported;
  const buildBackend = options.createBackend ?? createPixiBackend;
  const buildPlayer = options.createPlayer ?? createPlayer;
  const buildAudio = options.createAudioOutput ?? createMonitoredWebAudioOutput;
  const dpr = options.devicePixelRatio ?? (() => (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1));
  const raf =
    options.raf ?? ((callback: (timeMs: number) => void) => requestAnimationFrame(callback));
  const cancelRaf = options.cancelRaf ?? ((handle: number) => cancelAnimationFrame(handle));
  const maxDecodePx = options.maxDecodeDimensionPx ?? 1920;
  const maxDpr = options.maxPixelRatio ?? 2;

  let state: PreviewState = {
    playing: false,
    mode: isSupported() ? "fallback" : "unsupported",
    lastError: null,
    volume: clamp01(options.initialVolume ?? 1),
    muted: false,
  };
  const listeners = new Set<() => void>();
  const setState = (patch: Partial<PreviewState>): void => {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof PreviewState)[]) {
      if (patch[key] !== state[key]) changed = true;
    }
    if (!changed) return;
    state = { ...state, ...patch };
    for (const listener of [...listeners]) listener();
  };

  let destroyed = false;
  let player: Player | null = null;
  let backend: SceneBackend | null = null;
  let audio: MonitoredAudioOutput | null = null;
  let playerOffs: (() => void)[] = [];
  let contextLost: { canvas: HTMLCanvasElement; handler: () => void } | null = null;
  /** The canvas the caller wants live (null after detach). */
  let desiredCanvas: HTMLCanvasElement | null = null;
  /** A canvas whose backend is being built (async) — guards against two renderers on one context. */
  let pendingCanvas: HTMLCanvasElement | null = null;
  let previewSize: { width: number; height: number } | null = null;
  /** Longest side of the render target in device px; caps decode size. Per controller. */
  let previewLongestPx = maxDecodePx;

  // --- fallback clock (whenever mode !== "live") ---
  let rafHandle: number | null = null;
  let lastTs: number | null = null;
  const stopFallback = (): void => {
    if (rafHandle !== null) cancelRaf(rafHandle);
    rafHandle = null;
    lastTs = null;
  };
  const runFallback = (): void => {
    stopFallback();
    const tick = (ts: number): void => {
      const last = lastTs;
      lastTs = ts;
      if (last !== null) {
        const end = compositionEndUs(project);
        const next = project.getState().playheadUs + (ts - last) * 1000;
        if (next >= end) {
          project.setPlayhead(end);
          stopFallback();
          setState({ playing: false });
          return;
        }
        project.setPlayhead(Math.round(next));
      }
      rafHandle = raf(tick);
    };
    rafHandle = raf(tick);
  };

  const gain = (): number => (state.muted ? 0 : state.volume);

  const applyOutputSize = (size: { width: number; height: number }): void => {
    const ratio = Math.min(dpr(), maxDpr);
    const width = Math.max(1, Math.round(size.width * ratio));
    const height = Math.max(1, Math.round(size.height * ratio));
    backend?.setOutputSize?.(width, height);
    previewLongestPx = Math.max(width, height);
  };

  const teardown = (): void => {
    stopFallback();
    for (const off of playerOffs) off();
    playerOffs = [];
    if (contextLost) contextLost.canvas.removeEventListener("webglcontextlost", contextLost.handler);
    contextLost = null;
    try {
      player?.destroy(); // closes the audio output too
      backend?.destroy();
    } catch {
      /* best-effort teardown */
    }
    player = null;
    backend = null;
    audio = null;
  };

  const goLive = async (canvas: HTMLCanvasElement, size: { width: number; height: number }): Promise<void> => {
    pendingCanvas = canvas;
    try {
      const built = await buildBackend({
        background: 0x000000,
        ...options.backend,
        canvas,
        width: Math.max(1, Math.round(size.width)),
        height: Math.max(1, Math.round(size.height)),
      });
      if (pendingCanvas === canvas) pendingCanvas = null;
      // Detached (or re-attached elsewhere) while the backend was building.
      if (destroyed || desiredCanvas !== canvas) {
        built.destroy();
        return;
      }
      backend = built;
      if (previewSize) applyOutputSize(previewSize);
      else applyOutputSize(size);
      audio = buildAudio(gain());
      const live = buildPlayer(project, {
        ...options.player,
        backend: built,
        openDemuxer: openMediabunnyDemuxer,
        // Decode no larger than the preview shows: frame memory grows with the square of this.
        createDecoder: createWebCodecsDecoderFactory({
          maxOutputDimensionPx: () => Math.min(maxDecodePx, Math.max(320, previewLongestPx)),
        }),
        audioOutput: audio.output,
        openAudio: openMediabunnyAudio,
        onError: (error, clipId) => {
          setState({ lastError: `${error.message} (clip ${clipId})` });
          options.onError?.(error, clipId);
        },
      });
      player = live;
      playerOffs = [
        live.on("play", () => setState({ playing: true })),
        live.on("pause", () => setState({ playing: false })),
      ];
      // Losing the GPU context is the browser's strongest memory signal (iOS
      // does it before killing the tab): shrink the frame budget.
      const handler = (): void => live.reportMemoryPressure();
      canvas.addEventListener("webglcontextlost", handler);
      contextLost = { canvas, handler };

      await options.beforeLive?.(project);
      if (destroyed || player !== live) return;
      const wasPlaying = state.playing;
      stopFallback();
      live.seek(project.getState().playheadUs);
      options.onPlayerReady?.(live);
      setState({ mode: "live", lastError: null, playing: false });
      if (wasPlaying) live.play(); // carry an in-progress fallback playback over
    } catch (error) {
      if (pendingCanvas === canvas) pendingCanvas = null;
      if (destroyed) return;
      setState({ mode: "fallback", lastError: error instanceof Error ? error.message : String(error) });
    }
  };

  const controller: PreviewController = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    play() {
      if (destroyed) return;
      const end = compositionEndUs(project);
      if (end <= 0) return;
      if (project.getState().playheadUs >= end) controller.seek(0);
      if (state.mode === "live" && player) {
        player.play();
      } else {
        setState({ playing: true });
        runFallback();
      }
    },
    pause() {
      stopFallback();
      player?.pause();
      setState({ playing: false });
    },
    toggle() {
      if (state.playing) controller.pause();
      else controller.play();
    },
    seek(timeUs) {
      if (destroyed) return;
      const clamped = Math.min(Math.max(0, Math.round(timeUs)), compositionEndUs(project));
      if (player) player.seek(clamped);
      else project.setPlayhead(clamped);
    },

    attach(canvas, size) {
      if (destroyed) return;
      desiredCanvas = canvas;
      previewSize = size;
      if (!isSupported()) {
        setState({ mode: "unsupported" });
        return;
      }
      if (player && backend) {
        applyOutputSize(size);
        return;
      }
      // A build for this canvas is already in flight (StrictMode's
      // attach → detach → attach): let it finish; it re-checks desiredCanvas.
      if (pendingCanvas === canvas) return;
      void goLive(canvas, size);
    },
    resize(width, height) {
      previewSize = { width, height };
      if (backend) applyOutputSize(previewSize);
    },
    detach() {
      desiredCanvas = null;
      teardown();
      setState({ mode: isSupported() ? "fallback" : "unsupported", playing: false });
    },

    setVolume(volume) {
      const next = clamp01(volume);
      setState({ volume: next, muted: next === 0 });
      audio?.setGain(gain());
    },
    toggleMute() {
      // Unmuting from zero restores an audible level.
      if (state.muted && state.volume === 0) setState({ volume: 0.5 });
      setState({ muted: !state.muted });
      audio?.setGain(gain());
    },

    getClipBounds: (clipId) => player?.getClipBounds(clipId) ?? null,
    hitTest: (xPx, yPx, filter) => player?.hitTest(xPx, yPx, filter ? { filter } : undefined) ?? null,
    get player() {
      return player;
    },

    destroy() {
      if (destroyed) return;
      desiredCanvas = null;
      teardown();
      destroyed = true;
      listeners.clear();
    },
  };
  return controller;
}

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

/**
 * A WebAudio output whose channels all pass through one master GainNode, so
 * the monitoring volume is a single gain change. The audio engine connects
 * each channel to `context.destination`; shadowing that property on this
 * context instance routes them into the master instead.
 */
export function createMonitoredWebAudioOutput(gain: number): MonitoredAudioOutput {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = gain;
  master.connect(context.destination);
  Object.defineProperty(context, "destination", { value: master, configurable: true });
  return {
    output: createWebAudioOutput(context),
    setGain(next) {
      master.gain.setTargetAtTime(next, context.currentTime, 0.015);
    },
  };
}
