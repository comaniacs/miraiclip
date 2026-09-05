import { createProject, usToTimecode } from "@miraiclip/core";
import {
  Compositor,
  createPixiBackend,
  createVideoSupport,
  createWebCodecsDecoder,
  isWebCodecsSupported,
  MediaManager,
  openMediabunnyDemuxer,
  RealtimeClock,
} from "@miraiclip/renderer";

const fileInput = document.getElementById("file") as HTMLInputElement;
const canvas = document.getElementById("stage") as HTMLCanvasElement;
const playButton = document.getElementById("play") as HTMLButtonElement;
const seek = document.getElementById("seek") as HTMLInputElement;
const status = document.getElementById("status") as HTMLSpanElement;

if (!isWebCodecsSupported()) {
  (document.getElementById("unsupported") as HTMLElement).hidden = false;
  fileInput.disabled = true;
}

let teardown: (() => void) | undefined;

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) void load(file);
});

// Dev convenience: load a video by URL, e.g. /?src=/test-media.mp4
const paramSrc = new URLSearchParams(location.search).get("src");
if (paramSrc) void load(paramSrc);

async function load(fileOrUrl: File | string): Promise<void> {
  teardown?.();
  status.textContent = "probing…";
  const src = typeof fileOrUrl === "string" ? fileOrUrl : URL.createObjectURL(fileOrUrl);
  const isBlobUrl = typeof fileOrUrl !== "string";

  // Probe the media so the asset registry gets real metadata.
  const probe = await openMediabunnyDemuxer("probe", src);
  const info = await probe.info();
  probe.dispose();
  const durationUs = info.durationUs;

  // 1 — the document, via commands only.
  const project = createProject({ width: 1280, height: 720, fps: info.fps ?? 30 });
  project.transaction(() => {
    project.dispatch({
      type: "asset/add",
      payload: { id: "media", kind: "video", src, durationUs: info.durationUs },
    });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({ type: "track/add", payload: { id: "overlay", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "video",
        id: "main",
        trackId: "v1",
        assetId: "media",
        startUs: 0,
        durationUs,
      },
    });
    project.dispatch({
      type: "clip/add",
      payload: {
        kind: "text",
        id: "title",
        trackId: "overlay",
        startUs: 0,
        durationUs: Math.min(3_000_000, durationUs),
        text: "Made with Miraiclip",
        fontSizePx: 56,
        color: "#ffffff",
        transform: { y: 0.85, opacity: 0.9 },
      },
    });
  });

  // 2 — media pipeline + compositor + clock.
  const manager = new MediaManager({
    openDemuxer: openMediabunnyDemuxer,
    createDecoder: createWebCodecsDecoder,
  });
  const videos = createVideoSupport(project, manager);
  const backend = await createPixiBackend({ canvas, width: 1280, height: 720 });
  const compositor = new Compositor(project, backend, {
    factories: { video: videos.factory },
  });
  const clock = new RealtimeClock();

  // 3 — transport loop.
  let raf = 0;
  let lastPrepareMs = 0;
  let lastUiMs = 0;
  let lastStatus = "";
  const fps = info.fps ?? 30;
  function frame(nowMs: number): void {
    let t = clock.timeUs;
    if (t >= durationUs) {
      clock.seek(0); // loop
      t = 0;
    }
    // The streaming pipeline advances its own decode-ahead from tick(); an
    // occasional prepare() covers the case where the tick hasn't run yet.
    if (nowMs - lastPrepareMs > 1000) {
      lastPrepareMs = nowMs;
      void videos.prepare(t);
    }
    compositor.renderAt(t);
    // DOM writes force style/layout on the same thread as decode callbacks and
    // GPU uploads — throttle them hard (they were 120 layouts/sec otherwise).
    if (nowMs - lastUiMs > 200) {
      lastUiMs = nowMs;
      if (!seeking) {
        const position = String(Math.round((t / durationUs) * 1000));
        if (seek.value !== position) seek.value = position;
      }
      const text = `${usToTimecode(t, fps)} / ${usToTimecode(durationUs, fps)}${clock.playing ? "" : " · paused"}`;
      if (text !== lastStatus) {
        lastStatus = text;
        status.textContent = text;
      }
    }
    raf = requestAnimationFrame(frame);
  }

  playButton.disabled = false;
  seek.disabled = false;
  playButton.textContent = "Play";

  const onPlay = (): void => {
    if (clock.playing) {
      clock.pause();
      playButton.textContent = "Play";
    } else {
      clock.play();
      playButton.textContent = "Pause";
    }
  };
  let seeking = false;
  const onSeekInput = (): void => {
    seeking = true;
    const t = Math.round((Number(seek.value) / 1000) * durationUs);
    clock.seek(t);
    void videos.prepare(t);
  };
  const onSeekDone = (): void => {
    seeking = false;
  };
  playButton.addEventListener("click", onPlay);
  seek.addEventListener("input", onSeekInput);
  seek.addEventListener("change", onSeekDone);

  await videos.renderFrameAt(compositor, 0); // poster frame
  raf = requestAnimationFrame(frame);

  teardown = () => {
    cancelAnimationFrame(raf);
    playButton.removeEventListener("click", onPlay);
    seek.removeEventListener("input", onSeekInput);
    seek.removeEventListener("change", onSeekDone);
    videos.dispose();
    compositor.destroy();
    if (isBlobUrl) URL.revokeObjectURL(src);
  };
}
