import type { FrameRate, ProjectSettings, Us } from "./types.js";

export const US_PER_SECOND = 1_000_000;

export function secondsToUs(seconds: number): Us {
  return Math.round(seconds * US_PER_SECOND);
}

export function usToSeconds(us: Us): number {
  return us / US_PER_SECOND;
}

/*
 * Frame mapping
 * -------------
 * A frame rate is an exact ratio `num/den` (NTSC 29.97 is 30000/1001), so one
 * frame lasts T = 1e6·den/num µs — not a whole number of µs at most rates.
 * The rule, used by every helper here:
 *
 *   frame n starts at  ceil(n·T)      (the first whole µs inside frame n)
 *   the frame at us is floor(us / T)
 *
 * Every whole µs belongs to exactly one frame, `usToFrame(frameToUs(n)) === n`
 * for every n, and each timestamp is derived from its frame index, so nothing
 * accumulates over a long timeline. The math is exact integer arithmetic (it
 * switches to BigInt past Number.MAX_SAFE_INTEGER), never float division.
 */

/** Anything the frame helpers accept: a plain number (29.97 → 30000/1001) or an exact ratio. */
export type FrameRateLike = number | FrameRate;

const NTSC_BASES = [24, 30, 48, 60, 120, 240];

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * The exact rate for a number or ratio. NTSC rates written as decimals
 * (23.976, 23.98, 29.97, 59.94, 119.88…) become `base·1000/1001`; whole
 * numbers become `n/1`; other decimals are read to 1/1000 (12.5 → 25/2).
 * Ratios are reduced. Throws a RangeError for non-positive or non-finite input.
 */
export function toFrameRate(rate: FrameRateLike): FrameRate {
  if (typeof rate === "object") {
    const { num, den } = rate;
    if (!Number.isSafeInteger(num) || !Number.isSafeInteger(den) || num <= 0 || den <= 0) {
      throw new RangeError(`invalid frame rate ${num}/${den}: num and den must be positive integers`);
    }
    const g = gcd(num, den);
    return { num: num / g, den: den / g };
  }
  if (!Number.isFinite(rate) || rate <= 0) throw new RangeError(`invalid frame rate: ${rate}`);
  if (Number.isInteger(rate)) return { num: rate, den: 1 };
  for (const base of NTSC_BASES) {
    if (Math.abs(rate - (base * 1000) / 1001) < 0.01) return { num: base * 1000, den: 1001 };
  }
  return toFrameRate({ num: Math.round(rate * 1000), den: 1000 });
}

/** The project's exact frame rate: `settings.frameRate` when set, else read from `settings.fps`. */
export function projectFrameRate(settings: Pick<ProjectSettings, "fps" | "frameRate">): FrameRate {
  return settings.frameRate ? toFrameRate(settings.frameRate) : toFrameRate(settings.fps);
}

/** Display form: "30", "29.97", "23.976". */
export function formatFrameRate(rate: FrameRateLike): string {
  const { num, den } = toFrameRate(rate);
  if (den === 1) return String(num);
  return String(Number((num / den).toFixed(3)));
}

/* Exact floor/ceil of a·b / c for integers (a may be negative). */
function mulDiv(a: number, b: number, c: number, mode: "floor" | "ceil"): number {
  const p = a * b;
  if (Number.isSafeInteger(p) && Math.abs(p) + c <= Number.MAX_SAFE_INTEGER) {
    let q = Math.floor(p / c);
    // Correct the float quotient by at most a step either way.
    if (q * c > p) q -= 1;
    else if ((q + 1) * c <= p) q += 1;
    return mode === "ceil" && q * c !== p ? q + 1 : q;
  }
  const P = BigInt(a) * BigInt(b);
  const C = BigInt(c);
  let q = P / C; // truncates toward zero
  const r = P % C;
  if (r !== 0n) {
    if (P < 0n && mode === "floor") q -= 1n;
    if (P > 0n && mode === "ceil") q += 1n;
  }
  return Number(q);
}

/** Duration of one frame in µs (fractional at NTSC rates — use `frameToUs` for positions). */
export function frameDurationUs(rate: FrameRateLike): number {
  const { num, den } = toFrameRate(rate);
  return (US_PER_SECOND * den) / num;
}

/** Index of the frame containing the given timeline position. */
export function usToFrame(us: Us, rate: FrameRateLike): number {
  const { num, den } = toFrameRate(rate);
  if (!Number.isInteger(us)) return Math.floor((us * num) / (US_PER_SECOND * den));
  return mulDiv(us, num, US_PER_SECOND * den, "floor");
}

/** Timeline position where the given frame starts: the first whole µs inside it. */
export function frameToUs(frame: number, rate: FrameRateLike): Us {
  const { num, den } = toFrameRate(rate);
  if (!Number.isInteger(frame)) return Math.ceil((frame * US_PER_SECOND * den) / num);
  return mulDiv(frame, US_PER_SECOND * den, num, "ceil");
}

/** Frames needed to cover `durationUs` (the frames that start before it ends). */
export function frameCount(durationUs: Us, rate: FrameRateLike): number {
  if (durationUs <= 0) return 0;
  // Frame n starts before D iff ceil(n·T) ≤ D − 1, i.e. the frames up to the one holding D − 1.
  return usToFrame(Math.ceil(durationUs) - 1, rate) + 1;
}

/** Snap a position to the nearest frame start (halfway rounds to the later frame). */
export function snapToFrame(us: Us, rate: FrameRateLike): Us {
  const frame = usToFrame(us, rate);
  const before = frameToUs(frame, rate);
  const after = frameToUs(frame + 1, rate);
  return us - before < after - us ? before : after;
}

export interface TimecodeOptions {
  /**
   * SMPTE drop-frame timecode ("HH:MM:SS;FF"): skips frame numbers 0 and 1
   * (0–3 at 59.94) at each minute except every tenth, so the timecode tracks
   * the clock at 29.97 / 59.94. Only for those rates; ignored otherwise.
   */
  dropFrame?: boolean;
}

/**
 * Format µs as "HH:MM:SS:FF" timecode. Frames count from the exact rate, with
 * the nominal rate (30 for 29.97) as frames per second — non-drop-frame, which
 * runs about 3.6 s per hour behind the clock at 29.97. Pass `{ dropFrame: true }`
 * for "HH:MM:SS;FF" drop-frame timecode at 29.97 / 59.94.
 */
export function usToTimecode(us: Us, rate: FrameRateLike, options: TimecodeOptions = {}): string {
  const exact = toFrameRate(rate);
  let frame = usToFrame(us, exact);
  const nominal = Math.round(exact.num / exact.den);
  const dropFrame = options.dropFrame === true && exact.den === 1001 && nominal % 30 === 0;
  if (dropFrame) {
    const drop = (nominal / 30) * 2; // 2 at 29.97, 4 at 59.94
    const perMinute = nominal * 60 - drop;
    const perTenMinutes = perMinute * 10 + drop;
    const tens = Math.floor(frame / perTenMinutes);
    const rest = frame % perTenMinutes;
    frame += drop * 9 * tens + (rest > drop ? drop * Math.floor((rest - drop) / perMinute) : 0);
  }
  const frames = frame % nominal;
  const totalSeconds = Math.floor(frame / nominal);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${dropFrame ? ";" : ":"}${pad(frames)}`;
}
