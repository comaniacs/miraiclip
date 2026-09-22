/**
 * Transition timing — pure math shared by the compositor (blending), the
 * audio mapping (crossfade gains), and video preparation (headroom decode).
 * One source of truth for "where is the window and how far along are we".
 */
import type { Clip, ProjectDocument, Transition } from "@miraiclip/core";
import type { Us } from "../media/types.js";
import { getTransitionRenderer } from "./registry.js";

export interface TransitionWindow {
  transition: Transition;
  /** The cut: where fromClip ends and toClip begins. */
  cutUs: Us;
  /** Centered on the cut. */
  startUs: Us;
  endUs: Us;
}

export function windowOf(transition: Transition, doc: ProjectDocument): TransitionWindow | null {
  const from = doc.clips[transition.fromClipId];
  if (!from) return null;
  const cutUs = from.startUs + from.durationUs;
  const half = Math.floor(transition.durationUs / 2);
  return { transition, cutUs, startUs: cutUs - half, endUs: cutUs - half + transition.durationUs };
}

/** 0 at the window start, 1 at the end, clamped. */
export function progressIn(window: TransitionWindow, timeUs: Us): number {
  const span = window.endUs - window.startUs;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (timeUs - window.startUs) / span));
}

export type TransitionRole = "from" | "to";

export interface ClipTransition {
  window: TransitionWindow;
  role: TransitionRole;
}

/** Every transition a clip participates in, with its role. */
export function transitionsForClip(doc: ProjectDocument, clipId: string): ClipTransition[] {
  const result: ClipTransition[] = [];
  for (const transition of Object.values(doc.transitions)) {
    const role: TransitionRole | undefined =
      transition.fromClipId === clipId ? "from" : transition.toClipId === clipId ? "to" : undefined;
    if (!role) continue;
    const window = windowOf(transition, doc);
    if (window) result.push({ window, role });
  }
  return result;
}

export function participatesInTransition(doc: ProjectDocument, clipId: string): boolean {
  for (const transition of Object.values(doc.transitions)) {
    if (transition.fromClipId === clipId || transition.toClipId === clipId) return true;
  }
  return false;
}

/**
 * Kinds that render BOTH clips through the window (the outgoing clip keeps
 * showing past its end, the incoming starts early — both from source
 * headroom). Dips cover the hard swap with an opaque overlay instead, so
 * they need no out-of-bounds rendering at all. Answered by each kind's
 * registered renderer; a kind with no renderer needs no extra media.
 */
export function rendersBothClips(kind: string): boolean {
  return getTransitionRenderer(kind)?.rendersBothClips ?? false;
}

/**
 * How far outside its own bounds a clip must stay renderable (and decoded)
 * because of transitions: `beforeUs` extends before startUs ("to" roles),
 * `afterUs` beyond the end ("from" roles).
 */
export function renderExtension(doc: ProjectDocument, clip: Clip): { beforeUs: Us; afterUs: Us } {
  let beforeUs = 0;
  let afterUs = 0;
  for (const { window, role } of transitionsForClip(doc, clip.id)) {
    if (!rendersBothClips(window.transition.kind)) continue;
    if (role === "to") beforeUs = Math.max(beforeUs, window.cutUs - window.startUs);
    else afterUs = Math.max(afterUs, window.endUs - window.cutUs);
  }
  return { beforeUs, afterUs };
}

/**
 * Equal-power audio crossfade gain for a clip at a timeline position.
 * Each side ramps within its own clip bounds (out: window start → cut,
 * in: cut → window end) — ramped, so no pop at the cut; sourcing audio from
 * beyond clip bounds (a true overlapped crossfade) is a v4.x follow-up.
 * Applies to every transition kind. 1 outside any window.
 */
export function transitionGainAt(doc: ProjectDocument, clipId: string, timeUs: Us): number {
  let gain = 1;
  for (const { window, role } of transitionsForClip(doc, clipId)) {
    if (role === "from") {
      const span = window.cutUs - window.startUs;
      if (span > 0 && timeUs > window.startUs && timeUs < window.cutUs) {
        gain *= Math.cos(((timeUs - window.startUs) / span) * (Math.PI / 2));
      } else if (timeUs >= window.cutUs) {
        // Past the cut the clip is over anyway; keep the math explicit.
        if (timeUs < window.endUs) gain *= 0;
      }
    } else {
      const span = window.endUs - window.cutUs;
      if (span > 0 && timeUs >= window.cutUs && timeUs < window.endUs) {
        gain *= Math.sin(((timeUs - window.cutUs) / span) * (Math.PI / 2));
      } else if (timeUs < window.cutUs && timeUs > window.startUs) {
        gain *= 0;
      }
    }
  }
  return gain;
}

/** Ramp sample times a gain-automation window needs for the crossfade curves. */
export function transitionRampTimes(
  doc: ProjectDocument,
  clipId: string,
  fromUs: Us,
  toUs: Us,
): Us[] {
  const times: Us[] = [];
  for (const { window, role } of transitionsForClip(doc, clipId)) {
    const rampStart = role === "from" ? window.startUs : window.cutUs;
    const rampEnd = role === "from" ? window.cutUs : window.endUs;
    // Boundary + quarter points: linear segments approximating the
    // equal-power curve to well under an audible step.
    for (let i = 0; i <= 4; i++) {
      const at = rampStart + Math.round(((rampEnd - rampStart) * i) / 4);
      if (at > fromUs && at < toUs) times.push(at);
    }
  }
  return times;
}
