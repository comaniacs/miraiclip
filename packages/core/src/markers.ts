/**
 * Marker queries: chapters for players, steps for guides, sections for
 * planners. Pure reads over `doc.markers`.
 */
import type { Marker, ProjectDocument, Us } from "./types.js";

/** Every marker, in time order (ties by id). */
export function listMarkers(doc: ProjectDocument): Marker[] {
  return Object.values(doc.markers ?? {}).sort((a, b) => a.timeUs - b.timeUs || a.id.localeCompare(b.id));
}

/** Markers whose point (or span) touches [fromUs, toUs). */
export function markersInRange(doc: ProjectDocument, fromUs: Us, toUs: Us): Marker[] {
  return listMarkers(doc).filter((m) => {
    const end = m.timeUs + (m.durationUs ?? 0);
    return m.durationUs ? m.timeUs < toUs && end > fromUs : m.timeUs >= fromUs && m.timeUs < toUs;
  });
}

/** End of the last clip (0 for an empty timeline). */
function compositionEndUs(doc: ProjectDocument): Us {
  let end = 0;
  for (const clip of Object.values(doc.clips)) end = Math.max(end, clip.startUs + clip.durationUs);
  return end;
}

export interface Chapter {
  id: string;
  label: string;
  startUs: Us;
  endUs: Us;
  data?: Record<string, unknown>;
}

/**
 * Markers as chapters: each runs for its own `durationUs`, or else until the
 * next marker (the last one until the composition's end).
 */
export function markerChapters(doc: ProjectDocument): Chapter[] {
  const markers = listMarkers(doc);
  const endOfComposition = compositionEndUs(doc);
  return markers.map((m, i) => {
    const next = markers[i + 1];
    const endUs = m.durationUs !== undefined ? m.timeUs + m.durationUs : (next?.timeUs ?? Math.max(endOfComposition, m.timeUs));
    const chapter: Chapter = { id: m.id, label: m.label, startUs: m.timeUs, endUs };
    if (m.data) chapter.data = m.data;
    return chapter;
  });
}
