/**
 * What the main process and the windows say to each other. The preload
 * exposes exactly these as `window.mc` (see src/preload.ts).
 */
import type { CaptureEvent } from "@miraiclip/capture";

/** A screen to record, with what the click log needs to place events on it. */
export interface ScreenSource {
  /** desktopCapturer source id ("screen:…"). */
  id: string;
  name: string;
  /** A small preview (data URL). */
  thumb: string;
  /** The display's area in DIP (CSS px), on the virtual desktop. */
  bounds: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  primary: boolean;
}

export interface Permissions {
  platform: NodeJS.Platform;
  /** macOS: Screen Recording granted (always true elsewhere). */
  screen: boolean;
  /** macOS: Accessibility granted, which the click and key log needs (always true elsewhere). */
  input: boolean;
  /** The click log could start (the native hook loaded). */
  hookAvailable: boolean;
  /** System sound can be recorded (Windows). */
  systemAudio: boolean;
}

/** A command from the control pill or a global shortcut to the recorder. */
export type RecorderCommand = "pause" | "resume" | "step" | "stop" | "discard";

/** Recorder state shown on the pill. */
export interface PillState {
  elapsed: string;
  paused: boolean;
  steps: number;
  /** The click log is running. */
  logging: boolean;
}

/** One logged input event, timed in epoch ms (the recorder puts it on its own clock). */
export interface InputMessage {
  event: CaptureEvent;
  epochMs: number;
}

export interface McApi {
  // Setup
  permissions(): Promise<Permissions>;
  /** macOS: open the System Settings pane for "screen" or "input". */
  openPrivacySettings(kind: "screen" | "input"): Promise<void>;
  /** macOS: ask for Accessibility (shows the system prompt once). */
  requestInputAccess(): Promise<boolean>;
  sources(): Promise<ScreenSource[]>;
  /** The screen (and system sound) the next getDisplayMedia() call returns. */
  chooseSource(id: string, systemAudio: boolean): Promise<void>;
  // Recording lifecycle (recorder window)
  /** Recording started on this screen: start the click log, show the pill. Resolves to whether the log runs. */
  started(sourceId: string, cameraId: string | null): Promise<boolean>;
  /** Recording over (saved or discarded): stop the log, hide the pill, show the recorder. */
  ended(): Promise<void>;
  /** Push the pill's display state. */
  pill(state: PillState): void;
  onInput(listener: (m: InputMessage) => void): () => void;
  onCommand(listener: (c: RecorderCommand) => void): () => void;
  /** Save a packed .mcrec; resolves to its path (null when the save dialog was cancelled). */
  save(bytes: ArrayBuffer, suggestedName: string): Promise<string | null>;
  reveal(path: string): Promise<void>;
  // Pill window
  command(c: RecorderCommand): void;
  onPill(listener: (s: PillState) => void): () => void;
  // Camera window
  onCamera(listener: (cameraId: string | null) => void): () => void;
  setCamera(cameraId: string | null): void;
}
