import { createProject, usToTimecode } from "@miraiclip/core";
import {
  createPixiBackend,
  createPlayer,
  createWebAudioOutput,
  createWebCodecsDecoderFactory,
  isWebCodecsSupported,
  openMediabunnyAudio,
  openMediabunnyDemuxer,
  type Player,
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
  const fps = info.fps ?? 30;

  // 1 — the document, via commands only.
  const project = createProject({ width: 1280, height: 720, fps });
  project.transaction(() => {
    project.dispatch({
      type: "asset/add",
      payload: { id: "media", kind: "video", src, durationUs },
    });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({ type: "track/add", payload: { id: "overlay", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "video", id: "main", trackId: "v1", assetId: "media", startUs: 0, durationUs },
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

  // 2 — the player: compositor + video pipeline + audio, one facade.
  // preserveDrawingBuffer: the e2e tests read pixels back from the canvas.
  const backend = await createPixiBackend({
    canvas,
    width: 1280,
    height: 720,
    preserveDrawingBuffer: true,
  });
  const player: Player = createPlayer(project, {
    backend,
    openDemuxer: openMediabunnyDemuxer,
    // Proxy preview: decode 4K sources down to preview resolution — full-res
    // 4K60 ImageBitmap copies + texture uploads drop frames on most machines.
    createDecoder: createWebCodecsDecoderFactory({ maxOutputDimensionPx: 1920 }),
    audioOutput: createWebAudioOutput(),
    openAudio: openMediabunnyAudio,
    loop: true,
  });

  // 3 — UI, driven by the core's playhead events (throttled DOM writes).
  playButton.disabled = false;
  seek.disabled = false;
  playButton.textContent = "Play";
  let seeking = false;
  let lastUiMs = 0;
  let latestUs = 0;
  let trailing: number | undefined;
  const applyUi = (): void => {
    lastUiMs = performance.now();
    if (!seeking) {
      const position = String(Math.round((latestUs / durationUs) * 1000));
      if (seek.value !== position) seek.value = position;
    }
    status.textContent = `${usToTimecode(latestUs, fps)} / ${usToTimecode(durationUs, fps)}${player.playing ? "" : " · paused"}`;
    playButton.textContent = player.playing ? "Pause" : "Play";
  };
  const offPlayhead = project.events.on("playhead", ({ positionUs }) => {
    latestUs = positionUs;
    const elapsed = performance.now() - lastUiMs;
    if (elapsed >= 200) {
      applyUi();
      return;
    }
    // Trailing update: the player emits ONE event per discrete change (a
    // paused seek, a pause) — a plain throttle would eat it and leave the UI
    // stale forever.
    trailing ??= window.setTimeout(() => {
      trailing = undefined;
      applyUi();
    }, 200 - elapsed);
  });

  const onPlay = (): void => (player.playing ? player.pause() : player.play());
  const onSeekInput = (): void => {
    seeking = true;
    player.seek(Math.round((Number(seek.value) / 1000) * durationUs));
  };
  const onSeekDone = (): void => {
    seeking = false;
  };
  playButton.addEventListener("click", onPlay);
  seek.addEventListener("input", onSeekInput);
  seek.addEventListener("change", onSeekDone);

  // Test hook: the e2e suite drives the player programmatically.
  (window as unknown as Record<string, unknown>).__mirai = { player, project };

  teardown = () => {
    offPlayhead();
    if (trailing !== undefined) clearTimeout(trailing);
    delete (window as unknown as Record<string, unknown>).__mirai;
    playButton.removeEventListener("click", onPlay);
    seek.removeEventListener("input", onSeekInput);
    seek.removeEventListener("change", onSeekDone);
    player.destroy();
    if (isBlobUrl) URL.revokeObjectURL(src);
  };
}
