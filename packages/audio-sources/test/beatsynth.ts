/**
 * Deterministic test music for beat analysis: drums, bass, chords, pads and
 * noise, synthesised at a known tempo, so the expected beat times are exact.
 */

export function prng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Voice = "kick" | "snare" | "hat" | "openhat" | "ghost" | "bass" | "chord" | "pluck";

/** A hit: which voice, when (in beats from the music's start), how loud, and a pitch for tonal voices. */
export interface Hit {
  voice: Voice;
  beat: number;
  gain?: number;
  note?: number; // MIDI note
}

export interface Track {
  name: string;
  bpm: number;
  sampleRate: number;
  /** Seconds of silence (or pad only) before beat 0. */
  startS: number;
  bars: number;
  hits: Hit[];
  /** Sustained pad under everything (no clear onsets). */
  pad?: number;
  /** White noise level. */
  noise?: number;
  /** Vinyl crackle: random clicks per second (and a little hiss). */
  crackle?: number;
  /** Amplitude envelope over the track (0–1 multiplier as a function of time fraction). */
  gainCurve?: (fraction: number) => number;
  seed: number;
}

export function render(track: Track): { samples: Float32Array; sampleRate: number; expectedBeats: number[] } {
  const sr = track.sampleRate;
  const spb = 60 / track.bpm;
  const totalBeats = track.bars * 4;
  const lengthS = track.startS + totalBeats * spb + 1.5;
  const out = new Float32Array(Math.ceil(lengthS * sr));
  const rand = prng(track.seed);
  const noise = () => rand() * 2 - 1;
  const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

  const add = (startS: number, durS: number, fn: (t: number, i: number) => number) => {
    const s0 = Math.round(startS * sr);
    const n = Math.round(durS * sr);
    for (let i = 0; i < n && s0 + i < out.length; i++) if (s0 + i >= 0) out[s0 + i]! += fn(i / sr, i);
  };

  for (const h of track.hits) {
    const t0 = track.startS + h.beat * spb;
    const g = h.gain ?? 1;
    switch (h.voice) {
      case "kick": {
        let phase = 0;
        add(t0, 0.35, (t) => {
          const f = 45 + 110 * Math.exp(-t / 0.03);
          phase += (2 * Math.PI * f) / sr;
          return 0.9 * g * Math.sin(phase) * Math.exp(-t / 0.12);
        });
        break;
      }
      case "snare":
      case "ghost": {
        const gg = h.voice === "ghost" ? 0.15 * g : 0.6 * g;
        add(t0, 0.25, (t) => gg * (0.7 * noise() + 0.4 * Math.sin(2 * Math.PI * 185 * t)) * Math.exp(-t / 0.06));
        break;
      }
      case "hat":
      case "openhat": {
        let prev = 0;
        const decay = h.voice === "openhat" ? 0.15 : 0.03;
        add(t0, decay * 5, (t) => {
          const v = noise();
          const hp = v - prev;
          prev = v;
          return 0.18 * g * hp * Math.exp(-t / decay);
        });
        break;
      }
      case "bass": {
        const f = midi(h.note ?? 40);
        add(t0, spb * 0.9, (t) => 0.5 * g * Math.sin(2 * Math.PI * f * t) * Math.min(1, t / 0.005) * Math.exp(-t / 0.25));
        break;
      }
      case "chord": {
        const root = h.note ?? 60;
        const fs = [root, root + 4, root + 7].map(midi);
        add(t0, spb * 1.5, (t) => (0.12 * g * fs.reduce((s, f) => s + Math.sin(2 * Math.PI * f * t), 0) * Math.min(1, t / 0.008) * Math.exp(-t / 0.4)));
        break;
      }
      case "pluck": {
        const f = midi(h.note ?? 72);
        add(t0, 0.4, (t) => 0.25 * g * Math.sign(Math.sin(2 * Math.PI * f * t)) * Math.exp(-t / 0.08));
        break;
      }
    }
  }
  if (track.pad) {
    const fs = [48, 55, 60, 64].map(midi);
    for (let i = 0; i < out.length; i++) {
      const t = i / sr;
      out[i]! += track.pad * fs.reduce((s, f, k) => s + Math.sin(2 * Math.PI * f * t + k), 0) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.1 * t));
    }
  }
  if (track.noise) for (let i = 0; i < out.length; i++) out[i]! += track.noise * noise();
  if (track.crackle) {
    const musicEnd = Math.min(out.length, Math.round((track.startS + totalBeats * spb) * sr)); // the record stops with the music
    for (let i = Math.round(track.startS * sr); i < musicEnd; i++) {
      out[i]! += 0.01 * noise();
      if (rand() < track.crackle / sr) {
        const amp = 0.15 + 0.45 * rand();
        for (let k = 0; k < 40 && i + k < out.length; k++) out[i + k]! += amp * noise() * Math.exp(-k / 6);
      }
    }
  }
  if (track.gainCurve) for (let i = 0; i < out.length; i++) out[i]! *= track.gainCurve(i / out.length);
  const expectedBeats = Array.from({ length: totalBeats }, (_, k) => track.startS + k * spb);
  return { samples: out, sampleRate: sr, expectedBeats };
}

