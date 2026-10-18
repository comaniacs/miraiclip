/**
 * The save page: a hidden extension page the recorder frames inside the
 * recorded site, so a finished recording can move from the site into the
 * extension's own storage (a content script can only write to the site's).
 * It accepts a recording only with a one-time token the background worker
 * gave the recorder, so other sites framing it can't fill the library.
 */
import type { CaptureSession } from "@miraiclip/capture";
import type { Message } from "./messages.js";
import { saveRecording, type StoredRecording } from "./store.js";

export interface SaveRequest {
  type: "mc-save";
  token: string;
  title: string;
  surface: StoredRecording["surface"];
  bubbleInVideo: boolean;
  screen: Blob;
  camera?: Blob;
  session: CaptureSession;
}

export type SaveReply = { ok: true; id: string } | { ok: false; error: string };

window.addEventListener("message", (event: MessageEvent<SaveRequest>) => {
  const port = event.ports[0];
  const data = event.data;
  if (!port || event.source !== window.parent || data?.type !== "mc-save") return;
  const answer = (r: SaveReply) => port.postMessage(r);
  void (async () => {
    try {
      const claim = (await chrome.runtime.sendMessage({ type: "mc-claim", token: data.token } satisfies Message)) as { ok: boolean } | undefined;
      if (!claim?.ok) return answer({ ok: false, error: "not allowed" });
      if (!(data.screen instanceof Blob)) return answer({ ok: false, error: "no video" });
      const id = await saveRecording({
        id: crypto.randomUUID(),
        title: String(data.title || "Untitled recording").slice(0, 200),
        createdAt: data.session.startedAt,
        durationUs: data.session.durationUs,
        surface: data.surface,
        bubbleInVideo: !!data.bubbleInVideo,
        screen: data.screen,
        ...(data.camera instanceof Blob ? { camera: data.camera } : {}),
        session: data.session,
      });
      answer({ ok: true, id });
    } catch (err) {
      answer({ ok: false, error: (err as Error).message || "could not save" });
    }
  })();
});
