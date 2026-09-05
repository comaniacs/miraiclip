/**
 * Browser adapters: mediabunny audio decoding and a WebAudio output.
 * Everything above this file is environment-agnostic and tested headless.
 */
import { ALL_FORMATS, AudioBufferSink, BlobSource, Input, UrlSource } from "mediabunny";
import type { Us } from "../media/types.js";
import { UnsupportedMediaError } from "../media/types.js";
import type { AudioChannel, AudioChunk, AudioOutput, AudioTrackSource } from "./types.js";

const US_PER_SECOND = 1_000_000;

class MediabunnyAudioSource implements AudioTrackSource {
  constructor(private readonly sink: AudioBufferSink) {}

  async *chunksFrom(startUs: Us): AsyncGenerator<AudioChunk, void, undefined> {
    for await (const wrapped of this.sink.buffers(startUs / US_PER_SECOND)) {
      yield {
        timestampUs: Math.round(wrapped.timestamp * US_PER_SECOND),
        durationUs: Math.round(wrapped.duration * US_PER_SECOND),
        native: wrapped.buffer,
      };
    }
  }

  dispose(): void {
    // mediabunny inputs hold no OS resources; GC handles it.
  }
}

/** Open an asset's primary audio track; resolves null when it has none. */
export async function openMediabunnyAudio(
  assetId: string,
  src: unknown,
): Promise<AudioTrackSource | null> {
  const source =
    typeof src === "string"
      ? new UrlSource(src)
      : src instanceof Blob
        ? new BlobSource(src)
        : null;
  if (!source) {
    throw new UnsupportedMediaError(assetId, "src must be a URL string or a Blob/File");
  }
  const input = new Input({ formats: ALL_FORMATS, source });
  const track = await input.getPrimaryAudioTrack();
  if (!track) return null;
  if (!(await track.canDecode())) return null;
  return new MediabunnyAudioSource(new AudioBufferSink(track));
}

class WebAudioChannel implements AudioChannel {
  private readonly gain: GainNode;
  private readonly active = new Set<AudioBufferSourceNode>();

  constructor(private readonly context: AudioContext) {
    this.gain = context.createGain();
    this.gain.connect(context.destination);
  }

  schedule(native: unknown, whenUs: Us, offsetUs: Us, durationUs: Us, rate: number): void {
    if (durationUs <= 0) return;
    const node = this.context.createBufferSource();
    node.buffer = native as AudioBuffer;
    node.playbackRate.value = rate;
    node.connect(this.gain);
    const now = this.context.currentTime;
    const when = Math.max(whenUs / US_PER_SECOND, now);
    // A deadline already in the past: start immediately, further into the buffer.
    const lateUs = Math.max(0, now * US_PER_SECOND - whenUs);
    node.start(when, (offsetUs + lateUs * rate) / US_PER_SECOND, durationUs / US_PER_SECOND);
    this.active.add(node);
    node.onended = () => this.active.delete(node);
  }

  setGain(value: number): void {
    this.gain.gain.value = value;
  }

  stopAll(): void {
    for (const node of this.active) {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
    }
    this.active.clear();
  }

  close(): void {
    this.stopAll();
    this.gain.disconnect();
  }
}

class WebAudioOutput implements AudioOutput {
  constructor(private readonly context: AudioContext) {}

  get currentTimeUs(): Us {
    return this.context.currentTime * US_PER_SECOND;
  }

  channel(): AudioChannel {
    return new WebAudioChannel(this.context);
  }

  resume(): Promise<void> {
    return this.context.state === "suspended" ? this.context.resume() : Promise.resolve();
  }

  close(): void {
    void this.context.close();
  }
}

/** Create the WebAudio output (and its master clock source). */
export function createWebAudioOutput(context?: AudioContext): AudioOutput {
  return new WebAudioOutput(context ?? new AudioContext());
}
