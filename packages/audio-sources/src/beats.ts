/**
 * Beat analysis: the tempo, beat times and downbeats of a piece of music, so
 * motion can land on the beat. Pure TypeScript, no dependencies: it runs the
 * same in a browser, a worker or Node.
 *
 * The method, in order:
 * 1. Mix to mono and decimate to about 11 kHz (onsets live well below that).
 * 2. Onset envelope: spectral flux over ~20 log-spaced bands (46 ms Hann
 *    window, 10 ms hop; log-compressed band levels, positive changes only),
 *    so kicks and bass count as much as cymbals, with its local mean removed.
 * 3. Tempo: autocorrelation of the envelope over 60–200 BPM, combed over each
 *    lag's first four multiples and weighted by a perceptual prior
 *    (log-Gaussian around 120 BPM, 1.4 octaves wide).
 * 4. Octave check (the "half or double?" question), on the grid's contrast
 *    (mean onset strength on the beats ÷ halfway between them, best phase):
 *    halve the tempo when the slower grid's contrast is at least 1.6 (the
 *    halfway points are subdivisions, such as eighth-note hi-hats); double it
 *    when the current grid's contrast is under 3.3 (the halfway points are
 *    beats too: kick and snare alternating). Never outside 60–200 BPM.
 * 5. Beats: dynamic programming (each beat is an onset, and beats are about
 *    one period apart), refined to the envelope's peak. The tempo is then the
 *    slope of the beat times, so it is exact to well under 1 BPM on steady
 *    music.
 * 6. Downbeats: every 4th beat, at the phase with the most low-frequency
 *    onset energy (kick drums and bass notes). This assumes 4/4.
 */

/** Audio to analyse: mono samples, several channels, or a Web Audio `AudioBuffer`. */
export type BeatInput =
  | { samples: Float32Array; sampleRate: number }
  | { channels: readonly Float32Array[]; sampleRate: number }
  | { numberOfChannels: number; sampleRate: number; getChannelData(channel: number): Float32Array };

export interface AnalyzeBeatsOptions {
  /** Slowest tempo considered. Default 60. */
  minBpm?: number;
  /** Fastest tempo considered. Default 200. */
  maxBpm?: number;
  /** Centre of the tempo prior. Default 120. */
  preferBpm?: number;
  /** Beats per bar, for downbeats. Default 4. */
  beatsPerBar?: number;
}

export interface BeatAnalysis {
  /** Tempo in beats per minute (0 when no beat was found). */
  bpm: number;
  /** How clear the beat is, 0–1. Below about 0.3, treat the grid as a guess. */
  confidence: number;
  /** Beat times in seconds, from the first beat of the music to the last. */
  beats: number[];
  /** The beats that start a bar (every `beatsPerBar`-th beat). */
  downbeats: number[];
  /** The first beat, in seconds. */
  offset: number;
  /** Length of the analysed audio, in seconds. */
  durationS: number;
}

const HOP_S = 0.01;
const WINDOW_S = 0.046;
const TARGET_RATE = 11025;

