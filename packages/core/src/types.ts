/** Microseconds — the timeline unit. 1 second = 1_000_000 µs. */
export type Us = number;

export interface ProjectSettings {
  width: number;
  height: number;
  fps: number;
  name?: string;
}

export type AssetKind = "video" | "audio" | "image";

export interface Asset {
  id: string;
  kind: AssetKind;
  src: string;
  /** Intrinsic duration of the media, if applicable (video/audio). */
  durationUs?: Us;
  width?: number;
  height?: number;
  fps?: number;
}

export type TrackKind = "video" | "audio";

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  solo: boolean;
  locked: boolean;
}

export interface Transform {
  /** Normalized center position: 0.5/0.5 = canvas center. */
  x: number;
  y: number;
  scale: number;
  /** Degrees. */
  rotation: number;
  /** 0..1 */
  opacity: number;
}

export const DEFAULT_TRANSFORM: Transform = {
  x: 0.5,
  y: 0.5,
  scale: 1,
  rotation: 0,
  opacity: 1,
};

export type ClipKind = "video" | "audio" | "image" | "text";

export interface ClipBase {
  id: string;
  trackId: string;
  /** Timeline placement. */
  startUs: Us;
  durationUs: Us;
  transform: Transform;
}

export interface VideoClip extends ClipBase {
  kind: "video";
  assetId: string;
  /** Source trim: offset into the asset where playback starts. */
  trimStartUs: Us;
  volume: number;
}

export interface AudioClip extends ClipBase {
  kind: "audio";
  assetId: string;
  trimStartUs: Us;
  volume: number;
}

export interface ImageClip extends ClipBase {
  kind: "image";
  assetId: string;
}

export interface TextClip extends ClipBase {
  kind: "text";
  text: string;
  fontFamily: string;
  fontSizePx: number;
  color: string;
}

export type Clip = VideoClip | AudioClip | ImageClip | TextClip;

/** Which clip kinds a track kind accepts. */
export const TRACK_ACCEPTS: Record<TrackKind, readonly ClipKind[]> = {
  video: ["video", "image", "text"],
  audio: ["audio"],
};

/**
 * The document: everything that is part of the composition, serialized and
 * covered by undo history.
 */
export interface ProjectDocument {
  schemaVersion: 1;
  settings: ProjectSettings;
  assets: Record<string, Asset>;
  tracks: Record<string, Track>;
  /** Render order: index 0 is the bottom layer. */
  trackOrder: string[];
  clips: Record<string, Clip>;
}

/**
 * Ephemeral session state: lives in the store, excluded from undo history
 * and from serialization.
 */
export interface EphemeralState {
  playheadUs: Us;
  selection: string[];
}

export interface ProjectState extends EphemeralState {
  doc: ProjectDocument;
}
