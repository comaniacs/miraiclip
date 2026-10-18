/**
 * The avatar contract: a talking presenter rendered by a vendor from a
 * script or a voice track. Contract only: adapters for avatar services
 * implement `AvatarProvider` (keep their keys server-side, like the voice
 * generators). `avatarCommands` places a rendered presenter in a project as
 * a picture-in-picture, keyed out when it was rendered on a green screen.
 */

export interface AvatarInfo {
  id: string;
  name: string;
  previewUrl?: string;
  /** Voices the vendor pairs with this avatar, when it has its own. */
  voices?: { id: string; name: string; language?: string }[];
}

export interface AvatarRequest {
  avatarId: string;
  /** What the presenter says: text (the vendor's voice) or an existing voice track (lip-synced). */
  script: { text: string; voiceId?: string; language?: string } | { audio: { url: string } };
  /** Output frame (default 16:9 at the vendor's default size). */
  aspect?: "16:9" | "9:16" | "1:1";
  /** "transparent" when the vendor can render alpha, "green" for a key colour, or a CSS colour. */
  background?: "transparent" | "green" | string;
  /** Vendor-specific fields, passed through untouched. */
  params?: Record<string, unknown>;
}

export interface AvatarVideo {
  /** Where the rendered video is (vendors host it; copy it if you need it to last). */
  url: string;
  mimeType: string;
  durationUs: number;
  width: number;
  height: number;
  /** The background it was rendered on (to key it out). */
  background?: AvatarRequest["background"];
  id?: string;
}

export interface AvatarProvider {
  id: string;
  label: string;
  avatars(options?: { signal?: AbortSignal }): Promise<AvatarInfo[]>;
  /** Render (vendors queue jobs: implementations poll and report progress). Must honour `signal`. */
  render(request: AvatarRequest, options?: { signal?: AbortSignal; onProgress?: (p: { progress?: number; message?: string }) => void }): Promise<AvatarVideo>;
}

export interface AvatarPlacementOptions {
  /** Where the presenter's file is, as the project loads it (default: the video's url). */
  src?: string;
  id?: string;
  trackId?: string;
  createTrack?: boolean;
  startUs: number;
  /** Corner (default "bottom-right") and width as a fraction of the frame (default 0.3). "full" fills the frame. */
  corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "full";
  widthFrac?: number;
  /** The project's frame, for placement. */
  composition: { width: number; height: number };
  /** Key out a green background (default: when `background` is "green"). */
  chromaKey?: boolean;
}

export function avatarCommands(video: AvatarVideo, options: AvatarPlacementOptions): { type: string; payload: Record<string, unknown> }[] {
  const id = options.id ?? "avatar";
  const trackId = options.trackId ?? "avatar";
  const { width: W, height: H } = options.composition;
  const fit = Math.min(W / video.width, H / video.height);
  const corner = options.corner ?? "bottom-right";
  let transform: Record<string, number> = {};
  if (corner !== "full") {
    const scale = ((options.widthFrac ?? 0.3) * W) / (video.width * fit);
    const halfW = (video.width * fit * scale) / 2 / W;
    const halfH = (video.height * fit * scale) / 2 / H;
    const margin = 0.03;
    const round = (v: number) => Math.round(v * 1e6) / 1e6;
    transform = {
      x: round(corner.endsWith("right") ? 1 - margin - halfW : margin + halfW),
      y: round(corner.startsWith("bottom") ? 1 - margin * (W / H) - halfH : margin * (W / H) + halfH),
      scale: round(scale),
    };
  }
  const commands: { type: string; payload: Record<string, unknown> }[] = [
    { type: "asset/add", payload: { id, kind: "video", src: options.src ?? video.url, durationUs: video.durationUs, width: video.width, height: video.height, name: "Presenter", source: { provider: "avatar", id: video.id ?? "" } } },
  ];
  if (options.createTrack ?? true) commands.push({ type: "track/add", payload: { id: trackId, kind: "video", name: "Presenter" } });
  commands.push({ type: "clip/add", payload: { kind: "video", id, trackId, assetId: id, startUs: options.startUs, durationUs: video.durationUs, ...(Object.keys(transform).length ? { transform } : {}) } });
  if (options.chromaKey ?? video.background === "green") {
    commands.push({ type: "effect/add", payload: { clipId: id, kind: "chromaKey", effectId: `${id}-key` } });
  }
  return commands;
}
