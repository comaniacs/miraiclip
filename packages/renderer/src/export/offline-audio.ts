/**
 * Offline audio mix for export: the same clip math the realtime AudioEngine
 * uses (shared via audio/mapping.ts), rendered in one non-realtime pass with
 * an OfflineAudioContext instead of being scheduled against a live clock.
 */
import type { AudioClip, ProjectDocument, VideoClip } from "@miraiclip/core";
import type { Us } from "../media/types.js";
import { gainFor, isAudible, mapChunkToTimeline, volumeAutomation } from "../audio/mapping.js";
import type { AudioSourceFactory } from "../audio/types.js";
import { ExportAbortedError, type ExportRange, type MixAudioContext } from "./types.js";

export interface AudioMixJob {
  clipId: string;
  assetId: string;
  src: unknown;
  /** Media position to start pulling chunks from. */
  fromMediaUs: Us;
  gain: number;
  clip: VideoClip | AudioClip;
}

/**
 * The pure planning half: which clips contribute audio to the range, at what
 * gain, and where in their source to start reading. Headless-testable.
 */
export function planAudioJobs(doc: ProjectDocument, range: ExportRange): AudioMixJob[] {
  const jobs: AudioMixJob[] = [];
  for (const clip of Object.values(doc.clips)) {
    if (!isAudible(clip)) continue;
    const clipEndUs = clip.startUs + clip.durationUs;
    if (clipEndUs <= range.startUs || clip.startUs >= range.endUs) continue; // no overlap
    const gain = gainFor(clip, doc);
    const animated = (clip.animations?.volume?.length ?? 0) > 0;
    // Muted/soloed-out contributes nothing; a statically-zero volume still
    // contributes when volume KEYFRAMES can raise it.
    if (gain <= 0 && !animated) continue;
    const asset = doc.assets[clip.assetId];
    if (!asset) continue;
    const fromTimelineUs = Math.max(range.startUs, clip.startUs);
    jobs.push({
      clipId: clip.id,
      assetId: clip.assetId,
      src: asset.src,
      fromMediaUs: clip.trimStartUs + (fromTimelineUs - clip.startUs),
      gain,
      clip,
    });
  }
  return jobs;
}

export interface MixCompositionAudioOptions extends MixAudioContext {
  doc: ProjectDocument;
  range: ExportRange;
  openAudio: AudioSourceFactory;
  sampleRate?: number;
  channels?: number;
  /**
   * Return a zero-filled buffer instead of null when nothing contributes in
   * this range. Chunked exports set this for every chunk after deciding (via
   * `planAudioJobs` over the FULL range) that the composition has an audio
   * track: chunk timestamps accumulate by buffer duration, so a silent
   * stretch must still occupy its samples.
   */
  silenceIfEmpty?: boolean;
}

/**
 * Render the composition's audio mix for a range into a single AudioBuffer,
 * faster than realtime. Returns null when nothing contributes audio (the
 * export then has no audio track). Browser-only (OfflineAudioContext);
 * covered by the export e2e — the planning and mapping halves are unit-tested.
 */
export async function mixCompositionAudio(
  options: MixCompositionAudioOptions,
): Promise<AudioBuffer | null> {
  const { doc, range, openAudio, signal, onProgress } = options;
  const sampleRate = options.sampleRate ?? 48_000;
  const channels = options.channels ?? 2;
  const durationUs = range.endUs - range.startUs;
  if (durationUs <= 0) return null;
  const lengthSamples = Math.ceil((durationUs / 1_000_000) * sampleRate);
  // Zero-filled by construction — the silent stretch of an audible timeline.
  const silence = (): AudioBuffer =>
    new AudioBuffer({ length: lengthSamples, sampleRate, numberOfChannels: channels });
  const jobs = planAudioJobs(doc, range);
  if (jobs.length === 0) return options.silenceIfEmpty ? silence() : null;

  const context = new OfflineAudioContext(channels, lengthSamples, sampleRate);

  let contributed = false;
  // Decoding a long timeline's audio takes real time (it reads every audio
  // packet of every contributing asset) — report progress and honor aborts
  // between chunks so the phase is visible and cancellable.
  let maxMixedUs = 0;
  const reportMixed = (throughTimelineUs: Us): void => {
    const mixedUs = Math.min(throughTimelineUs - range.startUs, durationUs);
    if (mixedUs > maxMixedUs) {
      maxMixedUs = mixedUs;
      onProgress?.(mixedUs);
    }
  };
  await Promise.all(
    jobs.map(async (job) => {
      const source = await openAudio(job.assetId, job.src).catch(() => null);
      if (!source) return; // asset has no audio track
      try {
        const gainNode = context.createGain();
        const clipStartInRange = Math.max(range.startUs, job.clip.startUs);
        const clipEndInRange = Math.min(range.endUs, job.clip.startUs + job.clip.durationUs);
        const automation = volumeAutomation(job.clip, doc, clipStartInRange, clipEndInRange);
        if (automation) {
          // Same points live playback ramps through — preview/export parity.
          gainNode.gain.value = automation[0]!.value;
          for (const point of automation) {
            gainNode.gain.linearRampToValueAtTime(
              point.value,
              (point.atTimelineUs - range.startUs) / 1_000_000,
            );
          }
        } else {
          gainNode.gain.value = job.gain;
        }
        gainNode.connect(context.destination);
        const rangeEndTimelineUs = range.endUs;
        for await (const chunk of source.chunksFrom(job.fromMediaUs)) {
          if (signal?.aborted) throw new ExportAbortedError();
          const mapped = mapChunkToTimeline(
            job.clip,
            chunk.timestampUs,
            chunk.durationUs,
            Math.max(range.startUs, job.clip.startUs),
          );
          if (mapped === "behind") continue;
          if (mapped === "past-end") break;
          if (mapped.playFromTimelineUs >= rangeEndTimelineUs) break;
          const playDurationUs = Math.min(
            mapped.durationUs,
            rangeEndTimelineUs - mapped.playFromTimelineUs,
          );
          const node = context.createBufferSource();
          node.buffer = chunk.native as AudioBuffer;
          node.connect(gainNode);
          node.start(
            (mapped.playFromTimelineUs - range.startUs) / 1_000_000,
            mapped.offsetIntoChunkUs / 1_000_000,
            playDurationUs / 1_000_000,
          );
          contributed = true;
          reportMixed(mapped.playFromTimelineUs + playDurationUs);
        }
      } finally {
        source.dispose();
      }
    }),
  );
  if (!contributed) return options.silenceIfEmpty ? silence() : null;

  return context.startRendering();
}
