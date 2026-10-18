/**
 * The browser recorder: screen (+ microphone) into one file and the camera
 * into another, encoded with WebCodecs while you record, streamed to a
 * writable or collected in memory — plus the interaction log, on the same
 * clock. Browser-only.
 */
import {
  BufferTarget,
  MediaStreamAudioTrackSource,
  MediaStreamVideoTrackSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  StreamTarget,
  WebMOutputFormat,
  canEncodeVideo,
  type StreamTargetChunk,
} from "mediabunny";
import { estimateViewportInVideo, fitResizedEvents, type DisplaySurface } from "./surface.js";
import { createEventLogger, type EventLoggerOptions } from "./event-log.js";
import type { CaptureEvent, CaptureMedia, CaptureSession } from "./types.js";

export type RecordingFormat = "webm" | "mp4";

export interface StartRecordingOptions {
  /**
   * Screen capture: `true` asks the user to pick a screen, window or tab;
   * pass `DisplayMediaStreamOptions` to steer it (e.g. `{ video: true, preferCurrentTab: true }`),
   * or a `MediaStream` you already have. `false` records no screen.
   */
  screen?: boolean | DisplayMediaStreamOptions | MediaStream;
  /** Record the microphone into the screen file (`true`, a device id, or a stream). */
  microphone?: boolean | string | MediaStream;
  /** Record the camera into its own file (`true`, a device id, or a stream). */
  camera?: boolean | string | MediaStream;
  /** Container (default "webm": VP9 + Opus everywhere; "mp4" needs an H.264 encoder). */
  format?: RecordingFormat;
  /** "standard" (default) or "high". */
  quality?: "standard" | "high";
  /** Capture frame rate (default 30). */
  frameRate?: number;
  /**
   * Ask for the system cursor in the screen video: "always", "motion" or
   * "never". A request only: Chrome ignores it (it never records the pointer
   * in a tab capture and always does in a window or screen capture). Check
   * `session.cursorInVideo` for what happened.
   */
  cursor?: "always" | "motion" | "never";
  /** Stream the screen file here instead of keeping it in memory (e.g. a save-picker writable). */
  screenTarget?: WritableStream<StreamTargetChunk>;
  /** Stream the camera file here. */
  cameraTarget?: WritableStream<StreamTargetChunk>;
  /** Log interactions in this document (default true when recording the current tab or no screen). */
  events?: boolean | EventLoggerOptions;
  /** Called when the browser ends the screen share (the user pressed "Stop sharing"); `stop()` returns the same result. */
  onEnded?: (result: RecordingResult) => void;
}

export interface Recording {
  /** Microseconds since the recording started. */
  readonly elapsedUs: number;
  readonly paused: boolean;
  pause(): void;
  resume(): void;
  /** Add a named marker (a step, a chapter) at the current time. */
  mark(label: string, data?: Record<string, unknown>): void;
  /**
   * Add an event logged somewhere else (another tab or window), already on
   * this recording's clock and coordinates (see `clockAt` and `eventToFrame`).
   */
  addEvent(event: CaptureEvent): void;
  /**
   * The recording time (µs) of a moment given as epoch milliseconds
   * (`performance.timeOrigin + performance.now()` in any tab of this browser).
   */
  clockAt(epochMs: number): number;
  /** Finish: stops every track, finalizes the files and returns them with the session. */
  stop(): Promise<RecordingResult>;
  /** Stop and throw everything away. */
  cancel(): Promise<void>;
}

export interface RecordingResult {
  /** The screen (+ microphone) file — absent when it was streamed to `screenTarget`. */
  screen?: Blob;
  camera?: Blob;
  session: CaptureSession;
}

const MIME: Record<RecordingFormat, string> = { webm: "video/webm", mp4: "video/mp4" };

