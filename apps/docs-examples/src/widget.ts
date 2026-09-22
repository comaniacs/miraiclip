/**
 * Docs live-example widget — showcase edition.
 *
 * Two markup shapes, both produced by the docs shortcodes:
 *
 * A carousel GROUP (one preview canvas, many variants):
 *   <div class="mirai-example-group" data-media="demo" data-assets="<base>">
 *     <div class="mirai-variant" data-name="Cross dissolve" [data-media="green"]>
 *       …fenced code block…
 *     </div>
 *     …more variants…
 *     <div class="mirai-example-stage"></div>
 *   </div>
 *
 * A legacy SINGLE example:
 *   <div class="mirai-example" data-media="demo" data-assets="<base>">
 *     …fenced code block…
 *     <div class="mirai-example-stage"></div>
 *   </div>
 *
 * The executed code is the rendered code block's textContent, so what
 * visitors read is exactly what runs. Every Run builds a fresh scaffold
 * project (asset "media", tracks "v1" + "overlay", clip "main" spanning the
 * demo clip — the playground's ids), evaluates the snippet, and plays it.
 */
import {
  createProject,
  registerEffectKind,
  registerTransitionKind,
  type Project,
} from "@miraiclip/core";
import {
  createPixiBackend,
  createPlayer,
  createWebAudioOutput,
  createWebCodecsDecoderFactory,
  exportProject,
  getEffectRenderer,
  getTransitionRenderer,
  isWebCodecsSupported,
  openMediabunnyAudio,
  openMediabunnyDemuxer,
  registerEffectRenderer,
  registerTransitionRenderer,
  type Player,
} from "@miraiclip/renderer";
import { registerClipKind } from "@miraiclip/core";
import type { NodeFactory } from "@miraiclip/renderer";
import { ColorMatrixFilter } from "pixi.js";
import { z } from "zod";

/**
 * Custom clip kinds registered by snippets. Core registration happens once
 * per page load (the registry rejects duplicates); the factory map is passed
 * to every fresh player, and a re-run's factory replaces the previous one.
 */
const customClipFactories: Record<string, NodeFactory> = {};
const registeredClipKinds = new Set<string>();
function registerClipKindForExamples(
  kind: string,
  registration: Parameters<typeof registerClipKind>[1],
  factory: NodeFactory,
): void {
  if (!registeredClipKinds.has(kind)) {
    registerClipKind(kind, registration);
    registeredClipKinds.add(kind);
  }
  customClipFactories[kind] = factory;
}

const WIDTH = 640;
const HEIGHT = 360;

/** Prefer the VP9 WebM (small); fall back to H.264 MP4 (Safari). */
let mediaExtension: Promise<string> | undefined;
function pickExtension(): Promise<string> {
  mediaExtension ??= (async () => {
    try {
      const support = await VideoDecoder.isConfigSupported({
        codec: "vp09.00.10.08",
        codedWidth: WIDTH,
        codedHeight: HEIGHT,
      });
      return support.supported ? "webm" : "mp4";
    } catch {
      return "mp4";
    }
  })();
  return mediaExtension;
}

async function buildScaffold(url: string): Promise<Project> {
  const probe = await openMediabunnyDemuxer("probe", url);
  const info = await probe.info();
  probe.dispose();
  const durationUs = info.durationUs;
  const project = createProject({ width: WIDTH, height: HEIGHT, fps: info.fps ?? 30 });
  project.transaction(() => {
    project.dispatch({ type: "asset/add", payload: { id: "media", kind: "video", src: url, durationUs } });
    project.dispatch({ type: "track/add", payload: { id: "v1", kind: "video" } });
    project.dispatch({ type: "track/add", payload: { id: "overlay", kind: "video" } });
    project.dispatch({
      type: "clip/add",
      payload: { kind: "video", id: "main", trackId: "v1", assetId: "media", startUs: 0, durationUs },
    });
  });
  return project;
}

/** One example plays at a time — many looping players fight for decoder slots. */
const pauseOthers: (() => void)[] = [];

interface RunnerHost {
  /** Where the frame + controls render. */
  stage: HTMLElement;
  assetsBase: string;
  media(): string;
  code(): string;
  /** Called when a run finishes (success or failure). */
  onRan?(ok: boolean): void;
}

