import { createProject, usToTimecode } from "@miraiclip/core";
import {
  createPixiBackend,
  createPlayer,
  createWebAudioOutput,
  createWebCodecsDecoderFactory,
  exportProject,
  isWebCodecsSupported,
  openMediabunnyAudio,
  openMediabunnyDemuxer,
  type ExportFormat,
  type Player,
} from "@miraiclip/renderer";

const fileInput = document.getElementById("file") as HTMLInputElement;
const canvas = document.getElementById("stage") as HTMLCanvasElement;
const playButton = document.getElementById("play") as HTMLButtonElement;
const seek = document.getElementById("seek") as HTMLInputElement;
const status = document.getElementById("status") as HTMLSpanElement;
const exportButton = document.getElementById("export") as HTMLButtonElement;
const exportFormat = document.getElementById("export-format") as HTMLSelectElement;
const exportQuality = document.getElementById("export-quality") as HTMLSelectElement;
const exportFps = document.getElementById("export-fps") as HTMLSelectElement;
const markInButton = document.getElementById("mark-in") as HTMLButtonElement;
const markOutButton = document.getElementById("mark-out") as HTMLButtonElement;
const rangeLabel = document.getElementById("range-label") as HTMLSpanElement;
const rangeClear = document.getElementById("range-clear") as HTMLButtonElement;

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

  // 4 — export: the same document rendered offline at full resolution.
  exportButton.disabled = false;
  exportFormat.disabled = false;
  exportQuality.disabled = false;
  exportFps.disabled = false;
  markInButton.disabled = false;
  markOutButton.disabled = false;

  // Export range: editor-style in/out marks set at the playhead.
  let markInUs: number | undefined;
  let markOutUs: number | undefined;
  const updateRangeLabel = (): void => {
    const active = markInUs !== undefined || markOutUs !== undefined;
    rangeLabel.hidden = !active;
    rangeClear.hidden = !active;
    if (!active) return;
    const inUs = markInUs ?? 0;
    const outUs = markOutUs ?? durationUs;
    rangeLabel.textContent = `${usToTimecode(inUs, fps)} → ${usToTimecode(outUs, fps)} (${Math.max(0, Math.round((outUs - inUs) / 1_000_000))}s)`;
    rangeLabel.style.color = outUs > inUs ? "#8fd18f" : "#ff7a7a";
  };
  const onMarkIn = (): void => {
    markInUs = player.timeUs;
    updateRangeLabel();
  };
  const onMarkOut = (): void => {
    markOutUs = player.timeUs;
    updateRangeLabel();
  };
  const onRangeClear = (): void => {
    markInUs = undefined;
    markOutUs = undefined;
    updateRangeLabel();
  };
  markInButton.addEventListener("click", onMarkIn);
  markOutButton.addEventListener("click", onMarkOut);
  rangeClear.addEventListener("click", onRangeClear);
  const onExport = async (): Promise<void> => {
    const format = exportFormat.value as ExportFormat;
    const rangeStartUs = markInUs ?? 0;
    const rangeEndUs = markOutUs ?? durationUs;
    if (!(rangeEndUs > rangeStartUs)) {
      status.textContent = "export range is empty — Out must be after In";
      return;
    }
    exportButton.disabled = true;
    player.pause();
    try {
      const bytes = await exportProject(project, {
        format,
        quality: exportQuality.value as "draft" | "standard" | "high",
        // "source" = the project's fps (exportProject's default); a lower
        // output rate cuts the frame count — and export time — proportionally.
        ...(exportFps.value === "source" ? {} : { fps: Number(exportFps.value) }),
        range: { startUs: rangeStartUs, endUs: rangeEndUs },
        onProgress: ({ phase, framesDone, totalFrames, audioMixedUs, audioTotalUs }) => {
          status.textContent =
            phase === "video"
              ? `exporting… ${framesDone}/${totalFrames} frames`
              : phase === "audio"
                ? `exporting… audio ${Math.round((audioMixedUs ?? 0) / 1_000_000)}s / ${Math.round((audioTotalUs ?? 0) / 1_000_000)}s`
                : `exporting… (${phase})`;
        },
      });
      const blob = new Blob([bytes as BlobPart], {
        type: format === "mp4" ? "video/mp4" : "video/webm",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `miraiclip-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      status.textContent = `exported ${(blob.size / 1_048_576).toFixed(1)} MB ${format}`;
    } catch (error) {
      status.textContent = `export failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error("[playground] export failed:", error);
    } finally {
      exportButton.disabled = false;
    }
  };
  exportButton.addEventListener("click", onExport);

  // Test hook: the e2e suite drives the player programmatically.
  (window as unknown as Record<string, unknown>).__mirai = { player, project, exportProject };

  teardown = () => {
    offPlayhead();
    if (trailing !== undefined) clearTimeout(trailing);
    exportButton.removeEventListener("click", onExport);
    markInButton.removeEventListener("click", onMarkIn);
    markOutButton.removeEventListener("click", onMarkOut);
    rangeClear.removeEventListener("click", onRangeClear);
    onRangeClear();
    exportButton.disabled = true;
    markInButton.disabled = true;
    markOutButton.disabled = true;
    delete (window as unknown as Record<string, unknown>).__mirai;
    playButton.removeEventListener("click", onPlay);
    seek.removeEventListener("input", onSeekInput);
    seek.removeEventListener("change", onSeekDone);
    player.destroy();
    if (isBlobUrl) URL.revokeObjectURL(src);
  };
}