async function streamFor(
  request: boolean | string | MediaStream | undefined,
  kind: "audio" | "video",
): Promise<MediaStream | undefined> {
  if (!request) return undefined;
  if (typeof MediaStream !== "undefined" && request instanceof MediaStream) return request;
  const constraint = typeof request === "string" ? { deviceId: { exact: request } } : true;
  return navigator.mediaDevices.getUserMedia(kind === "audio" ? { audio: constraint } : { video: constraint });
}

interface OpenOutput {
  output: Output;
  sources: { pause(): void; resume(): void }[];
  buffer?: BufferTarget;
  media: CaptureMedia;
}

async function openOutput(
  video: MediaStreamVideoTrack | undefined,
  audio: MediaStreamAudioTrack | undefined,
  options: StartRecordingOptions,
  target: WritableStream<StreamTargetChunk> | undefined,
): Promise<OpenOutput> {
  const format = options.format ?? "webm";
  const codec = format === "mp4" ? "avc" : "vp9";
  if (video && !(await canEncodeVideo(codec))) {
    throw new Error(`this browser can't encode ${codec} video — record as ${format === "mp4" ? '"webm"' : '"mp4"'} instead`);
  }
  const buffer = target ? undefined : new BufferTarget();
  const output = new Output({
    format: format === "mp4" ? new Mp4OutputFormat({ fastStart: target ? "fragmented" : "in-memory" }) : new WebMOutputFormat(),
    target: target ? new StreamTarget(target, { chunked: true }) : buffer!,
  });
  const sources: { pause(): void; resume(): void }[] = [];
  const quality = options.quality === "high" ? QUALITY_HIGH : QUALITY_MEDIUM;
  const media: CaptureMedia = { mimeType: MIME[format] };
  if (video) {
    const settings = video.getSettings();
    if (settings.width) media.width = settings.width;
    if (settings.height) media.height = settings.height;
    // The file keeps its first frame size: a tab or window resized while recording is scaled to fit
    // (centred), instead of the encoder rejecting the new size and the video freezing.
    const source = new MediaStreamVideoTrackSource(video, { codec, bitrate: quality, sizeChangeBehavior: "contain" }, { frameRate: options.frameRate ?? 30 });
    output.addVideoTrack(source, { frameRate: options.frameRate ?? 30 });
    sources.push(source);
  }
  if (audio) {
    const source = new MediaStreamAudioTrackSource(audio, { codec: format === "mp4" ? "aac" : "opus", bitrate: quality });
    output.addAudioTrack(source);
    sources.push(source);
  }
  await output.start();
  return { output, sources, ...(buffer ? { buffer } : {}), media };
}

/** Several live audio tracks as one (Web Audio), for recording into a single file. */
function mixAudioTracks(tracks: MediaStreamTrack[]): { track: MediaStreamAudioTrack; close(): void } {
  const ctx = new AudioContext();
  const out = ctx.createMediaStreamDestination();
  for (const t of tracks) ctx.createMediaStreamSource(new MediaStream([t])).connect(out);
  return { track: out.stream.getAudioTracks()[0] as MediaStreamAudioTrack, close: () => void ctx.close().catch(() => undefined) };
}

function displayRequest(request: true | DisplayMediaStreamOptions, options: StartRecordingOptions): DisplayMediaStreamOptions {
  const base: DisplayMediaStreamOptions = request === true ? { video: { frameRate: options.frameRate ?? 30 }, audio: false } : { ...request };
  if (options.cursor) {
    const video = typeof base.video === "object" ? base.video : {};
    base.video = { ...video, cursor: options.cursor } as MediaTrackConstraints;
  }
  return base;
}

