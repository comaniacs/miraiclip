import { describe, expect, it } from "vitest";
import { exportComposition } from "../src/export/exporter.js";
import { ExportAbortedError, type ExportProgress, type ExportSink } from "../src/export/types.js";

class FakeSink implements ExportSink {
  frames: { timestampUs: number; durationUs: number }[] = [];
  audio: unknown[] = [];
  finalized = false;
  cancelled = 0;
  failOnFrame: number | undefined;

  async addVideoFrame(timestampUs: number, durationUs: number): Promise<void> {
    if (this.failOnFrame !== undefined && this.frames.length === this.failOnFrame) {
      throw new Error("encoder exploded");
    }
    this.frames.push({ timestampUs, durationUs });
  }
  async addAudio(buffer: unknown): Promise<void> {
    this.audio.push(buffer);
  }
  async finalize(): Promise<Uint8Array> {
    this.finalized = true;
    return new Uint8Array([1, 2, 3]);
  }
  async cancel(): Promise<void> {
    this.cancelled++;
  }
}

function setup(overrides: { fps?: number; endUs?: number } = {}) {
  const sink = new FakeSink();
  const rendered: number[] = [];
  const events: ExportProgress[] = [];
  const run = (extra: Partial<Parameters<typeof exportComposition>[0]> = {}) =>
    exportComposition({
      startUs: 0,
      endUs: overrides.endUs ?? 1_000_000,
      fps: overrides.fps ?? 30,
      renderFrame: async (t) => {
        rendered.push(t);
      },
      sink,
      onProgress: (p) => events.push(p),
      ...extra,
    });
  return { sink, rendered, events, run };
}

describe("exportComposition", () => {
  it("walks every output frame in order and finalizes", async () => {
    const { sink, rendered, events, run } = setup(); // 1s @ 30fps
    const bytes = await run();
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(sink.frames.length).toBe(30);
    expect(rendered.length).toBe(30);
    // Monotonic, derived-not-accumulated timestamps; frames sample at their
    // temporal midpoint (robust to container timestamp rounding).
    expect(rendered[15]).toBe(500_000 + 16_666);
    for (let i = 1; i < rendered.length; i++) {
      expect(rendered[i]!).toBeGreaterThan(rendered[i - 1]!);
    }
    // Sink timestamps are range-relative and durations tile without gaps.
    expect(sink.frames[0]).toEqual({ timestampUs: 0, durationUs: 33_333 });
    const total = sink.frames.reduce((sum, f) => sum + f.durationUs, 0);
    expect(total).toBe(1_000_000); // last frame clipped to the exact end
    expect(sink.finalized).toBe(true);
    expect(sink.cancelled).toBe(0);
    // Progress: starts at 0, ends complete, then finalizing.
    expect(events[0]).toEqual({ phase: "video", framesDone: 0, totalFrames: 30 });
    expect(events.at(-1)).toEqual({ phase: "finalizing", framesDone: 30, totalFrames: 30 });
  });

  it("a range not divisible by the frame duration still ends exactly", async () => {
    const { sink, run } = setup({ endUs: 1_000_000 + 10_000 }); // 1.01s @ 30fps
    await run();
    expect(sink.frames.length).toBe(31); // ceil
    const total = sink.frames.reduce((sum, f) => sum + f.durationUs, 0);
    expect(total).toBe(1_010_000);
    expect(sink.frames.at(-1)!.durationUs).toBeLessThan(33_334); // clipped tail
  });

  it("mixes audio before video and adds it to the sink", async () => {
    const { sink, events, run } = setup();
    await run({ mixAudio: async () => ({ fake: "audiobuffer" }) });
    expect(sink.audio).toEqual([{ fake: "audiobuffer" }]);
    expect(events[0]!.phase).toBe("audio");
  });

  it("the audio mix is abortable and reports progress", async () => {
    const { sink, events, run } = setup();
    // Progress from inside the mix surfaces as audio-phase progress events.
    await run({
      mixAudio: async ({ onProgress }) => {
        onProgress?.(400_000);
        return { fake: "audiobuffer" };
      },
    });
    const audioEvents = events.filter((e) => e.phase === "audio");
    expect(audioEvents.at(-1)).toMatchObject({ audioMixedUs: 400_000, audioTotalUs: 1_000_000 });

    // An abort thrown inside the mix cancels the sink exactly once.
    const { sink: sink2, run: run2 } = setup();
    const controller = new AbortController();
    await expect(
      run2({
        signal: controller.signal,
        mixAudio: async ({ signal }) => {
          controller.abort();
          if (signal?.aborted) throw new ExportAbortedError();
          return null;
        },
      }),
    ).rejects.toThrow(ExportAbortedError);
    expect(sink2.cancelled).toBe(1);
    expect(sink2.frames.length).toBe(0);
    expect(sink.cancelled).toBe(0);
  });

  it("a null audio mix adds no audio track", async () => {
    const { sink, run } = setup();
    await run({ mixAudio: async () => null });
    expect(sink.audio).toEqual([]);
  });

  it("overlaps encoding with rendering in a bounded in-flight window", async () => {
    const sink = new FakeSink();
    let inFlight = 0;
    let peak = 0;
    const baseAdd = sink.addVideoFrame.bind(sink);
    sink.addVideoFrame = async (timestampUs, durationUs) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await baseAdd(timestampUs, durationUs); // capture happens "synchronously"
      await new Promise((resolve) => setTimeout(resolve, 1)); // slow encoder
      inFlight--;
    };
    await exportComposition({
      startUs: 0,
      endUs: 1_000_000,
      fps: 30,
      renderFrame: async () => undefined,
      sink,
    });
    expect(peak).toBeGreaterThan(1); // encoder worked while later frames rendered
    expect(peak).toBeLessThanOrEqual(4); // …but bounded (memory)
    const order = sink.frames.map((f) => f.timestampUs);
    expect(order).toEqual([...order].sort((a, b) => a - b)); // capture order intact
    expect(sink.frames.length).toBe(30);
    expect(sink.finalized).toBe(true);
  });

  it("abort mid-export cancels the sink exactly once and stops rendering", async () => {
    const { sink, rendered, run } = setup();
    const controller = new AbortController();
    const promise = run({
      renderFrame: async (t) => {
        rendered.push(t);
        if (rendered.length === 10) controller.abort();
      },
      signal: controller.signal,
    });
    await expect(promise).rejects.toThrow(ExportAbortedError);
    expect(rendered.length).toBe(10); // no frame rendered after the abort
    expect(sink.frames.length).toBeLessThan(10);
    expect(sink.cancelled).toBe(1);
    expect(sink.finalized).toBe(false);
  });

  it("abort before start renders nothing", async () => {
    const { sink, rendered, run } = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(run({ signal: controller.signal })).rejects.toThrow(ExportAbortedError);
    expect(rendered.length).toBe(0);
    expect(sink.cancelled).toBe(1);
  });

  it("a sink failure propagates and cancels the sink", async () => {
    const { sink, run } = setup();
    sink.failOnFrame = 5;
    await expect(run()).rejects.toThrow("encoder exploded");
    expect(sink.cancelled).toBe(1);
    expect(sink.finalized).toBe(false);
  });

  it("rejects an empty range and a bad fps", async () => {
    const { run } = setup({ endUs: 0 });
    await expect(run()).rejects.toThrow(/empty/);
    const { run: run2 } = setup();
    await expect(run2({ fps: 0 } as never)).rejects.toThrow(/fps/);
  });
});
