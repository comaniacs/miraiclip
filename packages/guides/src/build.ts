/**
 * A written guide from the same project as the video: one step per marker
 * (or per click), the step's text from the narration script or what was
 * said, and where the action happened on screen, for an annotated
 * screenshot. Pure: no rendering, no network.
 */
import { listMarkers, type ProjectDocument, type VideoClip } from "@miraiclip/core";
import type { CaptureEvent, CaptureSession, CaptureTarget } from "@miraiclip/capture";
import { framePointToCanvas, rectToFrame, screenClip, sessionToClipUs } from "@miraiclip/screencast";
import { detectFillers, transcriptOnTimeline, type Transcript } from "@miraiclip/transcript";

export interface GuideImage {
  src: string;
  width: number;
  height: number;
  alt: string;
}

export interface GuideStep {
  id: string;
  /** 1-based. */
  number: number;
  title: string;
  /** Paragraph text (plain). */
  body?: string;
  /** Timeline time to screenshot. */
  timeUs: number;
  /** Where the action is, as fractions of the frame (canvas), at `timeUs`. */
  highlight?: { x: number; y: number; width: number; height: number };
  /** What the viewer does in this step, when the log knows. */
  action?: { kind: "click" | "type" | "key" | "navigate"; label?: string; key?: string; url?: string };
  markerId?: string;
  image?: GuideImage;
}

export interface Guide {
  title: string;
  intro?: string;
  language?: string;
  steps: GuideStep[];
}

export interface BuildGuideOptions {
  title: string;
  intro?: string;
  /** Steps from markers (default when the project has any) or from clicks. */
  stepsFrom?: "markers" | "clicks";
  /** Only these markers (default: all; markers with `data.kind === "step"` when any have it). */
  markerFilter?: (marker: { id: string; label: string; data?: Record<string, unknown> }) => boolean;
  /** The recording's interaction log and its clip: actions and highlights come from it. */
  session?: CaptureSession;
  clipId?: string;
  /**
   * Every clip of the recording, when it has been cut or split (by cleanup or
   * a voiceover's freeze frames): each action is found on the piece that
   * shows it. Overrides `clipId`.
   */
  clipIds?: string[];
  /** Step text from a narration script (by marker id or by time)… */
  script?: { language?: string; segments: { text: string; startUs: number; markerId?: string }[] };
  /** …or from what was said (fillers dropped). */
  transcript?: Transcript;
  /** Grow highlight boxes by this many CSS px of the recording (default 8). */
  highlightPaddingPx?: number;
}

type Located = { local: number; clip: VideoClip; event: CaptureEvent; target?: CaptureTarget };

function actionOf(e: CaptureEvent): GuideStep["action"] | undefined {
  const label = "target" in e ? e.target?.label : undefined;
  switch (e.type) {
    case "click":
    case "dblclick":
      return { kind: "click", ...(label ? { label } : {}) };
    case "input":
      return { kind: "type", ...(label ? { label } : {}) };
    case "key":
      return e.key === "text" ? undefined : { kind: "key", key: e.key };
    case "navigate":
      return { kind: "navigate", url: e.url };
    default:
      return undefined;
  }
}

/** A step title from the action ("Click “Save”", "Enter your email", "Press Enter"). */
export function titleForAction(action: GuideStep["action"]): string | undefined {
  if (!action) return undefined;
  if (action.kind === "click") return action.label ? `Click “${action.label}”` : undefined;
  if (action.kind === "type") return action.label ? (action.label.toLowerCase().startsWith("enter") ? action.label : `Enter ${action.label.charAt(0).toLowerCase()}${action.label.slice(1)}`) : "Type the value";
  if (action.kind === "key") return `Press ${action.key!.replace(/\+/g, " + ")}`;
  return undefined;
}

