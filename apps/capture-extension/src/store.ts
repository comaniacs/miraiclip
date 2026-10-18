/**
 * Finished recordings, kept in the extension's own IndexedDB (the extension's
 * origin, so every site's recordings land in one library) until they are
 * deleted from the review page.
 */
import type { CaptureSession } from "@miraiclip/capture";

export interface StoredRecording {
  id: string;
  title: string;
  /** ISO time the recording started. */
  createdAt: string;
  durationUs: number;
  /** What was recorded: a tab, a window, a screen, or only the camera. */
  surface: "browser" | "window" | "monitor" | "camera";
  /** The camera bubble stayed on the page, so it is already in the screen video. */
  bubbleInVideo: boolean;
  screen: Blob;
  camera?: Blob;
  session: CaptureSession;
}

/** What the library lists (no videos). */
export type RecordingSummary = Omit<StoredRecording, "screen" | "camera" | "session"> & { steps: number; clicks: number; bytes: number };

const DB = "miraiclip-capture";
const STORE = "recordings";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error ?? req.error);
    });
  } finally {
    db.close();
  }
}

export const saveRecording = (r: StoredRecording) => run("readwrite", (s) => s.put(r)).then(() => r.id);
export const getRecording = (id: string) => run<StoredRecording | undefined>("readonly", (s) => s.get(id));
export const deleteRecording = (id: string) => run("readwrite", (s) => s.delete(id)).then(() => undefined);

export async function renameRecording(id: string, title: string) {
  const r = await getRecording(id);
  if (r) await saveRecording({ ...r, title });
}

export function summarize(r: StoredRecording): RecordingSummary {
  const { screen, camera, session, ...rest } = r;
  return {
    ...rest,
    steps: session.events.filter((e) => e.type === "marker" && e.data?.kind === "step").length,
    clicks: session.events.filter((e) => e.type === "click" || e.type === "dblclick").length,
    bytes: screen.size + (camera?.size ?? 0),
  };
}

/** Every recording, newest first. */
export async function listRecordings(): Promise<RecordingSummary[]> {
  const all = await run<StoredRecording[]>("readonly", (s) => s.getAll());
  return all.map(summarize).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
