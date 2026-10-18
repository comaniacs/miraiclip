/**
 * Miraiclip Recorder (desktop): record a whole screen with camera and voice,
 * and log clicks, shortcuts, scrolls and the cursor path anywhere on it — in
 * any app, not just the browser. Saves the same .mcrec the Capture extension
 * does, so the editor's polish (zooms, cursor, click ripples) works on it.
 *
 * Windows:
 * - recorder: the setup panel; it also runs the recording (hidden meanwhile);
 * - pill: finish / pause / step / discard, always on top;
 * - camera: a round self-view, always on top.
 * The pill and camera are excluded from screen capture (content protection),
 * so they never end up in the video.
 */
import { app, BrowserWindow, desktopCapturer, dialog, globalShortcut, ipcMain, screen, session, shell, systemPreferences, type Rectangle } from "electron";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CaptureEvent } from "@miraiclip/capture";
import { createInputLog, keyNamesFrom, type InputLog, type LoggedEvent } from "./input-log.js";
import type { InputMessage, PillState, Permissions, RecorderCommand, ScreenSource } from "../shared/ipc.js";

const isMac = process.platform === "darwin";
const isWin = process.platform === "win32";
const page = (name: string) => join(__dirname, "pages", `${name}.html`);
const preload = join(__dirname, "preload.cjs");

/** Global shortcuts while recording (the same as the Capture extension). */
const SHORTCUTS: Record<string, RecorderCommand | "toggle"> = {
  "Alt+Shift+X": "stop",
  "Alt+Shift+P": "toggle",
  "Alt+Shift+S": "step",
};

let recorder: BrowserWindow | undefined;
let pill: BrowserWindow | undefined;
let camera: BrowserWindow | undefined;
let paused = false;

// ── The native input hook (loaded lazily: a missing or blocked hook only loses the click log) ──
type Hook = typeof import("uiohook-napi");
let hook: Hook | undefined;
let hookError: string | undefined;
function loadHook(): Hook | undefined {
  if (hook || hookError) return hook;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    hook = require("uiohook-napi") as Hook;
  } catch (err) {
    hookError = (err as Error).message;
  }
  return hook;
}

function inputAccess(prompt = false): boolean {
  return isMac ? systemPreferences.isTrustedAccessibilityClient(prompt) : true;
}

function screenAccess(): boolean {
  return isMac ? systemPreferences.getMediaAccessStatus("screen") === "granted" : true;
}

// ── Windows ─────────────────────────────────────────────────────
function webPrefs() {
  return { preload, contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false } as const;
}

function createRecorder() {
  recorder = new BrowserWindow({
    width: 400,
    height: 640,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "Miraiclip Recorder",
    backgroundColor: "#0f1115",
    show: false,
    webPreferences: webPrefs(),
  });
  recorder.setMenuBarVisibility(false);
  recorder.once("ready-to-show", () => recorder?.show());
  void recorder.loadFile(page("recorder"));
  recorder.on("closed", () => {
    recorder = undefined;
    camera?.destroy();
    pill?.destroy();
    stopLog();
  });
}

function createPill(area: Rectangle) {
  const width = 340;
  const height = 56;
  pill = new BrowserWindow({
    width,
    height,
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + area.height - height - 72),
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    hasShadow: false,
    show: false,
    webPreferences: webPrefs(),
  });
  pill.setAlwaysOnTop(true, "screen-saver");
  pill.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  pill.setContentProtection(true); // not in the screen video
  void pill.loadFile(page("pill"));
  pill.once("ready-to-show", () => pill?.showInactive());
}

function showCamera(cameraId: string | null) {
  if (!cameraId) {
    camera?.destroy();
    camera = undefined;
    return;
  }
  if (!camera) {
    const display = screen.getPrimaryDisplay().workArea;
    const size = 200;
    camera = new BrowserWindow({
      width: size,
      height: size,
      x: display.x + 40,
      y: display.y + display.height - size - 40,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      focusable: false,
      show: false,
      webPreferences: webPrefs(),
    });
    camera.setAlwaysOnTop(true, "screen-saver");
    camera.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    camera.setContentProtection(true); // a self-view only: the camera is saved as its own file
    camera.on("closed", () => (camera = undefined));
    void camera.loadFile(page("camera"));
    camera.once("ready-to-show", () => camera?.showInactive());
    camera.webContents.once("did-finish-load", () => camera?.webContents.send("mc:camera", cameraId));
  } else {
    camera.webContents.send("mc:camera", cameraId);
  }
}