/** Tempo, beats and downbeats of a piece of music. */
export function analyzeBeats(input: BeatInput, options: AnalyzeBeatsOptions = {}): BeatAnalysis {
  const minBpm = options.minBpm ?? 60;
  const maxBpm = options.maxBpm ?? 200;
  const preferBpm = options.preferBpm ?? 120;
  const beatsPerBar = Math.max(1, Math.round(options.beatsPerBar ?? 4));
  const { samples, sampleRate } = toMono(input);
  const durationS = sampleRate > 0 ? samples.length / sampleRate : 0;
  const none: BeatAnalysis = { bpm: 0, confidence: 0, beats: [], downbeats: [], offset: 0, durationS };
  if (!samples.length || !(sampleRate > 0)) return none;

  // 1. Decimate.
  const factor = Math.max(1, Math.floor(sampleRate / TARGET_RATE));
  const rate = sampleRate / factor;
  const x = decimate(samples, factor);

  // 2. Onset envelope.
  const env = onsetEnvelope(x, rate);
  const { flux, low, frameRate, frameTime } = env;
  const n = flux.length;
  if (n < 8) return none;
  const e = highPass(flux, Math.max(1, Math.round(0.1 * frameRate)));
  const peak = percentile(e, 0.95);
  if (!(peak > 1e-9)) return none;
  const sd = std(e) || 1;
  for (let i = 0; i < n; i++) e[i]! /= sd;

  // 3. Tempo by autocorrelation with a perceptual prior.
  const lagMin = Math.max(1, Math.floor((60 * frameRate) / maxBpm));
  const lagMax = Math.min(n - 2, Math.ceil((60 * frameRate) / minBpm));
  if (lagMax <= lagMin) return none;
  const acf = autocorrelation(e, Math.min(n - 1, Math.max(4 * lagMax, Math.round(5 * frameRate)) + 1));
  // A comb over the lag's multiples: a true beat period repeats at 2, 3 and 4 periods too.
  const comb = (lag: number) => {
    let sum = 0;
    let weight = 0;
    for (let k = 1; k <= 4; k++) {
      const v = acf[k * lag];
      if (v === undefined) break;
      sum += v / k;
      weight += 1 / k;
    }
    return weight ? sum / weight : 0;
  };
  let best = lagMin;
  let bestScore = -Infinity;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    const bpm = (60 * frameRate) / lag;
    const prior = Math.exp(-0.5 * (Math.log2(bpm / preferBpm) / 1.4) ** 2);
    const s = comb(lag) * prior;
    if (s > bestScore) {
      bestScore = s;
      best = lag;
    }
  }
  let period = refinePeak(acf, best);

  // The beat must divide the bar. Music loops: find the bar (the strongest repetition between 1.5 and 5 s), and when
  // the chosen period doesn't fit a whole number of times in it (a dotted or swung figure repeating every ¾ beat, say),
  // pick the beat among the bar's divisors instead.
  const barLo = Math.round(1.5 * frameRate);
  const barHi = Math.min(acf.length - 1, Math.round(5 * frameRate), Math.floor(n / 2));
  if (barHi > barLo) {
    let bar = barLo;
    for (let lag = barLo; lag <= barHi; lag++) if (acf[lag]! > acf[bar]!) bar = lag;
    const barPeriod = refinePeak(acf, bar);
    const fits = barPeriod / period;
    if (acf[bar]! > 0.5 * acf[0]! && Math.abs(fits - Math.round(fits)) > 0.15) {
      let pick = 0;
      let pickScore = -Infinity;
      for (let k = 2; k <= 16; k++) {
        const lag = Math.round(barPeriod / k);
        if (lag < lagMin || lag > lagMax) continue;
        const bpm = (60 * frameRate) / lag;
        const sc = comb(lag) * Math.exp(-0.5 * (Math.log2(bpm / preferBpm) / 1.4) ** 2);
        if (sc > pickScore) {
          pickScore = sc;
          pick = k;
        }
      }
      if (pick) period = barPeriod / pick;
    }
  }


  // 4. Octave check.
  const toBpm = (p: number) => (60 * frameRate) / p;

  for (let k = 0; k < 3; k++) {
    if (toBpm(period * 2) >= minBpm - 1e-9 && gridContrast(e, period * 2) >= 1.6) period *= 2;
    else if (toBpm(period / 2) <= maxBpm + 1e-9 && gridContrast(e, period) < 3.3) period /= 2;
    else break;
  }

  // 5. Beats by dynamic programming, then refined and trimmed to the music.
  const local = smooth(e, Math.max(1, period / 32));
  const frames = trackBeats(local, period);
  const threshold = 0.25 * percentile(e, 0.95);
  let first = 0;
  while (first < n && e[first]! < threshold) first++;
  let last = n - 1;
  while (last > 0 && e[last]! < threshold) last--;
  let kept = frames.filter((f) => f >= first - 0.25 * period && f <= last + 0.25 * period);
  // Drop beats at either end that carry little onset energy (a decaying tail, a quiet intro).
  const strength = kept.map((f) => maxAround(e, f, 2));
  const typical = median(strength);
  let a = 0;
  let b = kept.length;
  while (a < b && strength[a]! < 0.3 * typical) a++;
  while (b > a && strength[b - 1]! < 0.3 * typical) b--;
  kept = kept.slice(a, b);
  const beats = kept.map((f) => round3(frameTime(refineFrame(e, f))));
  if (beats.length < 2) return { ...none, beats, offset: beats[0] ?? 0 };

  // Tempo from the beats themselves (least-squares slope of time against index).
  const slope = regressionSlope(beats);
  const bpm = slope > 0 ? Math.round((6000 / slope)) / 100 : 0;

  // 6. Downbeats: the phase with the most low-frequency onset energy.
  const lowEnv = highPass(low, Math.max(1, Math.round(0.1 * frameRate)));
  let phase = 0;
  let phaseScore = -Infinity;
  for (let p = 0; p < Math.min(beatsPerBar, beats.length); p++) {
    let sum = 0;
    let count = 0;
    for (let i = p; i < kept.length; i += beatsPerBar) {
      sum += maxAround(lowEnv, kept[i]!, 2) + 0.25 * maxAround(e, kept[i]!, 2);
      count++;
    }
    const mean = count ? sum / count : 0;
    if (mean > phaseScore + 1e-9) {
      phaseScore = mean;
      phase = p;
    }
  }
  const downbeats = beats.filter((_, i) => i % beatsPerBar === phase);

  // Confidence: how periodic the envelope is at the beat period (the correlation of the mean-removed envelope with
  // itself one, two, three and four beats later), and how much of its energy sits on the beats.
  const periodFrames = slope * frameRate;
  const periodicity = periodicCorrelation(e, periodFrames);
  const contrast = gridContrast(e, periodFrames);
  const confidence = round3(clamp01(clamp01(periodicity / 0.45) * (0.6 + 0.4 * clamp01((contrast - 1) / 2))));

  return { bpm, confidence, beats, downbeats, offset: beats[0]!, durationS: round3(durationS) };
}