/** One bar's hits, repeated over `bars` bars (beats are per bar, 0–4). */
export function loop(bars: number, bar: Hit[], variation?: (barIndex: number) => Hit[]): Hit[] {
  const hits: Hit[] = [];
  for (let b = 0; b < bars; b++) for (const h of [...bar, ...(variation?.(b) ?? [])]) hits.push({ ...h, beat: h.beat + b * 4 });
  return hits;
}

const at = (voice: Voice, beats: number[], extra: Partial<Hit> = {}): Hit[] => beats.map((beat) => ({ voice, beat, ...extra }));
const eighths = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
const sixteenths = Array.from({ length: 16 }, (_, i) => i / 4);

/** The fixtures: tempo, groove and the difficulty each one tests. */
export function fixtures(): Track[] {
  const sr = 22050;
  return [
    {
      name: "72 bpm ballad groove (must not read as 144)",
      bpm: 72, sampleRate: sr, startS: 0.5, bars: 7, seed: 1,
      hits: loop(7, [...at("kick", [0, 2]), ...at("snare", [1, 3]), ...at("hat", eighths, { gain: 0.5 }), { voice: "bass", beat: 0, note: 40 }, { voice: "chord", beat: 0, note: 60, gain: 0.6 }]),
    },
    {
      name: "90 bpm hip-hop, 1.3 s silent intro",
      bpm: 90, sampleRate: sr, startS: 1.3, bars: 8, seed: 2,
      hits: loop(8, [...at("kick", [0, 1.75, 2]), ...at("snare", [1, 3]), ...at("hat", sixteenths, { gain: 0.35 })]),
    },
    {
      name: "100 bpm swing",
      bpm: 100, sampleRate: sr, startS: 0.3, bars: 8, seed: 3,
      hits: loop(8, [...at("kick", [0, 2]), ...at("snare", [1, 3]), ...at("hat", [0, 2 / 3, 1, 5 / 3, 2, 8 / 3, 3, 11 / 3], { gain: 0.6 })]),
    },
    {
      name: "110 bpm bass and chord stabs, no drums",
      bpm: 110, sampleRate: sr, startS: 0.4, bars: 8, seed: 4,
      hits: loop(8, [{ voice: "bass", beat: 0, note: 38, gain: 1.2 }, { voice: "bass", beat: 1, note: 38 }, { voice: "bass", beat: 2, note: 45 }, { voice: "bass", beat: 3, note: 43 }, ...at("chord", [1, 3], { note: 62 })]),
    },
    {
      name: "120 bpm four-on-the-floor with pad and noise",
      bpm: 120, sampleRate: sr, startS: 0.25, bars: 10, seed: 5, pad: 0.04, noise: 0.02,
      hits: loop(10, [...at("kick", [0, 1, 2, 3]), ...at("snare", [1, 3], { gain: 0.8 }), ...at("openhat", [0.5, 1.5, 2.5, 3.5], { gain: 0.6 })]),
    },
    {
      name: "124 bpm house with an eighth-note pickup",
      bpm: 124, sampleRate: sr, startS: 0.6, bars: 10, seed: 6,
      hits: [{ voice: "hat", beat: -0.5, gain: 0.5 }, ...loop(10, [...at("kick", [0, 1, 2, 3]), ...at("snare", [1, 3], { gain: 0.7 }), ...at("hat", [0.5, 1.5, 2.5, 3.5], { gain: 0.6 })])],
    },
    {
      name: "128 bpm with swelling and dipping amplitude",
      bpm: 128, sampleRate: sr, startS: 0.2, bars: 10, seed: 7,
      gainCurve: (f) => 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(2 * Math.PI * (f * 2.5 - 0.25))),
      hits: loop(10, [...at("kick", [0, 1, 2, 3]), ...at("snare", [1, 3]), ...at("hat", eighths, { gain: 0.5 }), ...at("pluck", [0, 0.75, 1.5, 2.5], { note: 76, gain: 0.6 })]),
    },
    {
      name: "140 bpm syncopated with ghost notes",
      bpm: 140, sampleRate: sr, startS: 0.35, bars: 12, seed: 8,
      hits: loop(12, [...at("kick", [0, 0.75, 2.5]), ...at("snare", [1, 3]), ...at("ghost", [1.75, 2.25, 3.75]), ...at("hat", eighths, { gain: 0.45 })]),
    },
    {
      name: "150 bpm punk, quarter-note hats",
      bpm: 150, sampleRate: sr, startS: 0.3, bars: 12, seed: 9,
      hits: loop(12, [...at("kick", [0, 2]), ...at("snare", [1, 3]), ...at("hat", [0, 1, 2, 3], { gain: 0.7 }), { voice: "bass", beat: 0, note: 40 }, { voice: "bass", beat: 2, note: 43 }]),
    },
    {
      name: "174 bpm drum and bass (must not read as 87)",
      bpm: 174, sampleRate: sr, startS: 0.4, bars: 14, seed: 10,
      hits: loop(14, [...at("kick", [0, 2.5]), ...at("snare", [1, 3]), ...at("hat", eighths, { gain: 0.4 }), { voice: "bass", beat: 0, note: 36 }]),
    },
    {
      name: "70 bpm chords on every beat (must not read as 140)",
      bpm: 70, sampleRate: sr, startS: 0.5, bars: 6, seed: 11, pad: 0.03,
      hits: loop(6, [...at("chord", [0, 1, 2, 3], { note: 60 }), ...at("hat", eighths, { gain: 0.3 }), { voice: "bass", beat: 0, note: 36, gain: 1.3 }]),
    },
    {
      // Regression: a real lo-fi loop at 82 BPM read as 109 (its kick and bass repeat every ¾ beat, which out-correlated
      // the beat), until the beat had to divide the bar.
      name: "82 bpm swung boom-bap, dotted kicks, vinyl crackle (must not read as 109)",
      bpm: 82, sampleRate: sr, startS: 0.7, bars: 8, seed: 13, crackle: 12,
      hits: loop(8, [
        ...at("kick", [0, 0.75, 1.5, 3], { gain: 1.1 }),
        ...[0, 0.75, 1.5, 3].map((beat) => ({ voice: "bass" as const, beat, note: 38 })),
        ...at("snare", [2], { gain: 0.7 }),
        ...at("hat", [0, 0.62, 1, 1.62, 2, 2.62, 3, 3.62], { gain: 0.55 }),
        ...at("chord", [0, 2], { note: 63, gain: 0.5 }),
      ]),
    },
    {
      name: "132 bpm at 44.1 kHz, stereo-ready",
      bpm: 132, sampleRate: 44100, startS: 0.15, bars: 8, seed: 12,
      hits: loop(8, [...at("kick", [0, 2]), ...at("snare", [1, 3]), ...at("hat", eighths, { gain: 0.5 }), { voice: "bass", beat: 0, note: 41 }]),
    },
  ];
}
