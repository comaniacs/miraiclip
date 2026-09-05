import type { Project } from "@miraiclip/core";
import { RealtimeClock } from "./clock.js";
import { Compositor } from "./compositor/compositor.js";
import type { SceneBackend } from "./compositor/types.js";
import { MediaManager } from "./media/media-manager.js";
import type { DemuxerFactory, FrameDecoderFactory, Us } from "./media/types.js";
import { createVideoSupport } from "./video/video-support.js";
import { AudioEngine } from "./audio/audio-engine.js";
import type { AudioOutput, AudioSourceFactory } from "./audio/types.js";

export interface CreatePlayerOptions {
  backend: SceneBackend;
  openDemuxer: DemuxerFactory;
  createDecoder: FrameDecoderFactory;
  audioOutput: AudioOutput;
  openAudio: AudioSourceFactory;
  /** Loop back to 0 at the end of the composition (default false: pause). */
  loop?: boolean;
  /** Media failures per clip (unsupported codec, decode error, …). Default: console.error. */
  onError?: (error: Error, clipId: string) => void;
  /** Frame scheduler — injectable for tests (default requestAnimationFrame). */
  raf?: (callback: () => void) => number;
  cancelRaf?: (handle: number) => void;
}

export interface Player {
  play(): void;
  pause(): void;
  seek(timeUs: Us): void;
  setRate(rate: number): void;
  readonly playing: boolean;
  readonly timeUs: Us;
  /** End of the last clip — the composition's duration. */
  readonly durationUs: Us;
  destroy(): void;
}

/**
 * The playback controller: wires media pipeline, compositor, audio engine and
 * the master clock into one transport. The clock is derived from the audio
 * output's own time, so scheduled audio and the frames chasing the clock
 * cannot drift apart. The playhead is pushed into the core each frame via
 * `setPlayhead` (ephemeral — never in undo history).
 */
export function createPlayer(project: Project, options: CreatePlayerOptions): Player {
  const raf =
    options.raf ??
    ((callback: () => void) => requestAnimationFrame(() => callback()) as unknown as number);
  const cancelRaf =
    options.cancelRaf ?? ((handle: number) => cancelAnimationFrame(handle));

  const manager = new MediaManager({
    openDemuxer: options.openDemuxer,
    createDecoder: options.createDecoder,
  });
  const videos = createVideoSupport(
    project,
    manager,
    options.onError ? { onError: options.onError } : {},
  );
  const compositor = new Compositor(project, options.backend, {
    factories: { video: videos.factory },
  });
  const audio = new AudioEngine(project, options.audioOutput, options.openAudio);
  const clock = new RealtimeClock(() => options.audioOutput.currentTimeUs / 1000);

  let destroyed = false;
  let rafHandle = 0;
  let lastPumpUs: Us = Number.NEGATIVE_INFINITY;
  let lastPlayheadUs: Us = Number.NEGATIVE_INFINITY;

  function durationUs(): Us {
    let end = 0;
    for (const clip of Object.values(project.getState().doc.clips)) {
      end = Math.max(end, clip.startUs + clip.durationUs);
    }
    return end;
  }

  function frame(): void {
    if (destroyed) return;
    let t = clock.timeUs;
    const end = durationUs();
    if (clock.playing && end > 0 && t >= end) {
      if (options.loop) {
        seekInternal(0, true);
        t = 0;
      } else {
        pause();
        clock.seek(end);
        t = end;
      }
    }
    compositor.renderAt(t);
    // Paused, nothing changes 60×/s: skip the playhead event (and the zustand
    // set + subscriber fan-out behind it) when the time hasn't moved.
    if (t !== lastPlayheadUs) {
      lastPlayheadUs = t;
      project.setPlayhead(t);
    }
    // Keep decode/schedule windows rolling without doing it every frame.
    if (Math.abs(t - lastPumpUs) > 300_000) {
      lastPumpUs = t;
      videos.prepare(t).catch(() => undefined); // per-clip errors surface via onError
      audio.pump(t);
    }
    rafHandle = raf(frame);
  }
  rafHandle = raf(frame);

  function seekInternal(timeUs: Us, resumeAudio: boolean): void {
    clock.seek(timeUs);
    lastPumpUs = Number.NEGATIVE_INFINITY;
    lastPlayheadUs = Number.NEGATIVE_INFINITY;
    void videos.prepare(timeUs);
    if (resumeAudio && clock.playing) audio.start(timeUs, clock.rate);
  }

  function pause(): void {
    clock.pause();
    audio.stop();
    lastPlayheadUs = Number.NEGATIVE_INFINITY; // one event so UI reflects the pause
  }

  return {
    play() {
      if (destroyed || clock.playing) return;
      void options.audioOutput.resume();
      const end = durationUs();
      if (end > 0 && clock.timeUs >= end) clock.seek(0);
      clock.play();
      lastPlayheadUs = Number.NEGATIVE_INFINITY; // one event so UI reflects the play
      audio.start(clock.timeUs, clock.rate);
    },
    pause,
    seek(timeUs) {
      if (destroyed) return;
      seekInternal(Math.max(0, timeUs), true);
    },
    setRate(rate) {
      if (destroyed) return;
      clock.setRate(rate);
      if (clock.playing) audio.start(clock.timeUs, rate);
    },
    get playing() {
      return clock.playing;
    },
    get timeUs() {
      return clock.timeUs;
    },
    get durationUs() {
      return durationUs();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelRaf(rafHandle);
      audio.dispose();
      videos.dispose();
      compositor.destroy();
      options.audioOutput.close();
    },
  };
}