/**
 * Fetch (for a URL), decode with Web Audio and analyse. Browser only: in Node,
 * decode the audio yourself and call `analyzeBeats`.
 */
export async function decodeAndAnalyzeBeats(
  source: string | ArrayBuffer | Blob,
  options: AnalyzeBeatsOptions & { context?: BaseAudioContext; fetch?: (url: string) => Promise<Response> } = {},
): Promise<BeatAnalysis> {
  const Offline = (globalThis as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!options.context && !Offline) {
    throw new Error("decodeAndAnalyzeBeats needs Web Audio (a browser). In Node, decode the audio to samples and call analyzeBeats.");
  }
  let bytes: ArrayBuffer;
  if (typeof source === "string") {
    const fetcher = options.fetch ?? globalThis.fetch?.bind(globalThis);
    if (!fetcher) throw new Error("decodeAndAnalyzeBeats: no fetch available to load the audio");
    const res = await fetcher(source);
    if (!res.ok) throw new Error(`decodeAndAnalyzeBeats: couldn't load the audio (${res.status})`);
    bytes = await res.arrayBuffer();
  } else if (source instanceof ArrayBuffer) {
    bytes = source.slice(0); // decodeAudioData detaches its argument
  } else {
    bytes = await source.arrayBuffer();
  }
  // Decoding into a 22.05 kHz context resamples on the way in: half the work, nothing lost for onsets.
  const context = options.context ?? new Offline!(1, 1, 22050);
  const buffer = await context.decodeAudioData(bytes);
  const { context: _c, fetch: _f, ...rest } = options;
  return analyzeBeats(buffer, rest);
}

/**
 * How many of `times` (labels, motion onsets) land on a beat, within
 * ±`toleranceS` (default 80 ms), and which don't.
 */
export function beatAlignment(
  times: readonly number[],
  beats: readonly number[],
  toleranceS = 0.08,
): { share: number; offBeat: { time: number; nearest: number; offsetS: number }[] } {
  if (!times.length) return { share: 1, offBeat: [] };
  if (!beats.length) return { share: 0, offBeat: times.map((t) => ({ time: t, nearest: NaN, offsetS: NaN })) };
  const offBeat: { time: number; nearest: number; offsetS: number }[] = [];
  for (const t of times) {
    const nearest = snapToBeat(t, beats);
    const offsetS = round3(t - nearest);
    if (Math.abs(t - nearest) > toleranceS + 1e-9) offBeat.push({ time: t, nearest, offsetS });
  }
  return { share: round3((times.length - offBeat.length) / times.length), offBeat };
}

