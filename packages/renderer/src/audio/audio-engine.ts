import type { AudioClip, Clip, Project, ProjectDocument, VideoClip } from "@miraiclip/core";
import type { Us } from "../media/types.js";
import type { AudioChannel, AudioOutput, AudioSourceFactory, AudioTrackSource } from "./types.js";

export interface AudioEngineOptions {
  /** How far ahead of the playhead audio is kept scheduled (default 3s). */
  aheadUs?: Us;
}

/** Clips that can make sound: audio clips, and video clips (embedded track). */
function isAudible(clip: Clip): clip is VideoClip | AudioClip {
  return clip.kind === "audio" || clip.kind === "video";
}

/** Effective gain: clip volume × track mute/solo state. */
function gainFor(clip: VideoClip | AudioClip, doc: ProjectDocument): number {
  const track = doc.tracks[clip.trackId];
  if (!track) return 0;
  const anySolo = Object.values(doc.tracks).some((t) => t.solo);
  const audible = !track.muted && (!anySolo || track.solo);
  return audible ? clip.volume : 0;
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
    for (const clip of Object.values(this.doc().clips)) {
      if (!isAudible(clip)) continue;
      if (clip.startUs + clip.durationUs <= timelineUs) continue; // already over
      this.startLane(clip, this.epoch);
    }
  }

  /** Extend the scheduling window as the clock advances. Call periodically. */
  pump(timelineUs: Us): void {
    if (!this.playing || this.disposed) return;
    this.windowEndUs = timelineUs + this.aheadUs;
    for (const lane of this.lanes.values()) {
      if (lane.parked && !lane.exhausted) {
        lane.parked = false;
        void this.pull(lane, this.epoch);
      }
    }
  }

  /** Stop all scheduled audio (pause or pre-seek). */
  stop(): void {
    this.epoch++;
    this.playing = false;
    for (const lane of this.lanes.values()) {
      lane.channel.stopAll();
      void lane.generator?.return?.(undefined);
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
    lane.channel.setGain(gainFor(clip, this.doc()));

    const asset = this.doc().assets[clip.assetId];
    if (!asset) return;
    const begin = (source: AudioTrackSource | null) => {
      if (epoch !== this.epoch || this.disposed) return;
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
    const clipEndUs = clip.startUs + clip.durationUs;
    const trimUs = clip.trimStartUs;

    while (epoch === this.epoch && !this.disposed) {
      if (lane.scheduledThroughUs >= this.windowEndUs) {
        lane.parked = true; // resume from pump()
        return;
      }
      const { value: chunk, done } = await lane.generator.next();
      if (epoch !== this.epoch || this.disposed) return;
      if (done || !chunk) {
        lane.exhausted = true;
        return;
      }

      // Media time → timeline time for this clip.
      const timelineStartUs = clip.startUs + (chunk.timestampUs - trimUs);
      const timelineEndUs = timelineStartUs + chunk.durationUs;
      if (timelineEndUs <= this.anchorTimelineUs) continue; // entirely behind
      if (timelineStartUs >= clipEndUs) {
        lane.exhausted = true; // past the clip's end
        return;
      }

      const playFromUs = Math.max(timelineStartUs, this.anchorTimelineUs);
      const offsetUs = playFromUs - timelineStartUs;
      const durationUs = Math.min(timelineEndUs, clipEndUs) - playFromUs;
      const whenUs =
        this.anchorOutputUs + (playFromUs - this.anchorTimelineUs) / this.rate;
      lane.channel.schedule(chunk.native, whenUs, offsetUs, durationUs, this.rate);
      lane.scheduledThroughUs = Math.min(timelineEndUs, clipEndUs);
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
    // Refresh gains (clip volume, track mute/solo).
    for (const [clipId, lane] of this.lanes) {
      const clip = doc.clips[clipId];
      if (clip && isAudible(clip)) lane.channel.setGain(gainFor(clip, doc));
    }
    // New audible clips join a running playback.
    if (this.playing) {
      for (const clip of Object.values(doc.clips)) {
        if (!isAudible(clip) || this.lanes.has(clip.id)) continue;
        if (clip.startUs + clip.durationUs <= this.anchorTimelineUs) continue;
        this.startLane(clip, this.epoch);
      }
    }
  }
}
