import type { AudioClip, Project, ProjectDocument, VideoClip } from "@miraiclip/core";
import type { Us } from "../media/types.js";
import { gainFor, isAudible, mapChunkToTimeline, volumeAutomation } from "./mapping.js";
import type { AudioChannel, AudioOutput, AudioSourceFactory, AudioTrackSource } from "./types.js";

export interface AudioEngineOptions {
  /** How far ahead of the playhead audio is kept scheduled (default 3s). */
  aheadUs?: Us;
  /**
   * Open a clip's audio source this long before it enters the scheduling
   * window (default 1s), and close it this long after the clip ends. Only
   * clips near the playhead hold an open source: each one is a demuxer with
   * its own read cache, and opening every audible clip of a long timeline at
   * play start doesn't scale.
   */
  prerollUs?: Us;
}

interface ClipLane {
  clipId: string;
  channel: AudioChannel;
  source: AudioTrackSource | null | undefined; // undefined = still opening
  generator: AsyncGenerator<import("./types.js").AudioChunk, void, undefined> | null;
  /** Timeline position scheduled through (exclusive). */
  scheduledThroughUs: Us;
  /** Waiting for the window to advance before pulling more. */
  parked: boolean;
  exhausted: boolean;
}

/**
 * Schedules decoded audio against the output clock. The mapping is anchored
 * once per start/seek: timeline time t plays at output time
 * `anchorOutputUs + (t - anchorTimelineUs) / rate`. Because the master clock
 * IS the output clock, video (which chases the clock) and audio (scheduled on
 * it) cannot drift apart.
 */
export class AudioEngine {
  private readonly aheadUs: Us;
  private readonly prerollUs: Us;
  private readonly lanes = new Map<string, ClipLane>();
  private readonly unsubscribe: () => void;
  private epoch = 0;
  private playing = false;
  private rate = 1;
  private anchorTimelineUs: Us = 0;
  private anchorOutputUs: Us = 0;
  private windowEndUs: Us = 0;
  private disposed = false;

  constructor(
    private readonly project: Project,
    private readonly output: AudioOutput,
    private readonly openAudio: AudioSourceFactory,
    options: AudioEngineOptions = {},
  ) {
    this.aheadUs = options.aheadUs ?? 3_000_000;
    this.prerollUs = options.prerollUs ?? 1_000_000;
    this.unsubscribe = project.events.on("patches", () => this.onDocChanged());
  }

  private doc(): ProjectDocument {
    return this.project.getState().doc;
  }

  /** Begin (or re-anchor after a seek/rate change) playback at `timelineUs`. */
  start(timelineUs: Us, rate = 1): void {
    if (this.disposed) return;
    this.stop();
    this.playing = true;
    this.rate = rate;
    this.epoch++;
    this.anchorTimelineUs = timelineUs;
    this.anchorOutputUs = this.output.currentTimeUs;
    this.windowEndUs = timelineUs + this.aheadUs;
    this.admitLanes(timelineUs);
  }

  /**
   * Start lanes for audible clips that overlap [timelineUs, window end +
   * preroll) and aren't running yet; close lanes whose clip ended more than
   * `prerollUs` before `timelineUs`. Clips further ahead start from pump()
   * as the window reaches them.
   */
  private admitLanes(timelineUs: Us): void {
    const doc = this.doc();
    const horizonUs = this.windowEndUs + this.prerollUs;
    for (const [clipId, lane] of this.lanes) {
      const clip = doc.clips[clipId];
      if (clip && clip.startUs + clip.durationUs > timelineUs - this.prerollUs) continue;
      this.closeLane(clipId, lane);
    }
    for (const clip of Object.values(doc.clips)) {
      if (!isAudible(clip)) continue;
      if (clip.startUs + clip.durationUs <= timelineUs) continue; // already over
      if (clip.startUs >= horizonUs) continue; // not near yet
      const lane = this.lanes.get(clip.id);
      // Already running, finished, or its source is still opening.
      if (lane && (lane.generator || lane.exhausted || lane.source === undefined)) continue;
      this.startLane(clip, this.epoch);
    }
  }

  private closeLane(clipId: string, lane: ClipLane): void {
    this.lanes.delete(clipId);
    lane.channel.stopAll();
    lane.channel.close();
    const generator = lane.generator;
    lane.generator = null;
    void generator?.return?.(undefined)?.catch(() => undefined);
    lane.source?.dispose();
  }

  /** Extend the scheduling window as the clock advances. Call periodically. */
  pump(timelineUs: Us): void {
    if (!this.playing || this.disposed) return;
    this.windowEndUs = timelineUs + this.aheadUs;
    this.admitLanes(timelineUs);
    const doc = this.doc();
    for (const lane of this.lanes.values()) {
      const clip = doc.clips[lane.clipId];
      if (clip && isAudible(clip)) this.applyGain(lane, clip, timelineUs);
      if (lane.parked && !lane.exhausted) {
        lane.parked = false;
        void this.pull(lane, this.epoch);
      }
    }
  }

  /**
   * Static volume: one setGain. Animated volume: linear-ramp automation over
   * the scheduling window, in output-clock time (per-window stepping would
   * zipper) — re-issued every pump as the window advances.
   */
  private applyGain(lane: ClipLane, clip: VideoClip | AudioClip, fromTimelineUs: Us): void {
    const doc = this.doc();
    const points = volumeAutomation(clip, doc, fromTimelineUs, this.windowEndUs);
    if (!points || !lane.channel.setGainAutomation) {
      lane.channel.setGain(gainFor(clip, doc, points ? fromTimelineUs : undefined));
      return;
    }
    lane.channel.setGainAutomation(
      points.map((point) => ({
        atOutputUs:
          this.anchorOutputUs + (point.atTimelineUs - this.anchorTimelineUs) / this.rate,
        value: point.value,
      })),
    );
  }