/** The beat nearest to `t` (beats sorted ascending); `t` itself when there are no beats. */
export function snapToBeat(t: number, beats: readonly number[]): number {
  if (!beats.length) return t;
  let lo = 0;
  let hi = beats.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid]! < t) lo = mid + 1;
    else hi = mid;
  }
  const after = beats[lo]!;
  const before = lo > 0 ? beats[lo - 1]! : after;
  return Math.abs(t - before) <= Math.abs(after - t) ? before : after;
}

// ---------------------------------------------------------------------------

function toMono(input: BeatInput): { samples: Float32Array; sampleRate: number } {
  if ("samples" in input) return { samples: input.samples, sampleRate: input.sampleRate };
  const channels = "channels" in input ? [...input.channels] : Array.from({ length: input.numberOfChannels }, (_, i) => input.getChannelData(i));
  if (channels.length === 1) return { samples: channels[0]!, sampleRate: input.sampleRate };
  const length = Math.min(...channels.map((c) => c.length));
  const out = new Float32Array(length);
  for (const c of channels) for (let i = 0; i < length; i++) out[i]! += c[i]! / channels.length;
  return { samples: out, sampleRate: input.sampleRate };
}

/** Average blocks of `factor` samples: a crude low-pass, plenty for onset detection. */
function decimate(x: Float32Array, factor: number): Float32Array {
  if (factor === 1) return x;
  const out = new Float32Array(Math.floor(x.length / factor));
  for (let i = 0, j = 0; i < out.length; i++) {
    let s = 0;
    for (let k = 0; k < factor; k++) s += x[j++]!;
    out[i] = s / factor;
  }
  return out;
}

function onsetEnvelope(x: Float32Array, rate: number) {
  const size = nextPow2(Math.round(WINDOW_S * rate));
  const hop = Math.max(1, Math.round(HOP_S * rate));
  const frames = Math.max(0, Math.floor((x.length - size) / hop) + 1);
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size);
  const half = size / 2;
  // ~20 log-spaced bands from 30 Hz up: kicks and bass weigh as much as cymbals.
  const bands = bandEdges(size, rate, 30, 20);
  const lowBands = bands.filter(([, hi]) => (hi * rate) / size <= 250).length || 1;
  const fft = makeFft(size);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  let prev = new Float64Array(bands.length);
  let cur = new Float64Array(bands.length);
  const flux = new Float32Array(frames);
  const low = new Float32Array(frames);
  const gain = 1000 / size;
  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    for (let i = 0; i < size; i++) {
      re[i] = x[start + i]! * window[i]!;
      im[i] = 0;
    }
    fft(re, im);
    let sum = 0;
    let lowSum = 0;
    for (let b = 0; b < bands.length; b++) {
      const [lo, hi] = bands[b]!;
      let m = 0;
      for (let k = lo; k < hi; k++) m += Math.hypot(re[k]!, im[k]!);
      const level = Math.log1p((gain * m) / (hi - lo));
      cur[b] = level;
      const d = level - prev[b]!;
      if (d > 0) {
        sum += d;
        if (b < lowBands) lowSum += d;
      }
    }
    flux[f] = f === 0 ? 0 : sum;
    low[f] = f === 0 ? 0 : lowSum;
    const t = prev;
    prev = cur;
    cur = t;
  }
  const frameRate = rate / hop;
  // A frame stands for its window's centre.
  const frameTime = (f: number) => (f * hop + half) / rate;
  return { flux, low, frameRate, frameTime };
}

/** FFT bin ranges [lo, hi) for `count` log-spaced bands from `minHz` to Nyquist (each at least one bin). */
function bandEdges(size: number, rate: number, minHz: number, count: number): [number, number][] {
  const half = size / 2;
  const maxHz = rate / 2;
  const out: [number, number][] = [];
  let lo = Math.max(1, Math.floor((minHz / rate) * size));
  for (let b = 1; b <= count && lo < half; b++) {
    const edge = minHz * (maxHz / minHz) ** (b / count);
    const hi = Math.min(half + 1, Math.max(lo + 1, Math.round((edge / rate) * size)));
    out.push([lo, hi]);
    lo = hi;
  }
  return out;
}