interface Runner {
  run(): Promise<void>;
  hasRun(): boolean;
}

function createRunner(host: RunnerHost): Runner {
  const frame = document.createElement("div");
  frame.className = "mirai-example-frame";
  const cover = document.createElement("div");
  cover.className = "mirai-example-cover";
  const coverButton = document.createElement("button");
  coverButton.className = "mirai-example-run";
  coverButton.textContent = "▶ Run this example";
  cover.append(coverButton);
  frame.append(cover);

  const controls = document.createElement("div");
  controls.className = "mirai-example-controls";
  const runButton = document.createElement("button");
  runButton.className = "mirai-example-run";
  runButton.textContent = "▶ Run this example";
  const playButton = document.createElement("button");
  playButton.textContent = "Pause";
  playButton.hidden = true;
  const status = document.createElement("span");
  status.className = "mirai-example-status";
  controls.append(runButton, playButton, status);
  host.stage.append(frame, controls);

  let player: Player | undefined;
  let running = false;
  let ran = false;

  const pauseSelf = (): void => {
    if (player?.playing) {
      player.pause();
      playButton.textContent = "Play";
    }
  };
  pauseOthers.push(pauseSelf);
  const pauseIndex = pauseOthers.length - 1;

  const setStatus = (text: string, error = false): void => {
    status.textContent = text;
    status.classList.toggle("error", error);
  };

  const run = async (): Promise<void> => {
    if (running) return;
    if (!isWebCodecsSupported()) {
      setStatus("This browser has no WebCodecs — use Chrome/Edge 94+, Safari 16.4+, or Firefox 130+.", true);
      return;
    }
    running = true;
    ran = true;
    pauseOthers.forEach((pause, i) => i !== pauseIndex && pause());
    runButton.textContent = "⟲ Run again";
    setStatus("loading…");
    let ok = false;
    try {
      player?.destroy();
      player = undefined;
      frame.querySelector("canvas")?.remove();
      cover.hidden = true;

      const url = `${host.assetsBase}${host.media()}.${await pickExtension()}`;
      const project = await buildScaffold(url);

      // The player is created AFTER the snippet, so custom clip kinds a
      // snippet registers reach the compositor's factories. Snippet-time
      // player calls queue and replay once it exists.
      const pendingPlayerCalls: ((live: Player) => void)[] = [];
      const playerFacade = {
        get playing() {
          return player?.playing ?? false;
        },
        play: () => (player ? player.play() : pendingPlayerCalls.push((live) => live.play())),
        pause: () => (player ? player.pause() : pendingPlayerCalls.push((live) => live.pause())),
        seek: (timeUs: number) =>
          player ? player.seek(timeUs) : pendingPlayerCalls.push((live) => live.seek(timeUs)),
      };

      // The snippet on the page IS the program: run it against the scaffold.
      const miraiclip = {
        exportProject,
        // Extensibility — the real registration APIs (registries are
        // module-global and reject duplicates, so snippets guard with get*).
        z,
        pixi: { ColorMatrixFilter },
        registerEffectKind,
        registerEffectRenderer,
        getEffectRenderer,
        registerTransitionKind,
        registerTransitionRenderer,
        getTransitionRenderer,
        // Custom clip kinds: registers the kind in core (once per page load)
        // and hands the factory to the player created after this snippet.
        registerClipKind: registerClipKindForExamples,
        status: (text: string) => setStatus(text),
        download: (bytes: Uint8Array, name: string) => {
          const type = name.endsWith(".mp4") ? "video/mp4" : "video/webm";
          const href = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
          const a = document.createElement("a");
          a.href = href;
          a.download = name;
          a.click();
          URL.revokeObjectURL(href);
        },
      };
      const snippet = new Function(
        "project",
        "player",
        "miraiclip",
        `return (async () => {\n${host.code()}\n})();`,
      );
      await snippet(project, playerFacade, miraiclip);

      const canvas = document.createElement("canvas");
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      frame.append(canvas);
      // preserveDrawingBuffer: pixel readback for screenshots and the smoke test.
      const backend = await createPixiBackend({ canvas, width: WIDTH, height: HEIGHT, preserveDrawingBuffer: true });
      const created = createPlayer(project, {
        backend,
        openDemuxer: openMediabunnyDemuxer,
        createDecoder: createWebCodecsDecoderFactory({ maxOutputDimensionPx: 1280 }),
        audioOutput: createWebAudioOutput(),
        openAudio: openMediabunnyAudio,
        loop: true,
        factories: { ...customClipFactories },
      });
      player = created;

      created.play();
      for (const call of pendingPlayerCalls) call(created); // snippet's intent wins
      playButton.hidden = false;
      playButton.textContent = created.playing ? "Pause" : "Play";
      if (status.textContent === "loading…") setStatus("");
      ok = true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), true);
      console.error("[miraiclip example]", error);
    } finally {
      running = false;
      host.onRan?.(ok);
    }
  };

  runButton.addEventListener("click", () => void run());
  coverButton.addEventListener("click", () => void run());
  playButton.addEventListener("click", () => {
    if (!player) return;
    if (player.playing) {
      pauseSelf();
    } else {
      pauseOthers.forEach((pause, i) => i !== pauseIndex && pause());
      player.play();
      playButton.textContent = "Pause";
    }
  });

  return { run, hasRun: () => ran };
}

