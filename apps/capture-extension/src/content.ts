/**
 * The recorder, injected into the tab you start from (or shown on the
 * extension's own record page). Four pieces share one shadow root:
 *
 * - the setup panel: what to record (screen + camera, screen, camera), which
 *   surface (screen, window, this tab), camera and microphone, options;
 * - the camera bubble: a round, draggable, resizable preview of your camera;
 * - the countdown before each take;
 * - the control pill while recording: finish, pause, mark a step, mute,
 *   restart, discard.
 *
 * The share prompt needs a click inside the page (user activation), so a
 * recording starts from the panel's own button. Everything is marked
 * data-private and the event log ignores clicks on it. Finished recordings
 * go to the extension's library and open on the review page.
 */
import {
  isSensitiveElement as defaultSensitive,
  packRecording,
  pageInFrame,
  startRecording,
  RECORDING_FILE_EXTENSION,
  type CaptureEvent,
  type CaptureSession,
  type DisplaySurface,
  type Recording,
  type RecordingResult,
} from "@miraiclip/capture";
import type { SaveReply, SaveRequest } from "./bridge.js";
import { createDrawLayer, DRAW_DEFAULTS, type DrawPrefs } from "./draw.js";
import { sameScreen, screenKey, type Message, type ScreenKey } from "./messages.js";
import type { StoredRecording } from "./store.js";
import { icons } from "./ui/icons.js";
import { STYLES } from "./ui/styles.js";

/** The recorder's host element (logger.ts ignores clicks inside it too). */
const ID = "miraiclip-capture-bar";
const PREFS = "mc-prefs";
/** Bumped when a default changes in a way saved settings should pick up. */
const PREFS_VERSION = 2;
const onExtensionPage = location.protocol === "chrome-extension:";

type Mode = "both" | "screen" | "camera";
type BubbleSize = "s" | "m" | "l";
interface Prefs {
  mode: Mode;
  source: DisplaySurface;
  /** "" = the system default. */
  cameraId: string;
  /** "" = the system default, "none" = no microphone. */
  micId: string;
  countdown: boolean;
  /**
   * Keep the camera bubble on the page while recording (it is then burned into
   * the screen video). Off by default: the camera is always saved as its own
   * file and the editor places it, so the bubble would show twice.
   */
  keepBubble: boolean;
  mirror: boolean;
  bubbleSize: BubbleSize;
  /** The bubble's top-left corner, in CSS px (undefined: bottom-left corner). */
  bubbleX?: number;
  bubbleY?: number;
  draw: DrawPrefs;
}
const DEFAULTS: Prefs = { mode: "both", source: "monitor", cameraId: "", micId: "", countdown: true, keepBubble: false, mirror: true, bubbleSize: "m", draw: DRAW_DEFAULTS };
const SIZES: Record<BubbleSize, number> = { s: 120, m: 196, l: 300 };

declare global {
  interface Window {
    __miraiclipCapture?: { toggle(): void };
  }
}

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

const send = (message: Message) => chrome.runtime.sendMessage(message).catch(() => undefined);
const frames = (n: number) => new Promise<void>((resolve) => {
  const step = (left: number) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
  step(n);
});
const stopStream = (s: MediaStream | undefined) => s?.getTracks().forEach((t) => t.stop());

/**
 * A window or screen recording's session, on the whole frame: the pages' events are already
 * in frame coordinates. When the shared screen isn't the one this window is on (another
 * monitor), clicks can't be placed: only steps are kept.
 */
function onFrame(session: CaptureSession, wide: { surface: "window" | "monitor"; frameWidth: number; frameHeight: number }): CaptureSession {
  const dpr = window.devicePixelRatio || 1;
  const w = session.media.screen?.width;
  const h = session.media.screen?.height;
  const fits = !!w && !!h && Math.abs(w / dpr - wide.frameWidth) / wide.frameWidth < 0.15 && Math.abs(h / dpr - wide.frameHeight) / wide.frameHeight < 0.15;
  return {
    ...session,
    viewport: { width: wide.frameWidth, height: wide.frameHeight, devicePixelRatio: dpr },
    viewportInVideo: { x: 0, y: 0, width: 1, height: 1 },
    surface: wide.surface,
    events: fits ? session.events : session.events.filter((e) => e.type === "marker"),
  };
}

