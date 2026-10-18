/**
 * The review page: every recording made with the extension, newest first.
 * Watch one (with the camera placed as a picture-in-picture, the way the
 * editor will), rename it, jump to its steps, download it for the editor, or
 * delete it.
 */
import { packRecording, RECORDING_FILE_EXTENSION } from "@miraiclip/capture";
import { deleteRecording, getRecording, listRecordings, renameRecording, type RecordingSummary, type StoredRecording } from "./store.js";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const screenVideo = $<HTMLVideoElement>("screen");
const pip = $<HTMLVideoElement>("pip");
const showPip = $<HTMLInputElement>("showPip");
let current: StoredRecording | undefined;
let urls: string[] = [];

const clock = (us: number) => {
  const s = Math.round(us / 1e6);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const bytes = (n: number) => (n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.max(0.1, n / 1e6).toFixed(1)} MB`);
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const SURFACE: Record<StoredRecording["surface"], string> = { browser: "Tab", window: "Window", monitor: "Screen", camera: "Camera only" };
const fileName = (title: string) => title.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "recording";

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
}

async function renderList(selected?: string) {
  const all = await listRecordings();
  $("list").replaceChildren(
    ...all.map((r: RecordingSummary) => {
      const item = document.createElement("button");
      item.className = "item";
      item.setAttribute("aria-current", String(r.id === selected));
      const b = document.createElement("b");
      b.textContent = r.title;
      const span = document.createElement("span");
      span.textContent = `${when(r.createdAt)} · ${clock(r.durationUs)}`;
      item.append(b, span);
      item.onclick = () => (location.hash = r.id);
      return item;
    }),
  );
  const total = all.reduce((sum, r) => sum + r.bytes, 0);
  $("usage").textContent = all.length ? `${all.length} recording${all.length === 1 ? "" : "s"} · ${bytes(total)} on this computer` : "";
  return all;
}

function syncPip() {
  if (pip.hidden) return;
  if (Math.abs(pip.currentTime - screenVideo.currentTime) > 0.25) pip.currentTime = screenVideo.currentTime;
  if (screenVideo.paused !== pip.paused) void (screenVideo.paused ? pip.pause() : pip.play().catch(() => undefined));
}
for (const ev of ["play", "pause", "seeked", "timeupdate", "ratechange"]) screenVideo.addEventListener(ev, () => {
  pip.playbackRate = screenVideo.playbackRate;
  syncPip();
});
showPip.onchange = () => {
  pip.hidden = !showPip.checked;
  syncPip();
};

async function show(id: string | undefined) {
  urls.forEach((u) => URL.revokeObjectURL(u));
  urls = [];
  const all = await renderList(id);
  const r = id ? await getRecording(id) : undefined;
  if (!r) {
    current = undefined;
    $("detail").hidden = true;
    // No (or a deleted) recording picked: open the newest one, if there is one.
    if (all[0]) location.hash = all[0].id;
    else $("empty").hidden = false;
    return;
  }
  current = r;
  $("empty").hidden = true;
  $("detail").hidden = false;
  document.title = `${r.title} · Miraiclip Capture`;
  $<HTMLInputElement>("title").value = r.title;
  const steps = r.session.events.flatMap((e) => (e.type === "marker" && e.data?.kind === "step" ? [e] : []));
  const clicks = r.session.events.filter((e) => e.type === "click" || e.type === "dblclick").length;
  $("meta").replaceChildren(
    ...[when(r.createdAt), clock(r.durationUs), SURFACE[r.surface], r.camera ? "with camera" : "", `${steps.length} step${steps.length === 1 ? "" : "s"}`, clicks ? `${clicks} click${clicks === 1 ? "" : "s"} logged` : "", bytes(r.screen.size + (r.camera?.size ?? 0))]
      .filter(Boolean)
      .map((t) => Object.assign(document.createElement("span"), { textContent: t })),
  );
  const src = URL.createObjectURL(r.screen);
  urls.push(src);
  screenVideo.src = src;
  if (r.camera) {
    const cam = URL.createObjectURL(r.camera);
    urls.push(cam);
    pip.src = cam;
  } else pip.removeAttribute("src");
  // The camera is its own file; when the bubble stayed on the page it is already in the video.
  $("pipToggle").hidden = !r.camera;
  showPip.checked = !!r.camera && !r.bubbleInVideo;
  pip.hidden = !showPip.checked;
  $("stepsSection").hidden = !steps.length;
  $("steps").replaceChildren(
    ...steps.map((s) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      const code = document.createElement("code");
      code.textContent = clock(s.tUs);
      b.append(code, document.createTextNode(s.label));
      b.onclick = () => {
        screenVideo.currentTime = s.tUs / 1e6;
        void screenVideo.play().catch(() => undefined);
      };
      li.append(b);
      return li;
    }),
  );
  disarm();
}

$<HTMLInputElement>("title").addEventListener("change", async (e) => {
  if (!current) return;
  const title = (e.target as HTMLInputElement).value.trim() || "Untitled recording";
  current = { ...current, title };
  await renameRecording(current.id, title);
  document.title = `${title} · Miraiclip Capture`;
  await renderList(current.id);
});
$<HTMLInputElement>("title").addEventListener("keydown", (e) => e.key === "Enter" && (e.target as HTMLInputElement).blur());

$("download").onclick = async () => {
  if (!current) return;
  const { screen, camera, session, title } = current;
  try {
    download(await packRecording({ screen, ...(camera ? { camera } : {}), session }), `${fileName(title)}${RECORDING_FILE_EXTENSION}`);
  } catch {
    // Too big to pack (over 4 GB): the separate files, which the editor imports together too.
    download(screen, `${fileName(title)}.webm`);
    if (camera) download(camera, `${fileName(title)}.camera.webm`);
    download(new Blob([JSON.stringify(session, null, 2)], { type: "application/json" }), `${fileName(title)}.session.json`);
  }
};
$("downloadVideo").onclick = () => current && download(current.screen, `${fileName(current.title)}.webm`);

// Delete asks twice: the first click arms the button.
let armed: ReturnType<typeof setTimeout> | undefined;
function disarm() {
  clearTimeout(armed);
  armed = undefined;
  $("delete").classList.remove("armed");
  $("delete").textContent = "Delete";
}
$("delete").onclick = async () => {
  if (!current) return;
  if (!armed) {
    $("delete").classList.add("armed");
    $("delete").textContent = "Click again to delete";
    armed = setTimeout(disarm, 4000);
    return;
  }
  disarm();
  const id = current.id;
  screenVideo.removeAttribute("src");
  pip.removeAttribute("src");
  await deleteRecording(id);
  location.hash = "";
  await show(undefined);
};

$("new").onclick = () => (location.href = chrome.runtime.getURL("record.html"));

window.addEventListener("hashchange", () => void show(location.hash.slice(1) || undefined));
void show(location.hash.slice(1) || undefined);