function codeOf(container: Element): string {
  return container.querySelector("pre code, .highlight")?.textContent ?? "";
}

/** Legacy single example: one code block, one canvas. */
function initSingle(block: HTMLElement): void {
  const stage = block.querySelector<HTMLElement>(".mirai-example-stage");
  const code = codeOf(block);
  if (!stage || code.trim() === "") return;
  createRunner({
    stage,
    assetsBase: block.dataset["assets"] ?? "",
    media: () => block.dataset["media"] ?? "demo",
    code: () => code,
  });
}

/** Carousel group: variant tabs + arrows, one shared preview. */
function initGroup(group: HTMLElement): void {
  const stage = group.querySelector<HTMLElement>(".mirai-example-stage");
  const variants = [...group.querySelectorAll<HTMLElement>(".mirai-variant")];
  if (!stage || variants.length === 0) return;
  const assetsBase = group.dataset["assets"] ?? "";
  const groupMedia = group.dataset["media"] ?? "demo";
  let active = 0;

  // Tab bar + arrows above the code column.
  const nav = document.createElement("div");
  nav.className = "mirai-variant-nav";
  const prev = document.createElement("button");
  prev.className = "mirai-variant-arrow";
  prev.textContent = "‹";
  prev.setAttribute("aria-label", "Previous example");
  const tabs = document.createElement("div");
  tabs.className = "mirai-variant-tabs";
  const next = document.createElement("button");
  next.className = "mirai-variant-arrow";
  next.textContent = "›";
  next.setAttribute("aria-label", "Next example");
  const tabButtons = variants.map((variant, i) => {
    const tab = document.createElement("button");
    tab.textContent = variant.dataset["name"] ?? `Example ${i + 1}`;
    tab.addEventListener("click", () => select(i));
    tabs.append(tab);
    return tab;
  });
  nav.append(prev, tabs, next);

  // Column wrappers: code (nav + variants) | preview (stage).
  const codeColumn = document.createElement("div");
  codeColumn.className = "mirai-group-code";
  codeColumn.append(nav, ...variants);
  const layout = document.createElement("div");
  layout.className = "mirai-group-layout";
  group.insertBefore(layout, stage);
  layout.append(codeColumn, stage);

  const runner = createRunner({
    stage,
    assetsBase,
    media: () => variants[active]!.dataset["media"] ?? groupMedia,
    code: () => codeOf(variants[active]!),
  });

  function select(index: number): void {
    active = (index + variants.length) % variants.length;
    variants.forEach((variant, i) => variant.classList.toggle("active", i === active));
    tabButtons.forEach((tab, i) => tab.classList.toggle("active", i === active));
    // Once the visitor has run the group, switching slides runs live.
    if (runner.hasRun()) void runner.run();
  }
  prev.addEventListener("click", () => select(active - 1));
  next.addEventListener("click", () => select(active + 1));
  select(0);
}

function boot(): void {
  for (const group of document.querySelectorAll<HTMLElement>(".mirai-example-group")) initGroup(group);
  for (const block of document.querySelectorAll<HTMLElement>(".mirai-example")) initSingle(block);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
