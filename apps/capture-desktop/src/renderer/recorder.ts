/**
 * The recorder panel: pick a screen, camera and microphone, record, save a
 * .mcrec. The recording runs here (this window hides meanwhile); the click
 * log comes from the main process, already in the screen's coordinates, and
 * is put on the recording's clock as it arrives.
 */
import { packRecording, startRecording, type CaptureSession, type Recording } from "@miraiclip/capture";
import type { McApi, Permissions, RecorderCommand, ScreenSource } from "../shared/ipc.js";
import { icons } from "./icons.js";

declare global {
  interface Window {
    mc: McApi;
  }
}
const mc = window.mc;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const PREFS = "mc-desktop-prefs";
interface Prefs {
  sourceId: string;
  cameraId: string; // "" default, "none" off
  micId: string; // "" default, "none" off
  countdown: boolean;
  systemAudio: boolean;
}
const DEFAULTS: Prefs = { sourceId: "", cameraId: "", micId: "", countdown: true, systemAudio: false };
let prefs: Prefs = (() => {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(PREFS) ?? "{}") as Partial<Prefs>) };
  } catch {
    return { ...DEFAULTS };
  }
})();
const savePrefs = () => {
  try {
    localStorage.setItem(PREFS, JSON.stringify(prefs));
  } catch {
    /* not remembered */
  }
};

let perms: Permissions | undefined;
let sources: ScreenSource[] = [];
const say = (text: string, tone: "" | "ok" | "err" = "") => {
  const el = $("status");
  el.textContent = text;
  el.className = `status ${tone}`;
};

// ── Setup ───────────────────────────────────────────────────────
async function checkPermissions() {
  perms = await mc.permissions();
  $("noticeScreen").hidden = perms.screen;
  const needInput = !perms.input || !perms.hookAvailable;
  $("noticeInput").hidden = !needInput;
  if (perms.input && !perms.hookAvailable) {
    $("noticeInputText").textContent = "The click log couldn't start on this computer. You can still record, without the log.";
    $("askInput").hidden = $("openInput").hidden = true;
  }
  $("optAudio").hidden = !perms.systemAudio;
}

async function loadSources() {
  sources = await mc.sources();
  const box = $("screens");
  box.classList.toggle("one", sources.length === 1);
  if (!sources.some((s) => s.id === prefs.sourceId)) prefs.sourceId = (sources.find((s) => s.primary) ?? sources[0])?.id ?? "";
  box.replaceChildren(
    ...sources.map((s) => {
      const b = document.createElement("button");
      b.setAttribute("aria-pressed", String(s.id === prefs.sourceId));
      const img = document.createElement("img");
      img.src = s.thumb;
      img.alt = "";
      const name = document.createElement("span");
      name.textContent = `${s.name} · ${s.bounds.width}×${s.bounds.height}`;
      b.append(img, name);
      b.onclick = () => {
        prefs.sourceId = s.id;
        savePrefs();
        box.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      };
      return b;
    }),
  );
  if (!sources.length) say("No screen to record found.", "err");
}

async function loadDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
  const fill = (sel: HTMLSelectElement, kind: MediaDeviceKind, value: string, off: string) => {
    const list = devices.filter((d) => d.kind === kind && d.deviceId !== "default" && d.deviceId !== "communications");
    const opts = [
      ...list.map((d, i) => new Option(d.label || `${kind === "videoinput" ? "Camera" : "Microphone"} ${i + 1}`, d.deviceId)),
      new Option(off, "none"),
    ];
    sel.replaceChildren(...opts);
    sel.value = list.some((d) => d.deviceId === value) || value === "none" ? value : (list[0]?.deviceId ?? "none");
  };
  fill($<HTMLSelectElement>("camSel"), "videoinput", prefs.cameraId, "No camera");
  fill($<HTMLSelectElement>("micSel"), "audioinput", prefs.micId, "No microphone");
  syncDevices();
}

function syncDevices() {
  const cam = $<HTMLSelectElement>("camSel").value;
  const mic = $<HTMLSelectElement>("micSel").value;
  $("camBox").classList.toggle("off", cam === "none");
  $("micBox").classList.toggle("off", mic === "none");
  $("camIcon").innerHTML = icons.camera;
  $("micIcon").innerHTML = mic === "none" ? icons.micOff : icons.mic;
  // The round self-view while setting up (excluded from the screen video).
  mc.setCamera(cam === "none" ? null : cam);
}