  /** Stop all scheduled audio (pause or pre-seek). */
  stop(): void {
    this.epoch++;
    this.playing = false;
    for (const lane of this.lanes.values()) {
      lane.channel.stopAll();
      void lane.generator?.return?.(undefined)?.catch(() => undefined);
      lane.generator = null;
      lane.parked = false;
      lane.exhausted = false;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.unsubscribe();
    for (const lane of this.lanes.values()) {
      lane.channel.close();
      lane.source?.dispose();
    }
    this.lanes.clear();
  }

  // -------------------------------------------------------------------------

  private startLane(clip: VideoClip | AudioClip, epoch: number): void {
    let lane = this.lanes.get(clip.id);
    if (!lane) {
      lane = {
        clipId: clip.id,
        channel: this.output.channel(clip.id),
        source: undefined,
        generator: null,
        scheduledThroughUs: 0,
        parked: false,
        exhausted: false,
      };
      this.lanes.set(clip.id, lane);
    }
    this.applyGain(lane, clip, Math.max(this.anchorTimelineUs, clip.startUs));

    const asset = this.doc().assets[clip.assetId];
    if (!asset) return;
    const begin = (source: AudioTrackSource | null) => {
      if (this.lanes.get(clip.id) !== lane || this.disposed) {
        // The lane was closed while its source was opening: nothing will
        // ever dispose this source otherwise.
        if (source && lane.source !== source) source.dispose();
        return;
      }
      if (epoch !== this.epoch) {
        lane.source = source; // keep it for the next start()
        return;
      }
      lane.source = source;
      if (!source) return; // asset has no audio track
      const fromTimelineUs = Math.max(this.anchorTimelineUs, clip.startUs);
      const fromMediaUs = clip.trimStartUs + (fromTimelineUs - clip.startUs);
      lane.generator = source.chunksFrom(fromMediaUs);
      lane.scheduledThroughUs = fromTimelineUs;
      lane.exhausted = false;
      void this.pull(lane, epoch);
    };
    if (lane.source !== undefined) begin(lane.source);
    else {
      void this.openAudio(clip.assetId, asset.src).then(begin).catch(() => begin(null));
    }
  }

  private async pull(lane: ClipLane, epoch: number): Promise<void> {
    const clip = this.doc().clips[lane.clipId];
    if (!clip || !isAudible(clip) || !lane.generator) return;

    while (epoch === this.epoch && !this.disposed) {
      if (lane.scheduledThroughUs >= this.windowEndUs) {
        lane.parked = true; // resume from pump()
        return;
      }
      if (!lane.generator) return; // closed meanwhile
      const generator: AsyncGenerator<import("./types.js").AudioChunk, void, undefined> = lane.generator;
      let next: IteratorResult<import("./types.js").AudioChunk, void>;
      try {
        next = await generator.next();
      } catch (error) {
        // The lane was closed (its source disposed) or re-anchored while this
        // read was in flight: teardown, not a media error.
        if (epoch !== this.epoch || this.disposed || lane.generator !== generator || !this.lanes.has(lane.clipId)) return;
        throw error;
      }
      const { value: chunk, done } = next;
      if (epoch !== this.epoch || this.disposed || lane.generator !== generator) return;
      if (done || !chunk) {
        lane.exhausted = true;
        return;
      }

      // Media time → timeline time for this clip (shared with offline export).
      const mapped = mapChunkToTimeline(
        clip,
        chunk.timestampUs,
        chunk.durationUs,
        this.anchorTimelineUs,
      );
      if (mapped === "behind") continue;
      if (mapped === "past-end") {
        lane.exhausted = true;
        return;
      }

      const whenUs =
        this.anchorOutputUs +
        (mapped.playFromTimelineUs - this.anchorTimelineUs) / this.rate;
      lane.channel.schedule(
        chunk.native,
        whenUs,
        mapped.offsetIntoChunkUs,
        mapped.durationUs,
        this.rate,
      );
      lane.scheduledThroughUs = mapped.playFromTimelineUs + mapped.durationUs;
    }
  }

  private onDocChanged(): void {
    if (this.disposed) return;
    const doc = this.doc();
    // Drop lanes whose clips are gone.
    for (const [clipId, lane] of this.lanes) {
      if (!doc.clips[clipId]) {
        lane.channel.stopAll();
        lane.channel.close();
        lane.source?.dispose();
        this.lanes.delete(clipId);
      }
    }
    // Refresh gains (clip volume, track mute/solo, volume keyframes).
    for (const [clipId, lane] of this.lanes) {
      const clip = doc.clips[clipId];
      if (clip && isAudible(clip)) this.applyGain(lane, clip, this.anchorTimelineUs);
    }
    // New audible clips join a running playback once near the window (the
    // next pump admits ones further ahead).
    if (this.playing) {
      const horizonUs = this.windowEndUs + this.prerollUs;
      for (const clip of Object.values(doc.clips)) {
        if (!isAudible(clip) || this.lanes.has(clip.id)) continue;
        if (clip.startUs + clip.durationUs <= this.anchorTimelineUs) continue;
        if (clip.startUs >= horizonUs) continue;
        this.startLane(clip, this.epoch);
      }
    }
  }
}
