/**
 * The studio's model of a continuous-shot check: what to show as a badge, as timeline markers and in a
 * clip's properties panel. Pure data in, pure data out, so any UI can draw it. The check itself runs in
 * the sequence's own frame (`probeScriptedHtml` in @miraiclip/renderer) or on a server (`checkShot`).
 *
 * Warnings never block an export: `exportBlocked` is always false, and exists so a UI can say so.
 */

/** The parts of a check finding the studio needs (a `ShotReport` finding satisfies it). */
export interface ShotFindingLike {
  rule: string;
  /** Seconds into the sequence, or null for the whole sequence. */
  t: number | null;
  message: string;
  hint: string;
}

export interface ShotReportLike {
  score: number | null;
  findings: readonly ShotFindingLike[];
}

export interface ShotWarningMarker {
  /** Seconds on the composition timeline. */
  timeSec: number;
  rule: string;
  message: string;
  hint: string;
}

export interface ShotWarningsModel {
  clipId: string;
  /** How many warnings: the badge number. */
  count: number;
  /** Carry score 0–1, or null when no beat was scored. */
  score: number | null;
  /** Warnings with a time, in time order, on the composition timeline. */
  markers: ShotWarningMarker[];
  /** Warnings about the whole sequence (carry score, coverage), for the properties panel. */
  general: { rule: string; message: string; hint: string }[];
  /** Always false: warnings are advice, and exporting stays enabled. */
  exportBlocked: false;
}

/** Turn one sequence clip's report into a badge, timeline markers and panel lines. `clipStartSec` places the clip on the timeline. */
export function shotWarnings(clipId: string, clipStartSec: number, report: ShotReportLike | null | undefined): ShotWarningsModel {
  const findings = report?.findings ?? [];
  const markers = findings
    .filter((f) => f.t !== null)
    .map((f) => ({ timeSec: Math.round((clipStartSec + (f.t as number)) * 1000) / 1000, rule: f.rule, message: f.message, hint: f.hint }))
    .sort((a, b) => a.timeSec - b.timeSec);
  const general = findings.filter((f) => f.t === null).map((f) => ({ rule: f.rule, message: f.message, hint: f.hint }));
  return { clipId, count: findings.length, score: report?.score ?? null, markers, general, exportBlocked: false };
}

/**
 * Re-run policy: edits to a sequence's template or params change what the check would say, so the studio
 * re-checks that clip, debounced, after the edit settles. Returns the clip ids whose check is out of date.
 */
export function staleShotChecks(
  checked: Readonly<Record<string, string>>,
  clips: Readonly<Record<string, { kind: string; template?: string; params?: unknown }>>,
): string[] {
  const out: string[] = [];
  for (const [id, clip] of Object.entries(clips)) {
    if (clip.kind !== "html" || !clip.template || !/data-libs\s*=\s*["'][^"']*\bstage\b/.test(clip.template)) continue;
    if (checked[id] !== shotCheckKey(clip)) out.push(id);
  }
  return out;
}

/** The fingerprint of what the check depends on, stored with its result to tell when it is stale. */
export function shotCheckKey(clip: { template?: string; params?: unknown }): string {
  return JSON.stringify([clip.template ?? "", clip.params ?? {}]);
}