function toggle(id: string, key: "countdown" | "systemAudio") {
  const el = $(id);
  const render = () => el.setAttribute("aria-checked", String(prefs[key]));
  const flip = () => {
    prefs[key] = !prefs[key];
    savePrefs();
    render();
  };
  el.onclick = flip;
  el.onkeydown = (e) => (e.key === " " || e.key === "Enter") && (e.preventDefault(), flip());
  render();
}

$("camSel").onchange = () => {
  prefs.cameraId = $<HTMLSelectElement>("camSel").value;
  savePrefs();
  syncDevices();
};
$("micSel").onchange = () => {
  prefs.micId = $<HTMLSelectElement>("micSel").value;
  savePrefs();
  syncDevices();
};
$("openScreen").onclick = () => void mc.openPrivacySettings("screen");
$("openInput").onclick = () => void mc.openPrivacySettings("input");
$("askInput").onclick = () => void mc.requestInputAccess().then(checkPermissions);
$("recheck").onclick = () => void checkPermissions();
toggle("optCountdown", "countdown");
toggle("optAudio", "systemAudio");
navigator.mediaDevices.addEventListener("devicechange", () => void loadDevices());

// ── Recording ───────────────────────────────────────────────────
let recording: Recording | undefined;
let source: ScreenSource | undefined;
let logging = false;
let steps = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let unsubscribe: (() => void)[] = [];
let streams: MediaStream[] = [];

const stopStreams = () => {
  for (const s of streams) for (const t of s.getTracks()) t.stop();
  streams = [];
};

function countdown(): Promise<void> {
  if (!prefs.countdown) return Promise.resolve();
  const el = $("countdown");
  el.hidden = false;
  return new Promise((resolve) => {
    let n = 3;
    el.textContent = String(n);
    const t = setInterval(() => {
      n--;
      if (n === 0) {
        clearInterval(t);
        el.hidden = true;
        resolve();
      } else el.textContent = String(n);
    }, 1000);
  });
}

const clock = (us: number) => {
  const s = Math.floor(us / 1e6);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const pushPill = () => recording && mc.pill({ elapsed: clock(recording.elapsedUs), paused: recording.paused, steps, logging });

$("start").onclick = async () => {
  say("");
  source = sources.find((s) => s.id === prefs.sourceId);
  if (!source) return say("Pick a screen to record.", "err");
  if (perms && !perms.screen) return say("Allow screen recording first (see above).", "err");
  const start = $<HTMLButtonElement>("start");
  start.disabled = true;
  try {
    const camId = $<HTMLSelectElement>("camSel").value;
    const micId = $<HTMLSelectElement>("micSel").value;
    const systemAudio = !!perms?.systemAudio && prefs.systemAudio;
    await mc.chooseSource(source.id, systemAudio);
    // The main process answers this with the chosen screen (no system picker).
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: systemAudio });
    streams.push(screen);
    const mic = micId === "none" ? undefined : await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: micId }, echoCancellation: true, noiseSuppression: true } }).catch(() => undefined);
    const cam = camId === "none" ? undefined : await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: camId }, width: { ideal: 1280 }, height: { ideal: 720 } } }).catch(() => undefined);
    if (mic) streams.push(mic);
    if (cam) streams.push(cam);
    if (micId !== "none" && !mic) say("Microphone unavailable: recording without it.", "err");
    await countdown();
    // Hide this panel (and start the log, show the pill) first, so the panel isn't in the first frames.
    logging = await mc.started(source.id, cam ? camId : null);
    await new Promise((r) => setTimeout(r, 150));
    recording = await startRecording({
      screen,
      ...(mic ? { microphone: mic } : {}),
      ...(cam ? { camera: cam } : {}),
      events: false, // the log comes from the main process (every app, not this window)
      onEnded: () => void finish(true),
    });
    steps = 0;
    const rec = recording;
    unsubscribe = [
      mc.onInput(({ event, epochMs }) => rec.addEvent({ ...event, tUs: rec.clockAt(epochMs) })),
      mc.onCommand(onCommand),
    ];
    timer = setInterval(pushPill, 250);
    pushPill();
  } catch (err) {
    stopStreams();
    recording = undefined;
    await mc.ended();
    say(`Couldn't start: ${(err as Error).message}`, "err");
  } finally {
    start.disabled = false;
  }
};

