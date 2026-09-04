import type { Us } from "./types.js";

export const US_PER_SECOND = 1_000_000;

export function secondsToUs(seconds: number): Us {
  return Math.round(seconds * US_PER_SECOND);
}

export function usToSeconds(us: Us): number {
  return us / US_PER_SECOND;
}

/** Duration of one frame at the given frame rate, in µs (fractional for NTSC rates). */
export function frameDurationUs(fps: number): number {
  return US_PER_SECOND / fps;
}

/** Frame index containing the given timeline position. */
export function usToFrame(us: Us, fps: number): number {
  return Math.floor((us * fps) / US_PER_SECOND);
}

/** Timeline position of the given frame's start. */
export function frameToUs(frame: number, fps: number): Us {
  return Math.round((frame * US_PER_SECOND) / fps);
}

/** Snap a position to the nearest frame boundary. */
export function snapToFrame(us: Us, fps: number): Us {
  return frameToUs(Math.round((us * fps) / US_PER_SECOND), fps);
}

/** Format µs as "HH:MM:SS:FF" timecode at the given frame rate. */
export function usToTimecode(us: Us, fps: number): string {
  const totalFrames = usToFrame(us, fps);
  const fpsInt = Math.round(fps);
  const frames = totalFrames % fpsInt;
  const totalSeconds = Math.floor(totalFrames / fpsInt);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}

export interface Range {
  startUs: Us;
  endUs: Us;
}

export function rangesOverlap(a: Range, b: Range): boolean {
  return a.startUs < b.endUs && b.startUs < a.endUs;
}
