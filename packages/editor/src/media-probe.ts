import { US_PER_SECOND, type AssetKind } from "@miraiclip/core";

/*
 * Browser helpers for media import. They use the DOM (object URLs, media
 * elements, a canvas for the thumbnail) only when called, so importing this
 * package elsewhere (Node, tests, workers) stays safe.
 */

export interface ProbedMedia {
  kind: Extract<AssetKind, "video" | "audio" | "image">;
  src: string; // object URL
  durationUs: number;
  width?: number;
  height?: number;
  /** data: URL thumbnail (video first frame / the image itself); undefined for audio. */
  thumb?: string;
}

const IMAGE_DEFAULT_US = 5 * US_PER_SECOND;

function kindOf(file: File): ProbedMedia["kind"] | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  return null;
}

/**
 * Read a media file's metadata (and a thumbnail for video/image) in the
 * browser, without decoding it into the engine. Returns everything needed for
 * an `asset/add` command, with `src` as an object URL (revoke it when the
 * asset is gone, or upload the file and use your own URL). Best-effort: on a
 * probe failure it still returns a usable asset with a fallback duration.
 * Returns null for files that aren't video, audio or images.
 */
export async function probeMediaFile(file: File): Promise<ProbedMedia | null> {
  const kind = kindOf(file);
  if (!kind) return null;
  const src = URL.createObjectURL(file);

  try {
    if (kind === "image") {
      const img = await loadImage(src);
      return {
        kind,
        src,
        durationUs: IMAGE_DEFAULT_US,
        width: img.naturalWidth,
        height: img.naturalHeight,
        thumb: src, // the image itself is a fine thumbnail
      };
    }
    if (kind === "audio") {
      const durationUs = await probeDuration(src, "audio");
      return { kind, src, durationUs };
    }
    // video
    const { durationUs, width, height, thumb } = await probeVideo(src);
    // Audio-only WebM/MP4 files report a video/* type; no picture → audio.
    if (!width || !height) return { kind: "audio", src, durationUs };
    return { kind, src, durationUs, width, height, ...(thumb ? { thumb } : {}) };
  } catch {
    // Keep the object URL and let the user place it; guess a duration.
    return { kind, src, durationUs: kind === "audio" ? 30 * US_PER_SECOND : IMAGE_DEFAULT_US };
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function probeDuration(src: string, tag: "audio" | "video"): Promise<number> {
  return new Promise((resolve, reject) => {
    const el = document.createElement(tag);
    el.preload = "metadata";
    const done = (d: number) => resolve(Math.max(1, Math.round(d * US_PER_SECOND)));
    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration)) return done(el.duration);
      // MediaRecorder WebM has no duration in its header (Chrome reports
      // Infinity): seeking far past the end makes the element scan and
      // report the real one.
      const timer = setTimeout(() => done(0), 4000);
      el.ondurationchange = () => {
        if (!Number.isFinite(el.duration)) return;
        clearTimeout(timer);
        el.ondurationchange = null;
        done(el.duration);
      };
      el.currentTime = 1e7;
    };
    el.onerror = reject;
    el.src = src;
  });
}

function probeVideo(
  src: string,
): Promise<{ durationUs: number; width: number; height: number; thumb?: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const durationUs = Math.max(1, Math.round((video.duration || 1) * US_PER_SECOND));
      const width = video.videoWidth;
      const height = video.videoHeight;
      // Seek a touch in to grab a representative frame.
      const seekTo = Math.min(0.1, (video.duration || 0) / 2);
      const done = (thumb?: string) => resolve({ durationUs, width, height, ...(thumb ? { thumb } : {}) });
      video.onseeked = () => {
        try {
          const scale = 160 / Math.max(1, height);
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) return done();
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          done(canvas.toDataURL("image/jpeg", 0.6));
        } catch {
          done(); // tainted canvas or draw failure — no thumb, still usable
        }
      };
      video.currentTime = seekTo;
    };
    video.onerror = reject;
    video.src = src;
  });
}

/**
 * Whether a media `src` can still be fetched: catches session-only `blob:`
 * URLs in a reopened project and URLs that 404. `data:` URLs are always
 * reachable.
 */
export async function isSourceReachable(src: string): Promise<boolean> {
  if (src.startsWith("data:")) return true;
  try {
    // Blob URLs only answer GET; for everything else HEAD avoids the download.
    const res = await fetch(src, { method: src.startsWith("blob:") ? "GET" : "HEAD" });
    void res.body?.cancel();
    return res.ok;
  } catch {
    return false;
  }
}