/** Ask the share picker to open on a tab (this one), a window or a whole screen. */
function pickerRequest(kind: DisplaySurface): DisplayMediaStreamOptions {
  return {
    // Chrome records the real pointer in a window or screen capture (never in a tab); the
    // session's cursorInVideo says which, and the editor highlights it or draws one.
    video: { frameRate: 30, displaySurface: kind } as MediaTrackConstraints,
    audio: kind === "browser", // the tab's own sound; a window or screen has none in Chrome on most systems
    ...(kind === "browser" ? { preferCurrentTab: true } : { selfBrowserSurface: "include", monitorTypeSurfaces: "include" }),
  } as DisplayMediaStreamOptions;
}

/** A default name: the page (or site) and the time. */
function defaultTitle(): string {
  const page = onExtensionPage ? "" : (document.title || location.hostname).trim().slice(0, 60);
  const when = new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return page ? `${page} — ${when}` : `Recording — ${when}`;
}

/** Hand a finished recording to the extension's library, through its save page. Resolves with the new id. */
async function saveToLibrary(root: ShadowRoot, request: Omit<SaveRequest, "type" | "token">): Promise<string> {
  const { token } = ((await chrome.runtime.sendMessage({ type: "mc-token" } satisfies Message)) as { token: string } | undefined) ?? {};
  if (!token) throw new Error("no token");
  const frame = document.createElement("iframe");
  frame.className = "frame";
  frame.src = chrome.runtime.getURL("bridge.html");
  const loaded = new Promise<void>((resolve, reject) => {
    frame.onload = () => resolve();
    frame.onerror = () => reject(new Error("save page blocked"));
    setTimeout(() => reject(new Error("save page timed out")), 8000);
  });
  root.append(frame);
  try {
    await loaded;
    const channel = new MessageChannel();
    const reply = new Promise<SaveReply>((resolve, reject) => {
      channel.port1.onmessage = (e: MessageEvent<SaveReply>) => resolve(e.data);
      setTimeout(() => reject(new Error("save timed out")), 60_000);
    });
    const message: SaveRequest = { type: "mc-save", token, ...request };
    frame.contentWindow?.postMessage(message, new URL(chrome.runtime.getURL("")).origin, [channel.port2]);
    const answer = await reply;
    if (!answer.ok) throw new Error(answer.error);
    return answer.id;
  } finally {
    frame.remove();
  }
}

