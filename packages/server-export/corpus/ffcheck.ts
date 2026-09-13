/**
 * ffmpeg/ffprobe-based verification primitives for the export corpus.
 *
 * Independence is the point: exports are produced by the real pipeline
 * (headless Chromium); everything here decodes them with a DIFFERENT decoder
 * (ffmpeg in Node), so a muxer or codec bug cannot hide by round-tripping
 * through the encoder that made it.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const MAX_BUFFER = 256 * 1024 * 1024; // raw pixel/PCM dumps are large

export interface ContainerInfo {
  durationS: number;
  video: { codec: string; width: number; height: number } | null;
  audio: { codec: string; sampleRate: number; channels: number } | null;
  streamCount: number;
}

/** Parse the container: streams, dimensions, duration. */
export async function probeContainer(file: string): Promise<ContainerInfo> {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-print_format", "json", "-show_format", "-show_streams", file,
  ], { maxBuffer: MAX_BUFFER });
  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: {
      codec_type?: string; codec_name?: string; width?: number; height?: number;
      sample_rate?: string; channels?: number; duration?: string;
    }[];
  };
  const streams = parsed.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video");
  const audio = streams.find((s) => s.codec_type === "audio");
  // WebM often reports duration on the format, sometimes only on streams.
  const durationS = Number(
    parsed.format?.duration ?? video?.duration ?? audio?.duration ?? NaN,
  );
  return {
    durationS,
    video: video ? { codec: video.codec_name ?? "", width: video.width ?? 0, height: video.height ?? 0 } : null,
    audio: audio ? { codec: audio.codec_name ?? "", sampleRate: Number(audio.sample_rate ?? 0), channels: audio.channels ?? 0 } : null,
    streamCount: streams.length,
  };
}

/** Every video frame's presentation time, in stored order (seconds). */
export async function videoPtsSeconds(file: string): Promise<number[]> {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "frame=pts_time",
    "-print_format", "csv=p=0", file,
  ], { maxBuffer: MAX_BUFFER });
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(Number);
}

/**
 * Decode EVERY frame and return its center 2×2 block as rgb24 — 12 bytes per
 * frame, in presentation order (yuv420 chroma alignment forbids a 1×1 crop).
 * The whole-file frame-selection check reads this against the fixture's
 * frame-index colors via `pixelAt`, which averages the block.
 */
export async function centerPixels(file: string): Promise<Buffer> {
  const { stdout } = await run("ffmpeg", [
    "-v", "error", "-i", file,
    "-vf", "crop=w=2:h=2:x=in_w/2-1:y=in_h/2-1",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
  ], { encoding: "buffer", maxBuffer: MAX_BUFFER });
  return stdout as unknown as Buffer;
}

/**
 * Decode the audio track's FIRST CHANNEL to float PCM at 48kHz. Channel 0,
 * not a downmix: ffmpeg's stereo→mono downmix sums channels at constant
 * power (0.707 each), inflating correlated content's RMS by √2 — the
 * fixture's ground-truth amplitudes are defined per channel.
 */
export async function audioMono(file: string): Promise<Float32Array> {
  const { stdout } = await run("ffmpeg", [
    "-v", "error", "-i", file,
    "-af", "pan=mono|c0=c0",
    "-f", "f32le", "-ar", "48000", "-",
  ], { encoding: "buffer", maxBuffer: MAX_BUFFER });
  const buffer = stdout as unknown as Buffer;
  return new Float32Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.byteLength / 4));
}

/**
 * Burst onsets in seconds: the first sample above `threshold` after at least
 * `quietS` below it. Matches the sync fixture's 20ms tone bursts.
 */
export function findBursts(
  samples: Float32Array,
  sampleRate: number,
  options: { threshold?: number; quietS?: number } = {},
): number[] {
  const threshold = options.threshold ?? 0.1;
  const quietSamples = Math.round((options.quietS ?? 0.1) * sampleRate);
  const onsets: number[] = [];
  let quiet = quietSamples; // file may start mid-quiet
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]!) >= threshold) {
      if (quiet >= quietSamples) onsets.push(i / sampleRate);
      quiet = 0;
    } else {
      quiet++;
    }
  }
  return onsets;
}

/** RMS over [fromS, toS). */
export function rms(samples: Float32Array, sampleRate: number, fromS: number, toS: number): number {
  const from = Math.max(0, Math.floor(fromS * sampleRate));
  const to = Math.min(samples.length, Math.floor(toS * sampleRate));
  if (to <= from) return 0;
  let sum = 0;
  for (let i = from; i < to; i++) sum += samples[i]! * samples[i]!;
  return Math.sqrt(sum / (to - from));
}

// ---------------------------------------------------------------------------
// The pixel oracle: fixture frame N renders as color(N).
// ---------------------------------------------------------------------------

export interface Rgb { r: number; g: number; b: number }

export function fixtureColor(frameIndex: number): Rgb {
  return { r: (frameIndex * 16) % 256, g: 16 * Math.floor(frameIndex / 16), b: 128 };
}

/** Max channel distance between a decoded pixel and an expected color. */
export function colorDistance(a: Rgb, b: Rgb): number {
  return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b));
}

/** Average of the frame's decoded 2×2 center block. */
export function pixelAt(pixels: Buffer, frame: number): Rgb {
  const base = frame * 12;
  let r = 0, g = 0, b = 0;
  for (let p = 0; p < 4; p++) {
    r += pixels[base + p * 3]!;
    g += pixels[base + p * 3 + 1]!;
    b += pixels[base + p * 3 + 2]!;
  }
  return { r: r / 4, g: g / 4, b: b / 4 };
}

/** Frames in a center-pixels buffer (12 bytes per frame). */
export function pixelFrameCount(pixels: Buffer): number {
  return Math.floor(pixels.length / 12);
}