/** An in-place iterative radix-2 complex FFT for one size. */
function makeFft(size: number): (re: Float64Array, im: Float64Array) => void {
  const levels = Math.log2(size);
  const rev = new Uint32Array(size);
  for (let i = 0; i < size; i++) {
    let r = 0;
    for (let b = 0; b < levels; b++) r |= ((i >> b) & 1) << (levels - 1 - b);
    rev[i] = r;
  }
  const cos = new Float64Array(size / 2);
  const sin = new Float64Array(size / 2);
  for (let i = 0; i < size / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / size);
    sin[i] = -Math.sin((2 * Math.PI * i) / size);
  }
  return (re, im) => {
    for (let i = 0; i < size; i++) {
      const j = rev[i]!;
      if (j > i) {
        let t = re[i]!;
        re[i] = re[j]!;
        re[j] = t;
        t = im[i]!;
        im[i] = im[j]!;
        im[j] = t;
      }
    }
    for (let len = 2; len <= size; len <<= 1) {
      const halfLen = len >> 1;
      const step = size / len;
      for (let i = 0; i < size; i += len) {
        for (let j = 0; j < halfLen; j++) {
          const wr = cos[j * step]!;
          const wi = sin[j * step]!;
          const a = i + j;
          const b = a + halfLen;
          const tr = re[b]! * wr - im[b]! * wi;
          const ti = re[b]! * wi + im[b]! * wr;
          re[b] = re[a]! - tr;
          im[b] = im[a]! - ti;
          re[a] = re[a]! + tr;
          im[a] = im[a]! + ti;
        }
      }
    }
  };
}

/** Subtract a centred moving average (±radius frames) and half-wave rectify. */
function highPass(x: Float32Array, radius: number): Float32Array {
  const n = x.length;
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i]! + x[i]!;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - radius);
    const b = Math.min(n, i + radius + 1);
    const mean = (prefix[b]! - prefix[a]!) / (b - a);
    out[i] = Math.max(0, x[i]! - mean);
  }
  return out;
}

function autocorrelation(x: Float32Array, lags: number): Float64Array {
  const n = x.length;
  const out = new Float64Array(lags);
  for (let lag = 0; lag < lags; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += x[i]! * x[i + lag]!;
    out[lag] = s / (n - lag);
  }
  return out;
}

/** Sub-sample position of a peak by parabolic interpolation. */
function refinePeak(a: ArrayLike<number>, i: number): number {
  if (i <= 0 || i >= a.length - 1) return i;
  const l = a[i - 1]!;
  const c = a[i]!;
  const r = a[i + 1]!;
  const den = l - 2 * c + r;
  if (den >= 0) return i;
  const d = (0.5 * (l - r)) / den;
  return Math.abs(d) < 1 ? i + d : i;
}

/** The envelope's largest value within ±r frames of a (fractional) position. */
function maxAround(x: Float32Array, pos: number, r: number): number {
  const c = Math.round(pos);
  let m = 0;
  for (let i = Math.max(0, c - r); i <= Math.min(x.length - 1, c + r); i++) if (x[i]! > m) m = x[i]!;
  return m;
}

/**
 * At a period (frames) and its best phase: the mean onset strength on the
 * grid divided by the mean halfway between grid points.
 */
function gridContrast(e: Float32Array, period: number): number {
  if (!(period >= 2)) return 1;
  let best = -Infinity;
  let bestOn: number[] = [];
  let bestMid: number[] = [];
  const steps = Math.max(1, Math.round(period));
  for (let s = 0; s < steps; s++) {
    const phase = (s * period) / steps;
    const on: number[] = [];
    const mid: number[] = [];
    for (let t = phase; t + period / 2 < e.length; t += period) {
      on.push(maxAround(e, t, 1));
      mid.push(maxAround(e, t + period / 2, 1));
    }
    const mean = on.length ? on.reduce((a, b) => a + b, 0) / on.length : 0;
    if (on.length && mean > best) {
      best = mean;
      bestOn = on;
      bestMid = mid;
    }
  }
  // The halfway points by their 60th percentile: they count as beats when at least ~40% of them are strong, not
  // when the odd one is (a syncopated kick that lands there once a bar).
  const on = bestOn.reduce((a, b) => a + b, 0) / Math.max(1, bestOn.length);
  return on / Math.max(quantile(bestMid, 0.6), 1e-6);
}