/** Points over the recorder's own windows (not logged). */
function overOwnWindow(p: { x: number; y: number }): boolean {
  for (const w of [pill, camera]) {
    if (!w || w.isDestroyed() || !w.isVisible()) continue;
    const b = w.getBounds();
    if (p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height) return true;
  }
  return false;
}

// ── Sources ─────────────────────────────────────────────────────
let chosen: { id: string; systemAudio: boolean } | undefined;

async function listSources(): Promise<ScreenSource[]> {
  const sources = await desktopCapturer.getSources({ types: ["screen"], thumbnailSize: { width: 320, height: 180 } });
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  return sources.map((s, i) => {
    const display = displays.find((d) => String(d.id) === s.display_id) ?? displays[i] ?? primary;
    return {
      id: s.id,
      name: displays.length > 1 ? `${s.name}${display.id === primary.id ? " (main)" : ""}` : "Entire screen",
      thumb: s.thumbnail.toDataURL(),
      bounds: display.bounds,
      scaleFactor: display.scaleFactor,
      primary: display.id === primary.id,
    };
  });
}

// ── The click log ───────────────────────────────────────────────
let log: InputLog | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlers: { event: string; fn: (...args: any[]) => void }[] = [];

function startLog(area: Rectangle): boolean {
  stopLog();
  const h = loadHook();
  if (!h || !inputAccess()) return false;
  const send = (event: LoggedEvent) => {
    if (paused || !recorder || recorder.isDestroyed()) return;
    recorder.webContents.send("mc:input", { event: { ...event, tUs: 0 } as CaptureEvent, epochMs: Date.now() } satisfies InputMessage);
  };
  log = createInputLog({
    // Windows hooks report physical pixels; macOS reports points (already DIP).
    toDip: (p) => (isWin ? screen.screenToDipPoint(p) : p),
    area,
    isOwn: overOwnWindow,
    keyNames: keyNamesFrom(h.UiohookKey as unknown as Record<string, number>),
    ownShortcuts: new Set(Object.keys(SHORTCUTS).map((s) => s.replace(/\+([A-Z])$/, (_, k: string) => `+${k.toLowerCase()}`))),
    emit: send,
  });
  const on = <E>(event: string, fn: (e: E) => void) => {
    h.uIOhook.on(event as "input", fn as never);
    handlers.push({ event, fn: fn as (...args: unknown[]) => void });
  };
  const l = log;
  on("mousedown", (e: Parameters<InputLog["mouseDown"]>[0]) => l.mouseDown(e));
  on("mouseup", (e: Parameters<InputLog["mouseUp"]>[0]) => l.mouseUp(e));
  on("mousemove", (e: Parameters<InputLog["mouseMove"]>[0]) => l.mouseMove(e));
  on("wheel", (e: Parameters<InputLog["wheel"]>[0]) => l.wheel(e));
  on("keydown", (e: Parameters<InputLog["keyDown"]>[0]) => l.keyDown(e));
  try {
    h.uIOhook.start();
    return true;
  } catch (err) {
    hookError = (err as Error).message;
    stopLog();
    return false;
  }
}

function stopLog() {
  if (!hook) return;
  for (const { event, fn } of handlers.splice(0)) hook.uIOhook.off(event, fn);
  if (log) {
    try {
      hook.uIOhook.stop();
    } catch {
      /* already stopped */
    }
  }
  log = undefined;
}

// ── Shortcuts ───────────────────────────────────────────────────
function sendCommand(c: RecorderCommand) {
  if (c === "pause") paused = true;
  if (c === "resume") paused = false;
  recorder?.webContents.send("mc:command", c);
}

function registerShortcuts() {
  for (const [accel, action] of Object.entries(SHORTCUTS)) {
    globalShortcut.register(accel, () => sendCommand(action === "toggle" ? (paused ? "resume" : "pause") : action));
  }
}