/** Start recording. Resolves once every track is live and the clock has started. */
export async function startRecording(options: StartRecordingOptions = {}): Promise<Recording> {
  const screenRequest = options.screen ?? true;
  const screenStream =
    screenRequest === false
      ? undefined
      : typeof MediaStream !== "undefined" && screenRequest instanceof MediaStream
        ? screenRequest
        : await navigator.mediaDevices.getDisplayMedia(displayRequest(screenRequest as true | DisplayMediaStreamOptions, options));
  const stopAll: MediaStream[] = [];
  try {
    const micStream = await streamFor(options.microphone, "audio");
    const camStream = await streamFor(options.camera, "video");
    for (const s of [screenStream, micStream, camStream]) if (s) stopAll.push(s);

    const screenVideo = screenStream?.getVideoTracks()[0];
    const tabAudio = screenStream?.getAudioTracks()[0];
    const micTrack = micStream?.getAudioTracks()[0];
    // The microphone and the shared tab's or screen's own sound, mixed into one track.
    const mix = micTrack && tabAudio ? mixAudioTracks([micTrack, tabAudio]) : undefined;
    const audioTrack = mix?.track ?? micTrack ?? tabAudio;
    const screen = screenVideo || audioTrack ? await openOutput(screenVideo, audioTrack, options, options.screenTarget) : undefined;
    const camera = camStream ? await openOutput(camStream.getVideoTracks()[0], undefined, options, options.cameraTarget) : undefined;

    const videoSettings = screenVideo?.getSettings() as { displaySurface?: string; width?: number; height?: number } | undefined;
    const surface = videoSettings?.displaySurface;
    const logEvents = options.events ?? (screenStream === undefined || surface === "browser");
    // Where the logged page sits in the frame, measured now (before the window can change):
    // the whole frame for a tab, an estimate for a window or a screen.
    const knownSurface = surface === "browser" || surface === "window" || surface === "monitor" ? (surface as DisplaySurface) : undefined;
    // Is the real pointer in the video? Chrome never draws it into a tab capture and always into a
    // window or screen capture (it ignores the cursor constraint); browsers that report it are believed.
    const reportedCursor = (videoSettings as { cursor?: string } | undefined)?.cursor;
    const cursorInVideo = reportedCursor ? reportedCursor !== "never" : knownSurface !== "browser";
    const viewportAtStart = { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio || 1 };
    const frameAspect = videoSettings?.width && videoSettings.height ? videoSettings.width / videoSettings.height : undefined;
    const matchesFrame = (v: { width: number; height: number }) => !!frameAspect && v.height > 0 && Math.abs(v.width / v.height - frameAspect) / frameAspect < 0.02;
    const viewportInVideo =
      logEvents && knownSurface && videoSettings?.width && videoSettings.height
        ? estimateViewportInVideo(knownSurface, { width: videoSettings.width, height: videoSettings.height }, window)
        : knownSurface === "browser"
          ? { x: 0, y: 0, width: 1, height: 1 }
          : undefined;
    const startedAt = new Date();
    const t0 = performance.now();
    let paused = false;
    let pausedAt = 0;
    let pausedTotal = 0;
    const elapsed = () => Math.round(((paused ? pausedAt : performance.now()) - t0 - pausedTotal) * 1000);
    // The log runs on the recording's clock, so paused time is cut from both alike.
    const logger = logEvents ? createEventLogger({ now: elapsed, ...(typeof logEvents === "object" ? logEvents : {}) }) : undefined;
    logger?.start();
    const added: CaptureEvent[] = [];
    let finished = false;

    // The user ending the share from the browser's UI ends the screen track: stop cleanly.
    const ended = new Promise<void>((resolve) => screenVideo?.addEventListener("ended", () => resolve(), { once: true }));

    let finishing: Promise<RecordingResult | undefined> | undefined;
    const finish = (keep: boolean): Promise<RecordingResult | undefined> => {
      // Stopping twice (or after the user ended the share) returns the same result.
      finishing ??= doFinish(keep);
      return finishing;
    };
    const doFinish = async (keep: boolean): Promise<RecordingResult | undefined> => {
      finished = true;
      const logged = [...(logger?.stop() ?? []), ...added].sort((a, b) => a.tUs - b.tUs);
      // A tab's video keeps its first size (see openOutput), so the log is kept in the first
      // viewport's coordinates too: events after a resize are moved to where the video shows them.
      // The reference is the viewport the video's frame shows: the one at the start, or (when Chrome's
      // "sharing this tab" bar or similar resized the page as recording began) the first early resize
      // whose shape matches the frame.
      let reference = viewportAtStart;
      if (knownSurface === "browser" && frameAspect && !matchesFrame(viewportAtStart)) {
        const early = logged.find((e): e is Extract<CaptureEvent, { type: "resize" }> => e.type === "resize" && e.tUs < 3_000_000 && matchesFrame(e));
        if (early) reference = { ...viewportAtStart, width: early.width, height: early.height };
      }
      const events = knownSurface === "browser" ? fitResizedEvents(logged, reference) : logged;
      const durationUs = elapsed();
      for (const s of stopAll) for (const track of s.getTracks()) track.stop();
      mix?.close();
      const outputs = [screen, camera].filter((o): o is OpenOutput => o !== undefined);
      if (!keep) {
        await Promise.all(outputs.map((o) => o.output.cancel().catch(() => undefined)));
        return undefined;
      }
      await Promise.all(outputs.map((o) => o.output.finalize()));
      const blob = (o: OpenOutput | undefined) =>
        o?.buffer?.buffer ? new Blob([o.buffer.buffer], { type: o.media.mimeType }) : undefined;
      const session: CaptureSession = {
        format: 1,
        startedAt: startedAt.toISOString(),
        durationUs,
        // A tab or a window or screen: as it was when recording started (the video keeps that frame;
        // a resized tab's events were moved into it). Anything else: as it is now.
        viewport: knownSurface === "browser" ? reference : knownSurface ? viewportAtStart : { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio || 1 },
        ...(viewportInVideo ? { viewportInVideo } : {}),
        ...(knownSurface ? { surface: knownSurface } : {}),
        ...(screenVideo ? { cursorInVideo } : {}),
        media: {
          ...(screen ? { screen: { ...screen.media, durationUs } } : {}),
          ...(micTrack ? { microphone: { mimeType: screen?.media.mimeType ?? "audio/webm", durationUs } } : {}),
          ...(camera ? { camera: { ...camera.media, durationUs } } : {}),
        },
        events,
      };
      const screenBlob = blob(screen);
      const cameraBlob = blob(camera);
      return { ...(screenBlob ? { screen: screenBlob } : {}), ...(cameraBlob ? { camera: cameraBlob } : {}), session };
    };

    const recording: Recording = {
      get elapsedUs() {
        return elapsed();
      },
      get paused() {
        return paused;
      },
      pause() {
        if (paused || finished) return;
        paused = true;
        pausedAt = performance.now();
        logger?.pause();
        for (const o of [screen, camera]) o?.sources.forEach((s) => s.pause());
      },
      resume() {
        if (!paused || finished) return;
        pausedTotal += performance.now() - pausedAt;
        paused = false;
        logger?.resume();
        for (const o of [screen, camera]) o?.sources.forEach((s) => s.resume());
      },
      addEvent(event) {
        if (!finished && !paused) added.push(event);
      },
      clockAt(epochMs) {
        const nowEpoch = performance.timeOrigin + performance.now();
        return Math.max(0, Math.round(elapsed() - (nowEpoch - epochMs) * 1000));
      },
      mark(label, data) {
        if (logger) logger.mark(label, data);
        // Without a logger here (events come from other pages), steps still go in the session.
        else if (!finished && !paused) added.push({ tUs: elapsed(), type: "marker", label, ...(data ? { data } : {}) });
      },
      stop: async () => {
        const result = await finish(true);
        if (!result) throw new Error("this recording was cancelled");
        return result;
      },
      cancel: async () => {
        await finish(false);
      },
    };
    void ended.then(() => {
      if (!finished) {
        void finish(true)
          .then((result) => result && options.onEnded?.(result))
          .catch(() => undefined);
      }
    });
    return recording;
  } catch (error) {
    for (const s of stopAll.length ? stopAll : screenStream ? [screenStream] : []) for (const track of s.getTracks()) track.stop();
    throw error;
  }
}
