import type { Project } from "@miraiclip/core";
import { RealtimeClock } from "./clock.js";
import { Compositor } from "./compositor/compositor.js";
import type { NodeFactory, SceneBackend } from "./compositor/types.js";
import { MediaManager } from "./media/media-manager.js";
import type { DemuxerFactory, FrameDecoderFactory, Us } from "./media/types.js";
import { createVideoSupport } from "./video/video-support.js";
import { loadFontAssets } from "./captions/fonts.js";
import { AudioEngine } from "./audio/audio-engine.js";
import type { AudioOutput, AudioSourceFactory } from "./audio/types.js";

export interface CreatePlayerOptions {
  backend: SceneBackend;
  openDemuxer: DemuxerFactory;
  createDecoder: FrameDecoderFactory;
  audioOutput: AudioOutput;
  openAudio: AudioSourceFactory;
  /**
   * Scene-node factories for custom clip kinds (registered in core with
   * `registerClipKind`) — the same seam built-in video uses. Keyed by clip
   * kind; "video" is reserved (the player owns the video pipeline).
   */
  factories?: Record<string, NodeFactory>;
  /** Loop back to 0 at the end of the composition (default false: pause). */
  loop?: boolean;
  /** Media failures per clip (unsupported codec, decode error, …). Default: console.error. */
  onError?: (error: Error, clipId: string) => void;
  /** Frame scheduler — injectable for tests (default requestAnimationFrame). */
  raf?: (callback: () => void) => number;
  cancelRaf?: (handle: number) => void;
  /**
   * Interval scheduler for the hidden-tab fallback — injectable for tests
   * (default setInterval/clearInterval). See the pump interval below.
   */
  schedule?: (callback: () => void, intervalMs: number) => number;
  cancelSchedule?: (handle: number) => void;
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
    factories: { ...options.factories, video: videos.factory },
  });
  const audio = new AudioEngine(project, options.audioOutput, options.openAudio);
  const clock = new RealtimeClock(() => options.audioOutput.currentTimeUs / 1000);

  // Font assets → document FontFaces. When one finishes loading, text metrics
  // changed under every text/caption node — re-sync so glyphs re-lay out.
  const reloadFonts = (): void => {
    void loadFontAssets(project.getState().doc).then((changed) => {
      if (changed && !destroyed) compositor.resync();
    });
  };
  reloadFonts();
  const offFontPatches = project.events.on("patches", ({ patches }) => {
    if (patches.some((op) => op.path.startsWith("/assets"))) reloadFonts();
  });

  let destroyed = false;
  let rafHandle = 0;
  let lastPumpUs: Us = Number.NEGATIVE_INFINITY;
  let lastPlayheadUs: Us = Number.NEGATIVE_INFINITY;
  // Transport hold: play/seek-while-playing wait (bounded) for the target
  // frame to actually ARRIVE before the clock runs. A clock running over an
  // empty or stale frame cache shows black or pre-seek pixels for the decode
  // catch-up window — invisible with static opacity, but keyframed opacity
  // turns it into visible flicker at playback starts and replays.
  let holdEpoch = 0;
  let pendingPlay = false;

  function durationUs(): Us {
    let end = 0;
    for (const clip of Object.values(project.getState().doc.clips)) {
      end = Math.max(end, clip.startUs + clip.durationUs);
    }
    return end;
  }

  /** Transport bookkeeping: end-of-composition + decode/audio window pumping. */
  function advance(): Us {
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
    // Keep decode/schedule windows rolling without doing it every frame.
    if (Math.abs(t - lastPumpUs) > 300_000) {
      lastPumpUs = t;
      videos.prepare(t).catch(() => undefined); // per-clip errors surface via onError
      audio.pump(t);
    }
    return t;
  }

  function frame(): void {
    if (destroyed) return;
    const t = advance();
    compositor.renderAt(t);
    // Paused, nothing changes 60×/s: skip the playhead event (and the zustand
    // set + subscriber fan-out behind it) when the time hasn't moved.
    if (t !== lastPlayheadUs) {
      lastPlayheadUs = t;
      project.setPlayhead(t);
    }
    rafHandle = raf(frame);
  }
  rafHandle = raf(frame);

  // Hidden-tab fallback: requestAnimationFrame freezes when the tab is hidden,
  // but WebAudio keeps playing — without this, the audio stalls as soon as its
  // scheduling window (~3s) runs dry and never recovers. A timer keeps the
  // decode and audio windows rolling (no rendering — nothing is visible); when
  // the tab returns, the rAF loop resumes drawing from a warm cache. Audible
  // pages are exempt from Chrome's intensive timer throttling, so a 500ms
  // interval is dependable while sound is playing.
  const schedule =
    options.schedule ??
    ((callback: () => void, intervalMs: number) =>
      setInterval(callback, intervalMs) as unknown as number);
  const cancelSchedule =
    options.cancelSchedule ?? ((handle: number) => clearInterval(handle));
  const pumpHandle = schedule(() => {
    if (!destroyed && clock.playing) advance();
  }, 500);

  /** Resume the transport once the target frame is ready (capped at 400ms). */
  function resumeWhenReady(timeUs: Us): void {
    const epoch = ++holdEpoch;
    pendingPlay = true;
    const ready = videos.prepare(timeUs).catch(() => undefined);
    const cap = new Promise<void>((resolve) => setTimeout(resolve, 400));
    void Promise.race([ready, cap]).then(() => {
      if (destroyed || epoch !== holdEpoch || !pendingPlay) return;
      pendingPlay = false;
      clock.play();
      lastPlayheadUs = Number.NEGATIVE_INFINITY; // one event so UI reflects the play
      audio.start(clock.timeUs, clock.rate);
    });
  }

  function seekInternal(timeUs: Us, resumeAudio: boolean): void {
    const wasPlaying = clock.playing || pendingPlay;
    clock.pause();
    clock.seek(timeUs);
    lastPlayheadUs = Number.NEGATIVE_INFINITY;
    if (resumeAudio && wasPlaying) {
      // The hold's prepare IS the seek's decode kick — mark the pump current
      // so the next advance() doesn't race a second prepare into the same
      // target (measured: it double-reseeked the decoder on every seek).
      lastPumpUs = timeUs;
      audio.stop();
      resumeWhenReady(timeUs); // audio restarts in sync with the ready frame
    } else {
      lastPumpUs = Number.NEGATIVE_INFINITY;
      void videos.prepare(timeUs);
    }
  }

  function pause(): void {
    holdEpoch++; // cancel any pending resume
    pendingPlay = false;
    clock.pause();
    audio.stop();
    lastPlayheadUs = Number.NEGATIVE_INFINITY; // one event so UI reflects the pause
  }

  return {
    play() {
      if (destroyed || clock.playing || pendingPlay) return;
      void options.audioOutput.resume();
      const end = durationUs();
      if (end > 0 && clock.timeUs >= end) clock.seek(0);
      resumeWhenReady(clock.timeUs);
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
      // A transport hold is still "playing" to the outside world — the user
      // pressed play/seeked; the clock just hasn't been released yet.
      return clock.playing || pendingPlay;
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
      offFontPatches();
      cancelRaf(rafHandle);
      cancelSchedule(pumpHandle);
      audio.dispose();
      videos.dispose();
      compositor.destroy();
      options.audioOutput.close();
    },
  };
}
