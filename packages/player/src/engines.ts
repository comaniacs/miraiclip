/**
 * Playback engines behind the element: a native <video> for rendered files,
 * and the Miraiclip renderer for live documents (loaded on demand, so a
 * video-only page never downloads the renderer).
 */
export interface EngineState {
  playing: boolean;
  timeS: number;
  durationS: number;
}

export interface PlaybackEngine {
  readonly element: HTMLElement;
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  state(): EngineState;
  setMuted(muted: boolean): void;
  /** Called on any time/state change. */
  onChange(listener: () => void): void;
  onEnded(listener: () => void): void;
  onError(listener: (message: string) => void): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

export function createVideoEngine(src: string, options: { loop: boolean; muted: boolean; poster?: string }): PlaybackEngine {
  const video = document.createElement("video");
  video.src = src;
  video.preload = "metadata";
  video.playsInline = true;
  video.loop = options.loop;
  video.muted = options.muted;
  if (options.poster) video.poster = options.poster;
  video.setAttribute("part", "media");
  const change: (() => void)[] = [];
  const ended: (() => void)[] = [];
  const errors: ((m: string) => void)[] = [];
  const emit = () => change.forEach((l) => l());
  for (const type of ["timeupdate", "play", "pause", "durationchange", "loadedmetadata", "seeked"]) video.addEventListener(type, emit);
  video.addEventListener("ended", () => ended.forEach((l) => l()));
  video.addEventListener("error", () => errors.forEach((l) => l(video.error?.message || "the video could not be played")));
  return {
    element: video,
    play: () => void video.play()?.catch?.((e: Error) => errors.forEach((l) => l(e.message))),
    pause: () => video.pause(),
    seek: (s) => {
      video.currentTime = Math.max(0, s);
      emit();
    },
    state: () => ({ playing: !video.paused && !video.ended, timeS: video.currentTime || 0, durationS: Number.isFinite(video.duration) ? video.duration : 0 }),
    setMuted: (m) => {
      video.muted = m;
    },
    onChange: (l) => change.push(l),
    onEnded: (l) => ended.push(l),
    onError: (l) => errors.push(l),
    resize: () => undefined,
    destroy: () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    },
  };
}

/** Rewrite relative asset `src` paths so they resolve against `base` (the document's own URL by default). */
export function resolveAssetSources<T extends { assets: Record<string, { src: string }> }>(doc: T, base: string | undefined): T {
  if (!base) return doc;
  const copy = JSON.parse(JSON.stringify(doc)) as T;
  for (const asset of Object.values(copy.assets)) {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(asset.src)) continue; // absolute, data:, blob:
    try {
      asset.src = new URL(asset.src, base).href;
    } catch {
      // leave as-is
    }
  }
  return copy;
}

interface LiveModules {
  core: typeof import("@miraiclip/core");
  renderer: typeof import("@miraiclip/renderer");
}

let modules: Promise<LiveModules> | undefined;

/** Load core + renderer once (they are optional peers: only documents need them). */
export function loadLiveModules(): Promise<LiveModules> {
  modules ??= Promise.all([import("@miraiclip/core"), import("@miraiclip/renderer")]).then(([core, renderer]) => ({ core, renderer }));
  return modules;
}

export async function createDocumentEngine(
  doc: import("@miraiclip/core").ProjectDocument,
  options: { loop: boolean; muted: boolean; loadPlugins: boolean },
): Promise<PlaybackEngine> {
  const { core, renderer } = await loadLiveModules();
  if (options.loadPlugins && doc.plugins?.length) await renderer.loadDocumentPlugins(doc);
  const project = core.createProject(doc);
  const controller = renderer.createPreviewController(project, { player: { loop: options.loop } });
  if (options.muted) controller.toggleMute();
  const canvas = document.createElement("canvas");
  canvas.setAttribute("part", "media");
  const change: (() => void)[] = [];
  const ended: (() => void)[] = [];
  const errors: ((m: string) => void)[] = [];
  let durationUs = 0;
  for (const clip of Object.values(doc.clips)) durationUs = Math.max(durationUs, clip.startUs + clip.durationUs);
  let wasPlaying = false;
  const emit = () => {
    const playing = controller.getState().playing;
    if (wasPlaying && !playing && project.getState().playheadUs >= durationUs - 1) ended.forEach((l) => l());
    wasPlaying = playing;
    change.forEach((l) => l());
  };
  controller.subscribe(() => {
    const error = controller.getState().lastError;
    if (error) errors.forEach((l) => l(error));
    emit();
  });
  const offPlayhead = project.events.on("playhead", emit);
  let attached = false;
  return {
    element: canvas,
    play: () => controller.play(),
    pause: () => controller.pause(),
    seek: (s) => controller.seek(Math.round(Math.max(0, s) * 1e6)),
    state: () => ({ playing: controller.getState().playing, timeS: project.getState().playheadUs / 1e6, durationS: durationUs / 1e6 }),
    setMuted: (m) => {
      if (controller.getState().muted !== m) controller.toggleMute();
    },
    onChange: (l) => change.push(l),
    onEnded: (l) => ended.push(l),
    onError: (l) => errors.push(l),
    resize: (width, height) => {
      if (width <= 0 || height <= 0) return;
      if (!attached) {
        controller.attach(canvas, { width, height });
        attached = true;
      } else controller.resize(width, height);
    },
    destroy: () => {
      offPlayhead();
      controller.destroy();
    },
  };
}
