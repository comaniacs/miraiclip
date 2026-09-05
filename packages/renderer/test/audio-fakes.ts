import type { Us } from "../src/media/types.js";
import type {
  AudioChannel,
  AudioChunk,
  AudioOutput,
  AudioTrackSource,
} from "../src/audio/types.js";

export interface ScheduledCall {
  channelId: string;
  native: unknown;
  whenUs: Us;
  offsetUs: Us;
  durationUs: Us;
  rate: number;
}

export class FakeChannel implements AudioChannel {
  gainValue = 1;
  stops = 0;
  closed = false;

  constructor(
    readonly id: string,
    private readonly log: ScheduledCall[],
  ) {}

  schedule(native: unknown, whenUs: Us, offsetUs: Us, durationUs: Us, rate: number): void {
    this.log.push({ channelId: this.id, native, whenUs, offsetUs, durationUs, rate });
  }
  setGain(value: number): void {
    this.gainValue = value;
  }
  stopAll(): void {
    this.stops++;
  }
  close(): void {
    this.closed = true;
  }
}

export class FakeOutput implements AudioOutput {
  nowUs: Us = 10_000_000; // arbitrary nonzero context time
  scheduled: ScheduledCall[] = [];
  channels = new Map<string, FakeChannel>();
  resumed = 0;
  closed = false;

  get currentTimeUs(): Us {
    return this.nowUs;
  }
  channel(id: string): AudioChannel {
    const channel = new FakeChannel(id, this.scheduled);
    this.channels.set(id, channel);
    return channel;
  }
  resume(): Promise<void> {
    this.resumed++;
    return Promise.resolve();
  }
  close(): void {
    this.closed = true;
  }
}

/** Synthetic audio: 500ms chunks covering the media duration. */
export class FakeAudioSource implements AudioTrackSource {
  static readonly CHUNK_US = 500_000;
  disposed = false;

  constructor(private readonly durationUs: Us) {}

  async *chunksFrom(startUs: Us): AsyncGenerator<AudioChunk, void, undefined> {
    const size = FakeAudioSource.CHUNK_US;
    let index = Math.floor(startUs / size);
    for (; index * size < this.durationUs; index++) {
      yield {
        timestampUs: index * size,
        durationUs: size,
        native: { chunk: index },
      };
      await Promise.resolve();
    }
  }

  dispose(): void {
    this.disposed = true;
  }
}

export const openFakeAudio =
  (durationUs: Us, noAudioAssets: Set<string> = new Set()) =>
  async (assetId: string): Promise<AudioTrackSource | null> =>
    noAudioAssets.has(assetId) ? null : new FakeAudioSource(durationUs);

/** Let queued microtasks (generator pulls) settle. */
export async function settle(rounds = 20): Promise<void> {
  for (let i = 0; i < rounds; i++) await Promise.resolve();
}