export function buildGuide(doc: ProjectDocument, options: BuildGuideOptions): Guide {
  const session = options.session;
  const clips = session ? (options.clipIds ?? (options.clipId ? [options.clipId] : [])).map((id) => screenClip(doc, id)) : [];
  const pad = options.highlightPaddingPx ?? 8;
  const located: Located[] = [];
  if (session) {
    for (const e of session.events) {
      if (!["click", "dblclick", "input", "key", "navigate"].includes(e.type)) continue;
      // The piece of the recording that shows this moment (none when it was cut away).
      for (const clip of clips) {
        const local = sessionToClipUs(clip, session, e.tUs);
        if (local === undefined) continue;
        located.push({ local, clip, event: e, ...("target" in e && e.target ? { target: e.target } : {}) });
        break;
      }
    }
    located.sort((a, b) => a.clip.startUs + a.local - (b.clip.startUs + b.local));
  }
  const at = (l: Located) => l.clip.startUs + l.local;

  // The step spans.
  let markers = listMarkers(doc);
  if (markers.some((m) => m.data?.["kind"] === "step")) markers = markers.filter((m) => m.data?.["kind"] === "step");
  if (options.markerFilter) markers = markers.filter(options.markerFilter);
  const fromMarkers = (options.stepsFrom ?? (markers.length ? "markers" : "clicks")) === "markers";
  const end = clips.length ? Math.max(...clips.map((c) => c.startUs + c.durationUs)) : Math.max(0, ...Object.values(doc.clips).map((c) => c.startUs + c.durationUs));
  const spans: { startUs: number; endUs: number; markerId?: string; label?: string }[] = fromMarkers
    ? markers.map((m, i) => ({ startUs: m.timeUs, endUs: markers[i + 1]?.timeUs ?? end, markerId: m.id, label: m.label }))
    : located
        .filter((l) => l.event.type === "click" || l.event.type === "dblclick")
        .map((l, i, all) => ({ startUs: at(l), endUs: all[i + 1] ? at(all[i + 1]!) : end }));

  const words = options.transcript ? transcriptOnTimeline(doc, options.transcript) : [];
  const fillerIdx = new Set(options.transcript ? detectFillers(options.transcript).flatMap((s) => s.words) : []);
  const textFor = (span: (typeof spans)[number]) => {
    const fromScript = options.script?.segments.find((s) => (span.markerId && s.markerId === span.markerId) || (s.startUs >= span.startUs && s.startUs < span.endUs));
    if (fromScript) return fromScript.text;
    const said = words.filter((w) => w.timelineStartUs >= span.startUs && w.timelineStartUs < span.endUs && !fillerIdx.has(w.index)).map((w) => w.text);
    if (!said.length) return undefined;
    const text = said.join(" ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const steps: GuideStep[] = spans.map((span, i) => {
    // The step's main action: its first click, else its first typing, else a named key.
    const inSpan = located.filter((l) => at(l) >= span.startUs && at(l) < span.endUs);
    const main =
      inSpan.find((l) => l.event.type === "click" || l.event.type === "dblclick") ??
      inSpan.find((l) => l.event.type === "input") ??
      inSpan.find((l) => l.event.type === "key" && (l.event as { key: string }).key !== "text");
    const action = main ? actionOf(main.event) : undefined;
    // Screenshot just before the action (the control is visible, not yet changed); else mid-step.
    // (Kept on the action's own piece of the recording.)
    const timeUs = main ? Math.max(span.startUs, main.clip.startUs, at(main) - 150_000) : Math.round(span.startUs + Math.min(1_000_000, (span.endUs - span.startUs) / 2));
    let highlight: GuideStep["highlight"];
    if (main?.target && session && !main.target.sensitive) {
      const box = rectToFrame(session, main.target.rect, pad);
      const local = timeUs - main.clip.startUs;
      const a = framePointToCanvas(doc, main.clip, local, box.x, box.y);
      const b = framePointToCanvas(doc, main.clip, local, box.x + box.width, box.y + box.height);
      highlight = { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
    }
    const title = (fromMarkers && span.label) || titleForAction(action) || `Step ${i + 1}`;
    const body = textFor(span);
    return {
      id: span.markerId ? `step-${span.markerId}` : `step-${i + 1}`,
      number: i + 1,
      title,
      ...(body && body !== title ? { body } : {}),
      timeUs,
      ...(highlight ? { highlight } : {}),
      ...(action ? { action } : {}),
      ...(span.markerId ? { markerId: span.markerId } : {}),
    };
  });
  const language = options.script?.language ?? options.transcript?.language;
  return { title: options.title, ...(options.intro ? { intro: options.intro } : {}), ...(language ? { language } : {}), steps };
}
