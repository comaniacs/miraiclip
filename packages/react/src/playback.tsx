import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Clip, Us } from "@miraiclip/core";
import {
  createPreviewController,
  type ClipBounds,
  type PreviewController,
  type PreviewControllerOptions,
  type PreviewMode,
} from "@miraiclip/renderer";
import { useProject } from "./project.js";

export interface PlaybackValue {
  isPlaying: boolean;
  mode: PreviewMode;
  lastError: string | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (us: Us) => void;
  /** Hand the preview `<canvas>` to the renderer (once it is in the DOM). `size` is its CSS size. */
  attachCanvas: (canvas: HTMLCanvasElement, size: { width: number; height: number }) => void;
  /** The preview's CSS size changed. */
  resizePreview: (width: number, height: number) => void;
  detachCanvas: () => void;
  /** Where a clip is drawn now, in composition px (null when not drawn or not live). */
  getClipBounds: (clipId: string) => ClipBounds | null;
  /** Topmost clip at a composition-px point (null when none or not live). */
  hitTest: (xPx: number, yPx: number, filter?: (clip: Clip) => boolean) => string | null;
  /** Monitoring volume, 0..1 (never written to the project or exports). */
  volume: number;
  muted: boolean;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  /** The framework-free controller underneath, for anything not covered here. */
  controller: PreviewController;
}

const PlaybackContext = createContext<PlaybackValue | null>(null);

export interface PlaybackProviderProps {
  /** Renderer and player options. Read when the provider mounts. */
  options?: PreviewControllerOptions;
  /** Remember the monitoring volume in localStorage under this key (off by default). */
  volumeStorageKey?: string;
  children: ReactNode;
}

function readVolume(key: string | undefined): number | undefined {
  if (!key) return undefined;
  try {
    const raw = localStorage.getItem(key);
    const value = Number(raw);
    return raw !== null && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Playback and preview for the project above it: a preview controller
 * (renderer, player, fallback clock, monitoring volume) exposed as React
 * state. Transport state comes from player events, so it never drifts from
 * what the player is doing.
 */
export function PlaybackProvider({ options, volumeStorageKey, children }: PlaybackProviderProps) {
  const project = useProject();
  const [controller] = useState(() => {
    const initialVolume = readVolume(volumeStorageKey) ?? options?.initialVolume;
    return createPreviewController(project, {
      ...options,
      ...(initialVolume !== undefined ? { initialVolume } : {}),
    });
  });
  // Release the renderer on unmount. Not `destroy()`: StrictMode re-runs
  // effects on the same controller, which must stay usable.
  useEffect(
    () => () => {
      controller.pause();
      controller.detach();
    },
    [controller],
  );

  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);

  useEffect(() => {
    if (!volumeStorageKey) return;
    try {
      localStorage.setItem(volumeStorageKey, String(state.volume));
    } catch {
      /* storage unavailable: the volume still works for this session */
    }
  }, [volumeStorageKey, state.volume]);

  const value = useMemo<PlaybackValue>(
    () => ({
      isPlaying: state.playing,
      mode: state.mode,
      lastError: state.lastError,
      volume: state.volume,
      muted: state.muted,
      play: controller.play,
      pause: controller.pause,
      toggle: controller.toggle,
      seek: controller.seek,
      attachCanvas: controller.attach,
      resizePreview: controller.resize,
      detachCanvas: controller.detach,
      getClipBounds: controller.getClipBounds,
      hitTest: controller.hitTest,
      setVolume: controller.setVolume,
      toggleMute: controller.toggleMute,
      controller,
    }),
    [state, controller],
  );
  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

/** Transport, preview and volume from the nearest `<PlaybackProvider>`. */
export function usePlayback(): PlaybackValue {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error("usePlayback must be used within <PlaybackProvider>");
  return value;
}
