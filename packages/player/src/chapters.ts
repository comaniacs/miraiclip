/**
 * Chapters for the player: from a document's markers, from JSON, or from a
 * WebVTT chapters track. Pure functions — no DOM.
 */
export interface PlayerChapter {
  id: string;
  label: string;
  /** Seconds. */
  start: number;
  end: number;
}

interface MarkerLike {
  id: string;
  timeUs: number;
  label: string;
  durationUs?: number;
}

/**
 * A document's markers as chapters (same rule as core's `markerChapters`):
 * each runs for its own `durationUs`, or until the next marker; the last one
 * until `durationS`.
 */
export function chaptersFromMarkers(markers: Record<string, MarkerLike> | undefined, durationS: number): PlayerChapter[] {
  const list = Object.values(markers ?? {}).sort((a, b) => a.timeUs - b.timeUs || a.id.localeCompare(b.id));
  return list.map((m, i) => {
    const start = m.timeUs / 1e6;
    const next = list[i + 1];
    const end = m.durationUs !== undefined ? (m.timeUs + m.durationUs) / 1e6 : next ? next.timeUs / 1e6 : Math.max(durationS, start);
    return { id: m.id, label: m.label, start, end };
  });
}

/** Parse a WebVTT chapters track ("00:01.000 --> 00:05.000" cues with a title line). */
export function parseVttChapters(vtt: string): PlayerChapter[] {
  const chapters: PlayerChapter[] = [];
  const blocks = vtt.replace(/\r/g, "").split(/\n{2,}/);
  const time = (t: string): number => {
    const parts = t.trim().split(":").map(Number);
    let s = 0;
    for (const p of parts) s = s * 60 + p;
    return s;
  };
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const at = lines.findIndex((l) => l.includes("-->"));
    if (at < 0) continue;
    const [from, to] = lines[at]!.split("-->").map((s) => s.trim().split(/\s+/)[0]!);
    const label = lines.slice(at + 1).join(" ").trim();
    if (!label) continue;
    chapters.push({ id: at > 0 ? lines[0]!.trim() : `c${chapters.length + 1}`, label, start: time(from!), end: time(to!) });
  }
  return chapters.sort((a, b) => a.start - b.start);
}

/** Accept `[{ label, start, end? }]` (seconds) or `[{ label, timeUs, durationUs? }]` and normalize. */
export function normalizeChapters(input: unknown, durationS: number): PlayerChapter[] {
  if (!Array.isArray(input)) return [];
  const raw = input
    .map((c, i) => {
      const o = c as Record<string, unknown>;
      const label = String(o["label"] ?? o["title"] ?? "");
      const start = typeof o["start"] === "number" ? o["start"] : typeof o["timeUs"] === "number" ? o["timeUs"] / 1e6 : NaN;
      const end =
        typeof o["end"] === "number"
          ? o["end"]
          : typeof o["durationUs"] === "number" && typeof o["timeUs"] === "number"
            ? (o["timeUs"] + o["durationUs"]) / 1e6
            : undefined;
      return { id: String(o["id"] ?? `c${i + 1}`), label, start, end };
    })
    .filter((c) => c.label && Number.isFinite(c.start))
    .sort((a, b) => a.start - b.start);
  return raw.map((c, i) => ({ id: c.id, label: c.label, start: c.start, end: c.end ?? raw[i + 1]?.start ?? Math.max(durationS, c.start) }));
}

/**
 * The chapter playing at `timeS` (the latest one that has started and not
 * ended). Media elements land a seek on a frame boundary, often a few ms
 * before the requested time, so a chapter counts as started `toleranceS`
 * early (default 50 ms).
 */
export function chapterAt(chapters: readonly PlayerChapter[], timeS: number, toleranceS = 0.05): PlayerChapter | undefined {
  let found: PlayerChapter | undefined;
  for (const c of chapters) if (c.start <= timeS + toleranceS && timeS < c.end) found = c;
  return found;
}

/** "1:05" / "1:02:03". */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds + 1e-6));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
