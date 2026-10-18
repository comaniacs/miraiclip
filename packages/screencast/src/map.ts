/**
 * Where and when a recorded event lands in the project: session time → the
 * screen clip's own time (through trims and speed changes), and a point in
 * the recorded viewport → a point on the canvas (through the clip's
 * transform and any zoom keyframes at that moment).
 */
import { evaluateClipAt, isVideoClip, toTimelineUs, type ProjectDocument, type VideoClip } from "@miraiclip/core";
import { toVideoFraction, type CaptureRect, type CaptureSession } from "@miraiclip/capture";

export interface Command {
  type: string;
  payload: Record<string, unknown>;
}

/** The screen recording's clip, checked. */
export function screenClip(doc: ProjectDocument, clipId: string): VideoClip {
  const clip = doc.clips[clipId];
  if (!clip) throw new Error(`no clip "${clipId}" in the project`);
  if (!isVideoClip(clip)) throw new Error(`clip "${clipId}" is a ${clip.kind} clip; the planners need the screen recording's video clip`);
  return clip;
}

/**
 * Session time → clip-relative time on the screen clip, or undefined when
 * that moment was trimmed away (or the clip is a freeze frame).
 */
export function sessionToClipUs(clip: VideoClip, session: CaptureSession, tUs: number): number | undefined {
  const local = sessionToClipUsUnclamped(clip, session, tUs);
  return local === undefined || local < 0 || local > clip.durationUs ? undefined : local;
}

/** Like `sessionToClipUs`, but times outside the clip come back negative or past its length. */
export function sessionToClipUsUnclamped(clip: VideoClip, session: CaptureSession, tUs: number): number | undefined {
  const sourceUs = tUs - (session.media.screen?.offsetUs ?? 0);
  const timelineUs = toTimelineUs(clip, sourceUs);
  return timelineUs === undefined ? undefined : Math.round(timelineUs - clip.startUs);
}

/**
 * How much of the canvas the clip's frame covers at scale 1 (clips fit the
 * composition, aspect preserved): 1 × 1 when the recording has the
 * project's aspect ratio.
 */
export function frameExtent(doc: ProjectDocument, clip: VideoClip): { kx: number; ky: number } {
  const { width: W, height: H } = doc.settings;
  const asset = doc.assets[clip.assetId];
  const aw = asset?.width ?? W;
  const ah = asset?.height ?? H;
  const fit = Math.min(W / aw, H / ah);
  return { kx: (aw * fit) / W, ky: (ah * fit) / H };
}

/**
 * A point in the clip's frame (fractions, 0..1 from its top-left) → canvas
 * fractions at a clip-relative time, through the clip's animated transform.
 */
export function framePointToCanvas(doc: ProjectDocument, clip: VideoClip, localUs: number, fx: number, fy: number): { x: number; y: number } {
  const e = evaluateClipAt(clip, localUs);
  const { kx, ky } = frameExtent(doc, clip);
  const { width: W, height: H } = doc.settings;
  let dx = (fx - 0.5) * e.scale * kx * W;
  let dy = (fy - 0.5) * e.scale * ky * H;
  if (e.rotation) {
    const r = (e.rotation * Math.PI) / 180;
    [dx, dy] = [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r)];
  }
  return { x: e.x + dx / W, y: e.y + dy / H };
}

/** The zoom at a clip-relative time, relative to the clip's resting scale. */
export function zoomAt(clip: VideoClip, localUs: number): number {
  const base = clip.transform.scale || 1;
  return evaluateClipAt(clip, localUs).scale / base;
}

/** A viewport rectangle (CSS px) → fractions of the clip's frame. */
export function rectToFrame(session: CaptureSession, rect: CaptureRect, padPx = 0): { x: number; y: number; width: number; height: number } {
  const a = toVideoFraction(session, rect.x - padPx, rect.y - padPx);
  const b = toVideoFraction(session, rect.x + rect.width + padPx, rect.y + rect.height + padPx);
  return { x: a.x, y: a.y, width: Math.max(1e-4, b.x - a.x), height: Math.max(1e-4, b.y - a.y) };
}

export const round = (v: number, digits = 5) => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

export const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