// ── IPC ─────────────────────────────────────────────────────────
function wireIpc() {
  ipcMain.handle("mc:permissions", (): Permissions => ({
    platform: process.platform,
    screen: screenAccess(),
    input: inputAccess(),
    hookAvailable: !!loadHook(),
    systemAudio: isWin,
  }));
  ipcMain.handle("mc:request-input", () => inputAccess(true));
  ipcMain.handle("mc:open-privacy", (_e, kind: "screen" | "input") => {
    if (!isMac) return;
    const pane = kind === "screen" ? "Privacy_ScreenCapture" : "Privacy_Accessibility";
    void shell.openExternal(`x-apple.systempreferences:com.apple.preference.security?${pane}`);
  });
  ipcMain.handle("mc:sources", () => listSources());
  ipcMain.handle("mc:choose-source", (_e, id: string, systemAudio: boolean) => {
    chosen = { id, systemAudio };
  });
  ipcMain.handle("mc:started", async (_e, sourceId: string, cameraId: string | null) => {
    const source = (await listSources()).find((s) => s.id === sourceId);
    const area = source?.bounds ?? screen.getPrimaryDisplay().bounds;
    paused = false;
    const logging = startLog(area);
    registerShortcuts();
    recorder?.hide();
    createPill(area);
    // The self-view stays on Windows (excluded from capture there). macOS may still capture
    // protected windows with its newer capture API, so it hides while recording.
    if (isMac) showCamera(null);
    else if (cameraId) showCamera(cameraId);
    return logging;
  });
  ipcMain.handle("mc:ended", () => {
    stopLog();
    globalShortcut.unregisterAll();
    pill?.destroy();
    pill = undefined;
    paused = false;
    recorder?.show();
    recorder?.focus();
  });
  ipcMain.on("mc:pill", (_e, state: PillState) => pill?.webContents.send("mc:pill", state));
  ipcMain.on("mc:command", (_e, c: RecorderCommand) => sendCommand(c));
  ipcMain.on("mc:set-camera", (_e, cameraId: string | null) => showCamera(cameraId));
  ipcMain.handle("mc:save", async (_e, bytes: ArrayBuffer, suggestedName: string) => {
    const dir = process.env["MC_SAVE_DIR"] ?? join(app.getPath("videos"), "Miraiclip");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // Automated runs (MC_SAVE_DIR set) save without the dialog.
    if (process.env["MC_SAVE_DIR"]) {
      const path = join(dir, suggestedName);
      writeFileSync(path, Buffer.from(bytes));
      return path;
    }
    const result = await dialog.showSaveDialog(recorder!, {
      title: "Save recording",
      defaultPath: join(dir, suggestedName),
      filters: [{ name: "Miraiclip recording", extensions: ["mcrec"] }],
    });
    if (result.canceled || !result.filePath) return null;
    writeFileSync(result.filePath, Buffer.from(bytes));
    return result.filePath;
  });
  ipcMain.handle("mc:reveal", (_e, path: string) => shell.showItemInFolder(path));
}

// ── App ─────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => {
  if (recorder?.isVisible()) recorder.focus();
});

void app.whenReady().then(async () => {
  if (isMac) {
    // Ask for the camera and microphone up front (the panel lists devices only once allowed).
    await systemPreferences.askForMediaAccess("camera").catch(() => false);
    await systemPreferences.askForMediaAccess("microphone").catch(() => false);
  }
  // getDisplayMedia() in the recorder returns the screen picked in the panel (no system picker).
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const sources = await desktopCapturer.getSources({ types: ["screen"] });
    const source = sources.find((s) => s.id === chosen?.id) ?? sources[0];
    if (!source) return callback({});
    callback({ video: source, ...(chosen?.systemAudio && isWin ? { audio: "loopback" as const } : {}) });
  });
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === "media" || permission === "display-capture"));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === "media" || permission === "display-capture");
  wireIpc();
  createRecorder();
  app.on("activate", () => {
    if (!recorder) createRecorder();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  stopLog();
});
app.on("window-all-closed", () => app.quit());
