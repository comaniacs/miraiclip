/**
 * A capture session → a starting project: the screen recording on its own
 * track, the camera as a picture-in-picture on top, and one marker per
 * marker event. Pure — it returns commands; nothing is touched.
 */
import type { CaptureEvent, CaptureSession } from "./types.js";

export interface Command {
  type: string;
  payload: Record<string, unknown>;
}

export interface SessionCommandsOptions {
  /** Where the saved screen file is, as the project will load it (e.g. "screen.webm"). */
  screenSrc?: string;
  /** Where the saved camera file is. */
  cameraSrc?: string;
  /** Set the project to the screen's size and this frame rate (default 30). Skip with `false`. */
  settings?: { fps?: number } | false;
  /** Ids (defaults: asset "screen"/"camera", tracks "screen"/"camera", clips "screen"/"camera"). */
  ids?: Partial<Record<"screenAsset" | "cameraAsset" | "screenTrack" | "cameraTrack" | "screenClip" | "cameraClip", string>>;
  /** Where the camera sits: a corner (default "bottom-right") and its size as a fraction of the frame width (default 0.22). */
  cameraPlacement?: { corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right"; widthFrac?: number };
}

/** Commands that build the starting project for a capture session. */
export function sessionCommands(session: CaptureSession, options: SessionCommandsOptions = {}): Command[] {
  const ids = {
    screenAsset: "screen",
    cameraAsset: "camera",
    screenTrack: "screen",
    cameraTrack: "camera",
    screenClip: "screen",
    cameraClip: "camera",
    ...options.ids,
  };
  const commands: Command[] = [];
  const screen = session.media.screen;
  const camera = session.media.camera;
  const durationUs = Math.max(1, session.durationUs);
  if (options.settings !== false && screen?.width && screen.height) {
    commands.push({ type: "project/set-settings", payload: { width: screen.width, height: screen.height, fps: (options.settings || {}).fps ?? 30 } });
  }
  if (screen && options.screenSrc) {
    commands.push({
      type: "asset/add",
      payload: {
        id: ids.screenAsset,
        kind: "video",
        src: options.screenSrc,
        durationUs: screen.durationUs ?? durationUs,
        ...(screen.width ? { width: screen.width } : {}),
        ...(screen.height ? { height: screen.height } : {}),
        name: "Screen recording",
        source: { provider: "recording", id: session.startedAt },
      },
    });
    commands.push({ type: "track/add", payload: { id: ids.screenTrack, kind: "video", name: "Screen" } });
    commands.push({
      type: "clip/add",
      payload: { kind: "video", id: ids.screenClip, trackId: ids.screenTrack, assetId: ids.screenAsset, startUs: 0, durationUs: screen.durationUs ?? durationUs },
    });
  }
  if (camera && options.cameraSrc) {
    const { x, y, scale } = placeCamera({
      frame: { width: screen?.width ?? 1920, height: screen?.height ?? 1080 },
      camera: { width: camera.width ?? 1280, height: camera.height ?? 720 },
      corner: options.cameraPlacement?.corner ?? "bottom-right",
      widthFrac: options.cameraPlacement?.widthFrac ?? 0.22,
    });
    commands.push({
      type: "asset/add",
      payload: { id: ids.cameraAsset, kind: "video", src: options.cameraSrc, durationUs: camera.durationUs ?? durationUs, ...(camera.width ? { width: camera.width } : {}), ...(camera.height ? { height: camera.height } : {}), name: "Camera", source: { provider: "recording", id: session.startedAt } },
    });
    commands.push({ type: "track/add", payload: { id: ids.cameraTrack, kind: "video", name: "Camera" } });
    commands.push({
      type: "clip/add",
      payload: {
        kind: "video",
        id: ids.cameraClip,
        trackId: ids.cameraTrack,
        assetId: ids.cameraAsset,
        startUs: camera.offsetUs ?? 0,
        durationUs: camera.durationUs ?? durationUs,
        volume: 0, // the microphone is in the screen file
        transform: { x, y, scale },
      },
    });
  }
  let n = 0;
  for (const event of session.events) {
    if (event.type !== "marker") continue;
    n++;
    commands.push({ type: "marker/add", payload: { id: `marker-${n}`, timeUs: event.tUs, label: event.label, ...(event.data ? { data: event.data } : {}) } });
  }
  return commands;
}

const round = (v: number) => Math.round(v * 1e6) / 1e6;

/** A viewport point (CSS px) as fractions of the screen video frame. */
export function toVideoFraction(session: CaptureSession, x: number, y: number): { x: number; y: number } {
  const v = session.viewport;
  const box = session.viewportInVideo ?? { x: 0, y: 0, width: 1, height: 1 };
  return { x: box.x + (x / v.width) * box.width, y: box.y + (y / v.height) * box.height };
}

/** Events of some types, in time order. */
export function eventsOfType<T extends CaptureEvent["type"]>(session: CaptureSession, ...types: T[]): Extract<CaptureEvent, { type: T }>[] {
  return session.events.filter((e): e is Extract<CaptureEvent, { type: T }> => (types as string[]).includes(e.type)).sort((a, b) => a.tUs - b.tUs);
}

export type CameraCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface PlaceCameraOptions {
  /** The composition (or screen recording) size. */
  frame: { width: number; height: number };
  /** The camera video's size. */
  camera: { width: number; height: number };
  corner: CameraCorner;
  /** Width of what shows, as a fraction of the frame's width (default 0.22). */
  widthFrac?: number;
  /** How far it is cropped toward a square (0–1), as the frameShape effect does: placement uses what shows. */
  square?: number;
  /** Gap to the frame's edges, as a fraction of its width (default 0.03). */
  margin?: number;
}

/**
 * The transform that puts a camera clip in a corner at a given size. The clip
 * fits the frame at scale 1; with a square crop, the visible part (not the
 * whole clip) keeps the margin and the width.
 */
export function placeCamera(o: PlaceCameraOptions): { x: number; y: number; scale: number } {
  const { width: frameW, height: frameH } = o.frame;
  const { width: camW, height: camH } = o.camera;
  const square = Math.min(1, Math.max(0, o.square ?? 0));
  const visW = camW + (Math.min(camW, camH) - camW) * square;
  const visH = camH + (Math.min(camW, camH) - camH) * square;
  const fit = Math.min(frameW / camW, frameH / camH);
  const scale = ((o.widthFrac ?? 0.22) * frameW) / (visW * fit);
  const halfW = (visW * fit * scale) / 2 / frameW;
  const halfH = (visH * fit * scale) / 2 / frameH;
  const margin = o.margin ?? 0.03;
  const x = o.corner.endsWith("right") ? 1 - margin - halfW : margin + halfW;
  const y = o.corner.startsWith("bottom") ? 1 - margin * (frameW / frameH) - halfH : margin * (frameW / frameH) + halfH;
  return { x: round(x), y: round(y), scale: round(scale) };
}
