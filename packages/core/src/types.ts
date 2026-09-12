/** Microseconds — the timeline unit. 1 second = 1_000_000 µs. */
export type Us = number;

export interface ProjectSettings {
  width: number;
  height: number;
  fps: number;
  name?: string;
}

export type AssetKind = "video" | "audio" | "image" | "font";

export interface Asset {
  id: string;
  kind: AssetKind;
  src: string;
  /** Intrinsic duration of the media, if applicable (video/audio). */
  durationUs?: Us;
  width?: number;
  height?: number;
  fps?: number;
  /** Font assets: the CSS font-family name clips reference. */
  family?: string;
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

// ---------------------------------------------------------------------------
// Animation (v4): keyframes on clip properties, evaluated by
// `evaluateClipAt` — a pure function shared by preview, export, and any
// consumer, so they can never disagree.
// ---------------------------------------------------------------------------

/**
 * Easings are STORED as cubic-bézier control points (CSS convention:
 * progress x → eased y) — named presets are input sugar that expands at
 * command time. "hold" steps to the next keyframe with no interpolation.
 */
export type Easing =
  | { kind: "bezier"; x1: number; y1: number; x2: number; y2: number }
  | { kind: "hold" };

export type EasingPreset = "linear" | "hold" | "easeIn" | "easeOut" | "easeInOut";

export interface Keyframe {
  /** Clip-relative time: 0 = the clip's visible start (anchor never moves with trims). */
  timeUs: Us;
  value: number;
  /** The curve from THIS keyframe to the next one. */
  easing: Easing;
}

export type AnimatableProperty = "x" | "y" | "scale" | "rotation" | "opacity" | "volume";

/**
 * One effect in a clip's stack. `kind` resolves through the effect registry
 * (built-ins: colorAdjust, blur, chromaKey); `params` are validated against
 * the kind's schema at command time. Length-denoting params are normalized
 * to composition units — absolute pixels would render differently between a
 * scaled preview and a full-resolution export.
 */
export interface EffectInstance {
  id: string;
  kind: string;
  enabled: boolean;
  params: Record<string, unknown>;
}

export type ClipKind = "video" | "audio" | "image" | "text" | "caption";

export interface ClipBase {
  id: string;
  trackId: string;
  /** Timeline placement. */
  startUs: Us;
  durationUs: Us;
  transform: Transform;
  /** Keyframes per animated property; a property without keyframes uses the clip's static value. */
  animations?: Partial<Record<AnimatableProperty, Keyframe[]>>;
  /** Effect stack, applied pre-transform in array order. */
  effects?: EffectInstance[];
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

/** One word of a caption, timed relative to the clip's start. */
export interface CaptionWord {
  text: string;
  startUs: Us;
  durationUs: Us;
}

export interface CaptionStyle {
  /** How the active word is emphasized. */
  preset: "plain" | "highlight" | "karaoke" | "pop";
  fontFamily: string;
  /** Font size as a fraction of composition height (resolution-independent). */
  fontSizeFrac: number;
  color: string;
  highlightColor: string;
  /** Optional box behind the caption block. */
  backgroundColor?: string;
}

/** Reels-style karaoke caption: word-level timing with an active-word style. */
export interface CaptionClip extends ClipBase {
  kind: "caption";
  words: CaptionWord[];
  style: CaptionStyle;
}

/**
 * A clip of a registered custom kind (see `registerClipKind`). Its payload
 * lives under `props`, validated by the kind's registered schema.
 */
export interface CustomClip extends ClipBase {
  kind: string;
  props: Record<string, unknown>;
}

export type BuiltinClip = VideoClip | AudioClip | ImageClip | TextClip | CaptionClip;
export type Clip = BuiltinClip | CustomClip;

// `CustomClip.kind: string` swallows literal narrowing (`clip.kind ===
// "video"` no longer proves VideoClip), so consumers use these guards.
export const isVideoClip = (clip: Clip): clip is VideoClip =>
  clip.kind === "video" && "assetId" in clip;
export const isAudioClip = (clip: Clip): clip is AudioClip =>
  clip.kind === "audio" && "assetId" in clip;
export const isImageClip = (clip: Clip): clip is ImageClip =>
  clip.kind === "image" && "assetId" in clip;
export const isTextClip = (clip: Clip): clip is TextClip =>
  clip.kind === "text" && "text" in clip;
export const isCaptionClip = (clip: Clip): clip is CaptionClip =>
  clip.kind === "caption" && "words" in clip;

/** Which clip kinds a track kind accepts (custom kinds declare theirs at registration). */
export const TRACK_ACCEPTS: Record<TrackKind, readonly ClipKind[]> = {
  video: ["video", "image", "text", "caption"],
  audio: ["audio"],
};

// ---------------------------------------------------------------------------
// Transitions (v4): adjacent-clips + trim-handles model (never physically
// overlapping clips). The transition draws lead-out/lead-in media from the
// clips' source headroom, centered on the cut.
// ---------------------------------------------------------------------------

export interface Transition {
  id: string;
  trackId: string;
  /** The clip ending at the cut. */
  fromClipId: string;
  /** The clip starting at the cut. */
  toClipId: string;
  /** Registry-resolved kind (built-ins: crossDissolve, dipToBlack, dipToWhite, wipe, slide). */
  kind: string;
  durationUs: Us;
  /** Reserved: only "centered" in v4. */
  alignment: "centered";
  params: Record<string, unknown>;
}

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
  /** Transitions between adjacent clips, keyed by id. */
  transitions: Record<string, Transition>;
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