function onCommand(c: RecorderCommand) {
  if (!recording) return;
  if (c === "pause") recording.pause();
  else if (c === "resume") recording.resume();
  else if (c === "step") {
    steps++;
    recording.mark(`Step ${steps}`);
  } else if (c === "stop") void finish(true);
  else if (c === "discard") void finish(false);
  pushPill();
}

let finishing = false;
async function finish(keep: boolean) {
  const rec = recording;
  if (!rec || finishing) return;
  finishing = true;
  clearInterval(timer);
  unsubscribe.forEach((u) => u());
  unsubscribe = [];
  show("saving");
  await mc.ended();
  try {
    if (!keep) {
      await rec.cancel();
      show("setup");
      say("Recording discarded.");
      return;
    }
    const result = await rec.stop();
    if (!result.screen) throw new Error("the screen video is empty");
    const session = forScreen(result.session, source!);
    $("savingText").textContent = "Packing the recording…";
    const file = await packRecording({ screen: result.screen, ...(result.camera ? { camera: result.camera } : {}), session });
    const path = await mc.save(await file.arrayBuffer(), `${fileStamp(new Date(session.startedAt))}.mcrec`);
    if (!path) {
      show("setup");
      say("Not saved: the save was cancelled.", "err");
      return;
    }
    const clicks = session.events.filter((e) => e.type === "click" || e.type === "dblclick" || e.type === "contextmenu").length;
    const keys = session.events.filter((e) => e.type === "key").length;
    const marks = session.events.filter((e) => e.type === "marker").length;
    $("savedPath").textContent = path;
    $("savedInfo").textContent = logging
      ? `${clock(session.durationUs)} · ${clicks} click${clicks === 1 ? "" : "s"}, ${keys} key${keys === 1 ? "" : "s"}, ${marks} step${marks === 1 ? "" : "s"} logged`
      : `${clock(session.durationUs)} · recorded without the click log`;
    $("reveal").onclick = () => void mc.reveal(path);
    show("done");
  } catch (err) {
    show("setup");
    say(`Couldn't save: ${(err as Error).message}`, "err");
  } finally {
    stopStreams();
    recording = undefined;
    finishing = false;
  }
}

/**
 * The session as the editor needs it for a whole-screen recording: the log's
 * viewport is the display (CSS px), filling the video frame exactly, and the
 * real pointer is in the video (the editor highlights it instead of drawing one).
 */
function forScreen(session: CaptureSession, s: ScreenSource): CaptureSession {
  return {
    ...session,
    viewport: { width: s.bounds.width, height: s.bounds.height, devicePixelRatio: s.scaleFactor },
    viewportInVideo: { x: 0, y: 0, width: 1, height: 1 },
    surface: "monitor",
    cursorInVideo: true,
  };
}

const fileStamp = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `Recording ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`;
};

function show(view: "setup" | "saving" | "done") {
  $("setup").hidden = view !== "setup";
  $("saving").hidden = view !== "saving";
  $("done").hidden = view !== "done";
  if (view === "saving") $("savingText").textContent = "Finishing your recording…";
  // The self-view only while setting up (and recording, where the main process decides).
  if (view === "setup") syncDevices();
  else mc.setCamera(null);
}

$("again").onclick = () => {
  show("setup");
  say("");
  void loadSources();
};

// ── Start ───────────────────────────────────────────────────────
void (async () => {
  await checkPermissions();
  await loadSources();
  // Labels appear once the camera/microphone were allowed: ask briefly, then list.
  await navigator.mediaDevices
    .getUserMedia({ audio: true, video: true })
    .then((s) => s.getTracks().forEach((t) => t.stop()))
    .catch(() => undefined);
  await loadDevices();
})();
window.addEventListener("focus", () => {
  if (!recording && !$("setup").hidden) void checkPermissions();
});