function mount(): { toggle(): void } {
  const host = document.createElement("div");
  host.id = ID;
  host.setAttribute("data-private", "");
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${STYLES}</style>
<div class="root">
  <section class="panel" id="panel" role="dialog" aria-label="Miraiclip recorder">
    <div class="head">
      <span class="brand"><span class="logo"></span>Miraiclip Capture</span>
      <button class="icon-btn" id="close" aria-label="Close">${icons.close}</button>
    </div>
    <div class="seg" id="mode" role="group" aria-label="What to record">
      <button data-v="both">${icons.screenCam}<span>Screen + Cam</span></button>
      <button data-v="screen">${icons.screen}<span>Screen only</span></button>
      <button data-v="camera">${icons.camera}<span>Cam only</span></button>
    </div>
    <div id="sourceField">
      <div class="label">Record</div>
      <div class="tiles" id="source" role="group" aria-label="What to share">
        <button data-v="monitor">${icons.monitor}Screen</button>
        <button data-v="window">${icons.window}Window</button>
        <button data-v="browser">${icons.tab}This tab</button>
      </div>
    </div>
    <div id="camField">
      <div class="label">Camera</div>
      <label class="device" id="camBox">${icons.camera}<select id="camSel" aria-label="Camera"></select></label>
    </div>
    <div>
      <div class="label">Microphone</div>
      <label class="device" id="micBox">${icons.mic}<select id="micSel" aria-label="Microphone"></select><span class="meter"><i id="level"></i></span></label>
    </div>
    <div class="options">
      <div class="toggle" role="switch" tabindex="0" id="optCountdown">3-second countdown<span class="switch"></span></div>
      <div class="toggle" role="switch" tabindex="0" id="optBubble">Also show the camera bubble in the screen video<span class="switch"></span></div>
      <div class="toggle" role="switch" tabindex="0" id="optMirror">Mirror my camera preview<span class="switch"></span></div>
    </div>
    <p class="note" id="note" hidden></p>
    <button class="start" id="start"><span class="dot"></span>Start recording</button>
    <div class="foot">
      <button class="link" id="library">${icons.library}Your recordings</button>
      <span><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd> to finish</span>
    </div>
  </section>

  <div class="bubble" id="bubble" hidden tabindex="0" aria-label="Camera preview — drag to move">
    <video id="cam" autoplay muted playsinline></video>
    <span id="poppedText" hidden>Camera popped out</span>
    <div class="bubble-tools">
      <button data-size="s" aria-label="Small">S</button>
      <button data-size="m" aria-label="Medium">M</button>
      <button data-size="l" aria-label="Large">L</button>
      <button id="popout" aria-label="Float over other apps" title="Float over other apps">${icons.popout}</button>
    </div>
  </div>

  <div class="countdown" id="countdown" hidden>
    <div class="count-wrap"><div class="ring" id="ring"><span>3</span></div><div class="count-hint">Click to start now · Esc to cancel</div></div>
  </div>

  <div class="pill" id="pill" hidden role="toolbar" aria-label="Recording controls">
    <button class="stop" id="stop" data-tip="Finish recording"><i></i></button>
    <span class="time" id="time">0:00</span>
    <button id="pause" data-tip="Pause">${icons.pause}</button>
    <button id="step" data-tip="Mark a step (Alt+Shift+S)">${icons.flag}<span class="badge" id="stepCount"></span></button>
    <button id="draw" data-tip="Draw on the page">${icons.draw}</button>
    <button id="mute" data-tip="Mute microphone">${icons.mic}</button>
    <span class="sep"></span>
    <button id="restart" data-tip="Restart">${icons.restart}</button>
    <button id="discard" data-tip="Delete recording">${icons.trash}</button>
    <div class="confirm" id="confirm" hidden>
      <b id="confirmTitle"></b><p id="confirmText"></p>
      <div class="row"><button id="confirmNo">Keep recording</button><button class="danger" id="confirmYes"></button></div>
    </div>
  </div>

  <div class="toast" id="toast" hidden><span class="spinner"></span><span id="toastText">Saving your recording…</span></div>
</div>`;
  document.documentElement.append(host);

  const $ = <T extends HTMLElement = HTMLButtonElement>(id: string) => root.getElementById(id) as T;
  const panel = $<HTMLElement>("panel");
  const bubble = $<HTMLDivElement>("bubble");
  const camVideo = $<HTMLVideoElement>("cam");
  const camSel = $<HTMLSelectElement>("camSel");
  const micSel = $<HTMLSelectElement>("micSel");
  const level = $<HTMLElement>("level");
  const note = $<HTMLParagraphElement>("note");
  const pill = $<HTMLDivElement>("pill");
  const countdownEl = $<HTMLDivElement>("countdown");
  const ring = $<HTMLDivElement>("ring");
  const toast = $<HTMLDivElement>("toast");

  let prefs: Prefs = { ...DEFAULTS };
  let camera: MediaStream | undefined;
  let mic: MediaStream | undefined;
  let meter: { ctx: AudioContext; raf: number } | undefined;
  let phase: "setup" | "countdown" | "recording" | "saving" = "setup";

  const say = (text: string) => {
    note.textContent = text;
    note.hidden = !text;
  };
  const savePrefs = () => void chrome.storage.local.set({ [PREFS]: { ...prefs, v: PREFS_VERSION } }).catch(() => undefined);

  // ── Setup panel ───────────────────────────────────────────────
  if (onExtensionPage) {
    // The extension's own page can't be recorded as a tab, and closing the panel would leave nothing.
    $("source").querySelector<HTMLElement>('[data-v="browser"]')!.hidden = true;
    $("close").hidden = true;
  }
  const pressed = (group: HTMLElement, value: string) => group.querySelectorAll<HTMLButtonElement>("[data-v]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === value)));
  const checked = (el: HTMLElement, on: boolean) => el.setAttribute("aria-checked", String(on));

  function render() {
    if (onExtensionPage && prefs.source === "browser") prefs.source = "monitor";
    pressed($("mode"), prefs.mode);
    pressed($("source"), prefs.source);
    $("sourceField").hidden = prefs.mode === "camera";
    $("camField").hidden = prefs.mode === "screen";
    $("optBubble").hidden = prefs.mode !== "both";
    checked($("optCountdown"), prefs.countdown);
    checked($("optBubble"), prefs.keepBubble);
    checked($("optMirror"), prefs.mirror);
    bubble.classList.toggle("mirror", prefs.mirror);
    bubble.querySelectorAll<HTMLButtonElement>("[data-size]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.size === prefs.bubbleSize)));
    $("popout").hidden = !("documentPictureInPicture" in window) && !document.pictureInPictureEnabled;
    placeBubble();
  }

  $("mode").onclick = (e) => {
    const v = (e.target as HTMLElement).closest<HTMLElement>("[data-v]")?.dataset.v as Mode | undefined;
    if (!v || v === prefs.mode) return;
    prefs.mode = v;
    savePrefs();
    render();
    void openCamera();
  };
  $("source").onclick = (e) => {
    const v = (e.target as HTMLElement).closest<HTMLElement>("[data-v]")?.dataset.v as DisplaySurface | undefined;
    if (!v) return;
    prefs.source = v;
    savePrefs();
    render();
  };
  const toggle = (id: string, key: "countdown" | "keepBubble" | "mirror") => {
    const flip = () => {
      prefs[key] = !prefs[key];
      savePrefs();
      render();
    };
    $(id).onclick = flip;
    $(id).onkeydown = (e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), flip());
  };
  toggle("optCountdown", "countdown");
  toggle("optBubble", "keepBubble");
  toggle("optMirror", "mirror");
  camSel.onchange = () => {
    prefs.cameraId = camSel.value;
    savePrefs();
    void openCamera();
  };
  micSel.onchange = () => {
    prefs.micId = micSel.value;
    savePrefs();
    void openMic();
  };
  $("library").onclick = () => void send({ type: "mc-open-review" });
  // A page's audio stays suspended until a click in it: wake the level meter on the first one.
  panel.addEventListener("pointerdown", () => void meter?.ctx.resume().catch(() => undefined));

  async function refreshDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
    const fill = (sel: HTMLSelectElement, kind: MediaDeviceKind, chosen: string, extra: [string, string][], fallback: string) => {
      const list = devices.filter((d) => d.kind === kind && d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications");
      sel.replaceChildren(
        ...extra.map(([v, t]) => new Option(t, v)),
        ...(list.length ? list : []).map((d, i) => new Option(d.label || `${fallback} ${i + 1}`, d.deviceId)),
      );
      if (!list.length && !extra.length) sel.append(new Option(`No ${fallback.toLowerCase()} found`, ""));
      sel.value = Array.from(sel.options).some((o) => o.value === chosen) ? chosen : (sel.options[extra.length]?.value ?? sel.options[0]?.value ?? "");
    };
    const camId = camera?.getVideoTracks()[0]?.getSettings().deviceId ?? prefs.cameraId;
    const micId = prefs.micId === "none" ? "none" : (mic?.getAudioTracks()[0]?.getSettings().deviceId ?? prefs.micId);
    fill(camSel, "videoinput", camId, [], "Camera");
    fill(micSel, "audioinput", micId, [["none", "No microphone"]], "Microphone");
  }

  function stopMeter() {
    if (!meter) return;
    cancelAnimationFrame(meter.raf);
    void meter.ctx.close().catch(() => undefined);
    meter = undefined;
    level.style.width = "0";
  }
  function startMeter(stream: MediaStream) {
    stopMeter();
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += ((v - 128) / 128) ** 2;
      const rms = Math.sqrt(sum / data.length);
      level.style.width = `${Math.min(100, Math.round(rms * 400))}%`;
      if (meter) meter.raf = requestAnimationFrame(tick);
    };
    meter = { ctx, raf: requestAnimationFrame(tick) };
  }

  async function openMic() {
    stopMeter();
    stopStream(mic);
    mic = undefined;
    $("micBox").classList.toggle("off", prefs.micId === "none");
    if (prefs.micId === "none") return refreshDevices();
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: prefs.micId ? { deviceId: { exact: prefs.micId } } : true });
      startMeter(mic);
    } catch (err) {
      // The chosen device is gone: fall back to the default once.
      if (prefs.micId && (err as DOMException).name === "OverconstrainedError") {
        prefs.micId = "";
        return openMic();
      }
      $("micBox").classList.add("off");
      say((err as DOMException).name === "NotAllowedError" ? "Microphone blocked for this site — you'll record without voice." : "No microphone available — you'll record without voice.");
    }
    await refreshDevices();
  }

  async function openCamera() {
    if (prefs.mode === "screen") {
      stopStream(camera);
      camera = undefined;
      camVideo.srcObject = null;
      bubble.hidden = true;
      return;
    }
    const current = camera?.getVideoTracks()[0];
    // Already showing the chosen camera (or the default, when none was chosen).
    if (current?.readyState === "live" && (!prefs.cameraId || current.getSettings().deviceId === prefs.cameraId)) {
      bubble.hidden = false;
      return;
    }
    stopStream(camera);
    camera = undefined;
    try {
      camera = await navigator.mediaDevices.getUserMedia({
        video: { ...(prefs.cameraId ? { deviceId: { exact: prefs.cameraId } } : {}), width: { ideal: 1280 }, height: { ideal: 720 } },
      });
    } catch (err) {
      const name = (err as DOMException).name;
      if (prefs.cameraId && name === "OverconstrainedError") {
        prefs.cameraId = "";
        return openCamera();
      }
      $("camBox").classList.add("off");
      bubble.hidden = true;
      say(name === "NotFoundError" ? "No camera found." : name === "NotAllowedError" ? "Camera blocked for this site — allow it in the address bar, or record your screen only." : "Camera unavailable.");
      return refreshDevices();
    }
    $("camBox").classList.remove("off");
    say("");
    camVideo.srcObject = camera;
    bubble.hidden = false;
    placeBubble();
    await refreshDevices();
  }

  // ── Camera bubble: drag to move, S/M/L to resize ──────────────
  function placeBubble() {
    const size = SIZES[prefs.bubbleSize];
    bubble.style.width = bubble.style.height = `${size}px`;
    const margin = 20;
    // Default: bottom-left, leaving room for the control pill.
    const x = prefs.bubbleX ?? 80;
    const y = prefs.bubbleY ?? window.innerHeight - size - 28;
    bubble.style.left = `${Math.max(margin / 2, Math.min(window.innerWidth - size - margin / 2, x))}px`;
    bubble.style.top = `${Math.max(margin / 2, Math.min(window.innerHeight - size - margin / 2, y))}px`;
  }
  window.addEventListener("resize", placeBubble);
  bubble.addEventListener("pointerdown", (e) => {
    if ((e.target as HTMLElement).closest("button") || bubble.classList.contains("popped")) return;
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY, left: bubble.offsetLeft, top: bubble.offsetTop };
    bubble.setPointerCapture(e.pointerId);
    bubble.classList.add("dragging");
    const move = (m: PointerEvent) => {
      prefs.bubbleX = start.left + m.clientX - start.x;
      prefs.bubbleY = start.top + m.clientY - start.y;
      placeBubble();
    };
    const up = () => {
      bubble.classList.remove("dragging");
      bubble.removeEventListener("pointermove", move);
      prefs.bubbleX = bubble.offsetLeft;
      prefs.bubbleY = bubble.offsetTop;
      savePrefs();
    };
    bubble.addEventListener("pointermove", move);
    bubble.addEventListener("pointerup", up, { once: true });
    bubble.addEventListener("pointercancel", up, { once: true });
  });
  bubble.querySelectorAll<HTMLButtonElement>("[data-size]").forEach((b) => {
    b.onclick = () => {
      // Grow from the bubble's centre, so it doesn't jump away.
      const before = SIZES[prefs.bubbleSize];
      prefs.bubbleSize = b.dataset.size as BubbleSize;
      const delta = (SIZES[prefs.bubbleSize] - before) / 2;
      prefs.bubbleX = bubble.offsetLeft - delta;
      prefs.bubbleY = bubble.offsetTop - delta;
      savePrefs();
      render();
    };
  });

  // Float the camera over every app (for window and screen recordings), and bring it back.
  let pipWindow: Window | undefined;
  const unpop = () => {
    if (camVideo.parentElement !== bubble) bubble.prepend(camVideo);
    void camVideo.play().catch(() => undefined);
    bubble.classList.remove("popped");
    $("poppedText").hidden = true;
    pipWindow = undefined;
  };
  $("popout").onclick = async () => {
    try {
      const dpip = (window as unknown as { documentPictureInPicture?: { requestWindow(o: { width: number; height: number }): Promise<Window> } }).documentPictureInPicture;
      if (dpip) {
        const size = SIZES[prefs.bubbleSize];
        pipWindow = await dpip.requestWindow({ width: size, height: size });
        const style = pipWindow.document.createElement("style");
        style.textContent = `html,body{margin:0;height:100%;background:#000;overflow:hidden}video{width:100%;height:100%;object-fit:cover;${prefs.mirror ? "transform:scaleX(-1)" : ""}}`;
        pipWindow.document.head.append(style);
        pipWindow.document.body.append(camVideo);
        void camVideo.play().catch(() => undefined);
        pipWindow.addEventListener("pagehide", unpop, { once: true });
      } else {
        await camVideo.requestPictureInPicture();
        camVideo.addEventListener("leavepictureinpicture", unpop, { once: true });
      }
      bubble.classList.add("popped");
      $("poppedText").hidden = false;
    } catch {
      say("Couldn't float the camera here.");
    }
  };
  bubble.addEventListener("click", () => {
    if (!bubble.classList.contains("popped")) return;
    if (pipWindow) pipWindow.close();
    else if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => undefined);
  });

  // ── Recording ─────────────────────────────────────────────────
  let shared: MediaStream | undefined;
  let surface: DisplaySurface | "camera" = "browser";
  // A window or screen recording: what was shared, the frame (CSS px) and this page's screen.
  let wide: { surface: "window" | "monitor"; frameWidth: number; frameHeight: number; screen: ScreenKey } | undefined;
  let recording: Recording | undefined;
  let take: MediaStream[] = []; // this take's clones (a restart stops them, keeping the originals live)
  let micTrack: MediaStreamTrack | undefined;
  let muted = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let steps = 0;
  let bubbleInVideo = false;

  // Drawing on the page (the layer and its palette sit between the bubble and the controls).
  let draw: ReturnType<typeof createDrawLayer> | undefined;
  const closeDraw = () => {
    draw?.hide();
    $("draw").setAttribute("aria-pressed", "false");
  };
  const toggleDraw = () => {
    if (phase !== "recording") return;
    draw ??= createDrawLayer(
      root.querySelector<HTMLElement>(".root")!,
      prefs.draw,
      (p) => {
        prefs.draw = p;
        savePrefs();
      },
      closeDraw,
    );
    if (draw.open) return closeDraw();
    draw.show($("draw").getBoundingClientRect());
    $("draw").setAttribute("aria-pressed", "true");
  };
  $("draw").onclick = toggleDraw;

  const markStep = () => {
    if (!recording || recording.paused) return;
    recording.mark(`Step ${++steps}`, { kind: "step" });
    $("stepCount").textContent = String(steps);
    const flash = document.createElement("div");
    flash.className = "flash";
    flash.textContent = `Step ${steps} marked`;
    // Beside the top of the pill (the step button's tooltip is lower down).
    const box = pill.getBoundingClientRect();
    flash.style.left = `${box.right + 10}px`;
    flash.style.top = `${box.top + 10}px`;
    root.querySelector(".root")!.append(flash);
    setTimeout(() => flash.remove(), 1300);
  };

  function setPaused(paused: boolean) {
    if (!recording) return;
    if (paused) recording.pause();
    else recording.resume();
    pill.classList.toggle("paused", paused);
    $("pause").innerHTML = paused ? icons.play : icons.pause;
    $("pause").dataset.tip = paused ? "Resume" : "Pause";
    void send({ type: "mc-pause", paused });
  }

  // Events from every page (relayed by the background worker), steps and controls from the shortcuts.
  const onMessage = (message: Message) => {
    if (message.type === "mc-command" && message.command === "stop-recording" && phase === "countdown") return cancelCountdown?.();
    if (!recording) return;
    if (message.type === "mc-step") markStep();
    else if (message.type === "mc-command") {
      if (message.command === "toggle-pause") setPaused(!recording.paused);
      else if (message.command === "toggle-draw") toggleDraw();
      else void finish();
    } else if (message.type === "mc-switch") recording.addEvent({ tUs: recording.clockAt(message.epochMs), type: "navigate", url: "about:tab-switch" });
    else if (message.type === "mc-event" && wide && sameScreen(message.screen, wide.screen)) {
      recording.addEvent({ ...message.event, tUs: recording.clockAt(message.epochMs) } as CaptureEvent);
    }
  };
  chrome.runtime.onMessage.addListener(onMessage);

  let cancelCountdown: (() => void) | undefined;
  /** 3, 2, 1 — resolves true to record, false when cancelled. */
  function countdown(): Promise<boolean> {
    phase = "countdown";
    countdownEl.hidden = false;
    return new Promise((resolve) => {
      let n = 3;
      const show = () => (ring.innerHTML = `<span>${n}</span>`);
      show();
      const iv = setInterval(() => (--n > 0 ? show() : done(true)), 1000);
      const key = (e: KeyboardEvent) => e.key === "Escape" && done(false);
      const done = (go: boolean) => {
        clearInterval(iv);
        window.removeEventListener("keydown", key, true);
        countdownEl.onclick = null;
        countdownEl.hidden = true;
        cancelCountdown = undefined;
        resolve(go);
      };
      cancelCountdown = () => done(false);
      countdownEl.onclick = () => done(true);
      window.addEventListener("keydown", key, true);
    });
  }

  /** Back to the panel (a cancelled share or countdown, a discarded recording). */
  function backToSetup(message = "") {
    phase = "setup";
    closeDraw();
    stopStream(shared);
    shared = undefined;
    wide = undefined;
    pill.hidden = true;
    countdownEl.hidden = true;
    panel.hidden = false;
    if (camera && prefs.mode !== "screen") bubble.hidden = false;
    say(message);
  }

  $("start").onclick = async () => {
    say("");
    if (prefs.mode === "camera" && !camera) return say("Turn on a camera to record it, or pick Screen only.");
    if (prefs.mode !== "camera") {
      // The picker opens on the chosen kind; the person can still switch, so what was
      // actually shared decides how clicks are logged.
      try {
        shared = await navigator.mediaDevices.getDisplayMedia(pickerRequest(prefs.source));
      } catch {
        return; // share prompt cancelled: stay on the panel
      }
      surface = ((shared.getVideoTracks()[0]?.getSettings() as { displaySurface?: string }).displaySurface ?? "browser") as DisplaySurface;
      if (surface === "window" || surface === "monitor") {
        const frame = pageInFrame(surface, window);
        wide = { surface, frameWidth: frame.frameWidth, frameHeight: frame.frameHeight, screen: screenKey() };
      }
      // Ending the share during the countdown goes back to the panel.
      shared.getVideoTracks()[0]?.addEventListener("ended", () => phase === "countdown" && cancelCountdown?.(), { once: true });
    } else {
      surface = "camera";
    }
    panel.hidden = true;
    await beginTake();
  };

  async function beginTake() {
    steps = 0;
    $("stepCount").textContent = "";
    if (prefs.countdown && !(await countdown())) return backToSetup();
    if (prefs.mode !== "camera" && shared?.getVideoTracks()[0]?.readyState !== "live") return backToSetup();
    bubbleInVideo = prefs.mode === "both" && prefs.keepBubble && !bubble.classList.contains("popped");
    // The bubble left on the page is part of a tab recording; hidden, the editor places the camera file instead.
    if (prefs.mode === "both" && !prefs.keepBubble) bubble.hidden = true;
    // Let the countdown leave the screen before the first frame.
    await frames(2);
    // Each take records clones, so a restart can throw one away and keep the share and devices open.
    const screen = prefs.mode === "camera" ? camera!.clone() : shared!.clone();
    const micClone = mic?.clone();
    const camClone = prefs.mode === "both" ? camera?.clone() : undefined;
    take = [screen, ...(micClone ? [micClone] : []), ...(camClone ? [camClone] : [])];
    micTrack = micClone?.getAudioTracks()[0];
    $("mute").hidden = !micTrack;
    // Camera only: the page isn't in the video, so there's nothing to draw on.
    $("draw").hidden = prefs.mode === "camera";
    if (micTrack) micTrack.enabled = !muted;
    try {
      recording = await startRecording({
        // Camera only: the camera is the "screen", so the editor imports it like any recording.
        screen,
        ...(micClone ? { microphone: micClone } : {}),
        ...(camClone ? { camera: camClone } : {}),
        // A tab logs here, exactly; a window or screen is logged by every Chrome page and relayed.
        // The recorder's own clicks aren't part of the walkthrough.
        events: wide || prefs.mode === "camera" ? false : { ignore: (el) => el.closest(`#${ID}`) !== null, isSensitive: defaultSensitive },
        onEnded: () => void finish(),
      });
    } catch (err) {
      take.forEach(stopStream);
      return backToSetup((err as Error).message);
    }
    phase = "recording";
    void send({ type: "mc-start", surface: surface === "camera" ? "browser" : surface, screen: screenKey() });
    pill.classList.remove("paused");
    $("pause").innerHTML = icons.pause;
    pill.hidden = false;
    const tick = () => {
      const s = Math.floor((recording?.elapsedUs ?? 0) / 1e6);
      $("time").textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    };
    tick();
    clearInterval(timer);
    timer = setInterval(tick, 250);
  }

  $("stop").onclick = () => void finish();
  $("pause").onclick = () => recording && setPaused(!recording.paused);
  $("step").onclick = markStep;
  $("mute").onclick = () => {
    muted = !muted;
    if (micTrack) micTrack.enabled = !muted;
    $("mute").innerHTML = muted ? icons.micOff : icons.mic;
    $("mute").setAttribute("aria-pressed", String(muted));
    $("mute").dataset.tip = muted ? "Unmute microphone" : "Mute microphone";
  };

  // Restart and delete ask first; the recording pauses while you decide.
  function ask(title: string, text: string, yes: string, action: () => Promise<void>) {
    if (!recording) return;
    const wasPaused = recording.paused;
    if (!wasPaused) setPaused(true);
    $("confirmTitle").textContent = title;
    $("confirmText").textContent = text;
    $("confirmYes").textContent = yes;
    $("confirm").hidden = false;
    $("confirmNo").onclick = () => {
      $("confirm").hidden = true;
      if (!wasPaused) setPaused(false);
    };
    $("confirmYes").onclick = () => {
      $("confirm").hidden = true;
      void action();
    };
  }
  async function dropTake() {
    const r = recording;
    recording = undefined;
    clearInterval(timer);
    void send({ type: "mc-stop" });
    closeDraw();
    await r?.cancel();
    take.forEach(stopStream);
    take = [];
    pill.hidden = true;
  }
  $("restart").onclick = () =>
    ask("Restart recording?", "What you've recorded so far will be deleted, and a new take starts after the countdown.", "Restart", async () => {
      await dropTake();
      await beginTake();
    });
  $("discard").onclick = () =>
    ask("Delete this recording?", "It will be thrown away — nothing is saved.", "Delete", async () => {
      await dropTake();
      backToSetup();
    });

  async function finish() {
    if (!recording || phase === "saving") return;
    const r = recording;
    recording = undefined;
    phase = "saving";
    closeDraw();
    clearInterval(timer);
    void send({ type: "mc-stop" });
    pill.hidden = true;
    $("confirm").hidden = true;
    toast.hidden = false;
    let result: RecordingResult;
    try {
      result = await r.stop();
    } catch (err) {
      teardown();
      return;
    }
    const session = wide ? onFrame(result.session, wide) : result.session;
    const files = { screen: result.screen, camera: result.camera };
    const title = defaultTitle();
    // Free the camera, microphone and share now; the files are done.
    stopStream(shared);
    stopStream(camera);
    stopStream(mic);
    camera = mic = shared = undefined;
    if (!files.screen) return teardown();
    try {
      const id = await saveToLibrary(root, {
        title,
        surface: surface as StoredRecording["surface"],
        bubbleInVideo,
        screen: files.screen,
        ...(files.camera ? { camera: files.camera } : {}),
        session,
      });
      if (onExtensionPage) location.replace(chrome.runtime.getURL(`review.html#${id}`));
      else void send({ type: "mc-open-review", id });
    } catch {
      // The library isn't reachable from this page: download instead, so nothing is lost.
      $("toastText").textContent = "Downloading your recording…";
      await downloadFiles(files.screen, files.camera, session);
    }
    teardown();
  }

  async function downloadFiles(screen: Blob, camera: Blob | undefined, session: CaptureSession) {
    const stamp = session.startedAt.replace(/[:.]/g, "-");
    try {
      download(await packRecording({ screen, ...(camera ? { camera } : {}), session }), `recording-${stamp}${RECORDING_FILE_EXTENSION}`);
    } catch {
      // Too big to pack (over 4 GB): save the files separately. The editor imports them together too.
      download(screen, `recording-${stamp}.webm`);
      // "camera" in the name tells the editor's import which video is the camera.
      if (camera) download(camera, `recording-${stamp}.camera.webm`);
      download(new Blob([JSON.stringify(session, null, 2)], { type: "application/json" }), `recording-${stamp}.session.json`);
    }
  }

  /** Remove everything and release every device. */
  function teardown() {
    if (recording) {
      void send({ type: "mc-stop" });
      void recording.cancel();
      recording = undefined;
    }
    cancelCountdown?.();
    draw?.destroy();
    take.forEach(stopStream);
    stopStream(shared);
    stopStream(camera);
    stopStream(mic);
    camera = mic = shared = undefined;
    stopMeter();
    clearInterval(timer);
    if (pipWindow) pipWindow.close();
    else if (document.pictureInPictureElement) void document.exitPictureInPicture().catch(() => undefined);
    chrome.runtime.onMessage.removeListener(onMessage);
    window.removeEventListener("resize", placeBubble);
    host.remove();
    delete window.__miraiclipCapture;
  }
  $("close").onclick = teardown;

  // Start: load the saved choices, then open the camera and microphone (that's when the browser asks).
  void (async () => {
    const got = (await chrome.storage.local.get(PREFS).catch(() => ({}))) as Record<string, unknown>;
    const stored = (got[PREFS] ?? {}) as Partial<Prefs> & { v?: number };
    // Settings saved before v2 had the bubble in the video by default: drop that choice so the new default applies.
    if ((stored.v ?? 1) < PREFS_VERSION) delete stored.keepBubble;
    delete stored.v;
    prefs = { ...DEFAULTS, ...stored };
    render();
    await openMic();
    await openCamera();
  })();
  render();

  return {
    // The toolbar button again: hide or show the panel while setting up; never interrupt a recording.
    toggle() {
      if (phase === "setup") panel.hidden = !panel.hidden;
    },
  };
}

if (window.__miraiclipCapture) window.__miraiclipCapture.toggle();
else window.__miraiclipCapture = mount();
