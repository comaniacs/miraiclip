/** The bridge every window gets as `window.mc` (see McApi). */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { InputMessage, McApi, PillState, RecorderCommand } from "./shared/ipc.js";

function listen<T>(channel: string, listener: (value: T) => void): () => void {
  const fn = (_e: IpcRendererEvent, value: T) => listener(value);
  ipcRenderer.on(channel, fn);
  return () => ipcRenderer.removeListener(channel, fn);
}

const api: McApi = {
  permissions: () => ipcRenderer.invoke("mc:permissions"),
  openPrivacySettings: (kind) => ipcRenderer.invoke("mc:open-privacy", kind),
  requestInputAccess: () => ipcRenderer.invoke("mc:request-input"),
  sources: () => ipcRenderer.invoke("mc:sources"),
  chooseSource: (id, systemAudio) => ipcRenderer.invoke("mc:choose-source", id, systemAudio),
  started: (sourceId, cameraId) => ipcRenderer.invoke("mc:started", sourceId, cameraId),
  ended: () => ipcRenderer.invoke("mc:ended"),
  pill: (state) => ipcRenderer.send("mc:pill", state),
  onInput: (listener) => listen<InputMessage>("mc:input", listener),
  onCommand: (listener) => listen<RecorderCommand>("mc:command", listener),
  save: (bytes, name) => ipcRenderer.invoke("mc:save", bytes, name),
  reveal: (path) => ipcRenderer.invoke("mc:reveal", path),
  command: (c) => ipcRenderer.send("mc:command", c),
  onPill: (listener) => listen<PillState>("mc:pill", listener),
  onCamera: (listener) => listen<string | null>("mc:camera", listener),
  setCamera: (cameraId) => ipcRenderer.send("mc:set-camera", cameraId),
};

contextBridge.exposeInMainWorld("mc", api);
