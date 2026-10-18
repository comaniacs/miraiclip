/** The round camera self-view (its window is excluded from screen capture). */
import type { McApi } from "../shared/ipc.js";

const mc = (window as unknown as { mc: McApi }).mc;
const video = document.getElementById("video") as HTMLVideoElement;
let stream: MediaStream | undefined;
let current: string | null = null;

mc.onCamera(async (cameraId) => {
  if (cameraId === current) return;
  current = cameraId;
  stream?.getTracks().forEach((t) => t.stop());
  stream = undefined;
  if (!cameraId) return;
  stream = await navigator.mediaDevices
    .getUserMedia({ video: { deviceId: { exact: cameraId }, width: { ideal: 640 }, height: { ideal: 360 } } })
    .catch(() => undefined);
  video.srcObject = stream ?? null;
});
window.addEventListener("beforeunload", () => stream?.getTracks().forEach((t) => t.stop()));