/** Gaussian smoothing with standard deviation `sigma` frames. */
function smooth(x: Float32Array, sigma: number): Float32Array {
  const r = Math.max(1, Math.ceil(3 * sigma));
  const k = new Float64Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) sum += k[i + r] = Math.exp(-0.5 * (i / sigma) ** 2);
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    let s = 0;
    for (let j = -r; j <= r; j++) {
      const v = x[i + j];
      if (v !== undefined) s += v * k[j + r]!;
    }
    out[i] = s / sum;
  }
  return out;
}

/**
 * Dynamic-programming beat tracking: each frame's best score is its onset
 * strength plus the best earlier beat, penalised by how far the gap strays
 * from one period (log-ratio squared). Returns beat frames in order.
 */
function trackBeats(local: Float32Array, period: number, tightness = 100): number[] {
  const n = local.length;
  const score = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  const lo = Math.max(1, Math.round(period / 2));
  const hi = Math.max(lo + 1, Math.round(2 * period));
  for (let t = 0; t < n; t++) {
    let best = 0;
    let arg = -1;
    for (let gap = lo; gap <= hi && gap <= t; gap++) {
      const s = score[t - gap]! - tightness * Math.log(gap / period) ** 2;
      if (arg === -1 || s > best) {
        best = s;
        arg = t - gap;
      }
    }
    score[t] = local[t]! + (arg === -1 ? 0 : Math.max(0, best));
    back[t] = arg !== -1 && best > 0 ? arg : -1;
  }
  // End on the best-scoring frame within the last period.
  let end = n - 1;
  for (let t = Math.max(0, n - Math.ceil(period)); t < n; t++) if (score[t]! > score[end]!) end = t;
  const out: number[] = [];
  for (let t = end; t >= 0; t = back[t]!) {
    out.push(t);
    if (back[t] === -1) break;
  }
  return out.reverse();
}

/** Move a beat frame to the nearest envelope peak (±2 frames), with sub-frame precision. */
function refineFrame(e: Float32Array, f: number): number {
  let best = f;
  for (let i = Math.max(1, f - 2); i <= Math.min(e.length - 2, f + 2); i++) if (e[i]! > e[best]!) best = i;
  return refinePeak(e, best);
}

/** Mean correlation coefficient of the mean-removed envelope with itself 1–4 periods later. */
function periodicCorrelation(e: Float32Array, period: number): number {
  const n = e.length;
  let mean = 0;
  for (const v of e) mean += v;
  mean /= n || 1;
  let variance = 0;
  for (const v of e) variance += (v - mean) ** 2;
  variance /= n || 1;
  if (!(variance > 0) || !(period >= 1)) return 0;
  let sum = 0;
  let count = 0;
  for (let k = 1; k <= 4; k++) {
    const lag = Math.round(k * period);
    if (lag >= n - 1) break;
    let c = 0;
    for (let i = 0; i + lag < n; i++) c += (e[i]! - mean) * (e[i + lag]! - mean);
    sum += c / (n - lag) / variance;
    count++;
  }
  return count ? Math.max(0, sum / count) : 0;
}

function quantile(x: readonly number[], q: number): number {
  if (!x.length) return 0;
  const s = [...x].sort((p, r) => p - r);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
}

function median(x: readonly number[]): number {
  if (!x.length) return 0;
  const s = [...x].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function regressionSlope(y: readonly number[]): number {
  const n = y.length;
  const mx = (n - 1) / 2;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - mx) * (y[i]! - my);
    den += (i - mx) ** 2;
  }
  return den ? num / den : 0;
}

function percentile(x: Float32Array, q: number): number {
  if (!x.length) return 0;
  const sorted = Float32Array.from(x).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
}

function std(x: Float32Array): number {
  let m = 0;
  for (const v of x) m += v;
  m /= x.length || 1;
  let s = 0;
  for (const v of x) s += (v - m) ** 2;
  return Math.sqrt(s / (x.length || 1));
}

const nextPow2 = (v: number) => 2 ** Math.ceil(Math.log2(Math.max(2, v)));
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const round3 = (v: number) => Math.round(v * 1000) / 1000;
