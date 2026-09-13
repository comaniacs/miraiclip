/**
 * The corpus's expectation math, replicated PURELY from the documented
 * contracts (never imported from the renderer — an oracle that shares code
 * with the thing it judges proves nothing):
 *
 * - Output frame n spans [round(n·1e6/fps), round((n+1)·1e6/fps)) relative to
 *   the range start, clipped at the end, and samples its temporal MIDPOINT.
 * - The fixture shows source frame floor(mediaUs·30/1e6) (30fps fixtures).
 * - A transition window of `durationUs` is CENTERED on the cut; progress p
 *   runs 0→1 across it. crossDissolve composites incoming over outgoing at
 *   alpha p: expected = out·(1−p) + in·p.
 */

export interface Segment {
  /** Timeline span this clip covers on the base track. */
  timelineStartUs: number;
  timelineEndUs: number;
  /** Media position at timelineStartUs (trimStart + any offset). */
  mediaStartUs: number;
}

export interface Dissolve {
  /** The cut this dissolve bridges (timeline µs). */
  cutUs: number;
  durationUs: number;
}

export interface FrameExpectation {
  /** Output frame index. */
  n: number;
  /** Timeline µs actually sampled (midpoint rule). */
  sampleUs: number;
  kind: "exact" | "blend";
  /** Source frame of the (outgoing) clip at the sample. */
  frame: number;
  /** Blend only: incoming clip's source frame and mix factor p. */
  inFrame?: number;
  p?: number;
}

const FIXTURE_FPS = 30;

/** The exporter's frame walk: derived per index, midpoint-sampled. */
export function sampleTimes(rangeStartUs: number, rangeEndUs: number, fps: number): { n: number; sampleUs: number }[] {
  const durationUs = rangeEndUs - rangeStartUs;
  const totalFrames = Math.max(1, Math.ceil((durationUs * fps) / 1_000_000));
  const out: { n: number; sampleUs: number }[] = [];
  for (let n = 0; n < totalFrames; n++) {
    const frameStartUs = rangeStartUs + Math.round((n * 1_000_000) / fps);
    const frameEndUs = Math.min(rangeStartUs + Math.round(((n + 1) * 1_000_000) / fps), rangeEndUs);
    out.push({ n, sampleUs: frameStartUs + Math.floor((frameEndUs - frameStartUs) / 2) });
  }
  return out;
}

function segmentAt(segments: Segment[], timelineUs: number): Segment | undefined {
  return segments.find((s) => timelineUs >= s.timelineStartUs && timelineUs < s.timelineEndUs);
}

function sourceFrame(segment: Segment, timelineUs: number): number {
  const mediaUs = segment.mediaStartUs + (timelineUs - segment.timelineStartUs);
  return Math.floor((mediaUs * FIXTURE_FPS) / 1_000_000);
}

/**
 * Expected content of every output frame for a base chain of segments with
 * optional cross dissolves. Outside any dissolve window: the exact source
 * frame. Inside one: a blend of outgoing and incoming at the window's p.
 */
export function expectedFrames(options: {
  segments: Segment[];
  dissolves?: Dissolve[];
  rangeStartUs: number;
  rangeEndUs: number;
  fps: number;
}): FrameExpectation[] {
  const { segments, rangeStartUs, rangeEndUs, fps } = options;
  const dissolves = options.dissolves ?? [];
  return sampleTimes(rangeStartUs, rangeEndUs, fps).map(({ n, sampleUs }) => {
    for (const dissolve of dissolves) {
      const windowStartUs = dissolve.cutUs - dissolve.durationUs / 2;
      const windowEndUs = dissolve.cutUs + dissolve.durationUs / 2;
      if (sampleUs >= windowStartUs && sampleUs < windowEndUs) {
        const p = (sampleUs - windowStartUs) / dissolve.durationUs;
        // Outgoing clip renders past its end from source headroom; incoming
        // renders early — both segments evaluate at the raw sample time.
        const outgoing = segmentAt(segments, Math.min(sampleUs, dissolve.cutUs - 1))!;
        const incoming = segmentAt(segments, Math.max(sampleUs, dissolve.cutUs))!;
        return {
          n,
          sampleUs,
          kind: "blend" as const,
          frame: sourceFrame(outgoing, sampleUs),
          inFrame: sourceFrame(incoming, sampleUs),
          p,
        };
      }
    }
    const segment = segmentAt(segments, sampleUs);
    if (!segment) throw new Error(`no segment covers sample ${sampleUs}µs (frame ${n})`);
    return { n, sampleUs, kind: "exact" as const, frame: sourceFrame(segment, sampleUs) };
  });
}

/** out·(1−p) + in·p per channel — the dissolve's documented compositing. */
export function mixColors(
  out: { r: number; g: number; b: number },
  incoming: { r: number; g: number; b: number },
  p: number,
): { r: number; g: number; b: number } {
  return {
    r: out.r * (1 - p) + incoming.r * p,
    g: out.g * (1 - p) + incoming.g * p,
    b: out.b * (1 - p) + incoming.b * p,
  };
}
