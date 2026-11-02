/** Microseconds — the timeline unit. 1 second = 1_000_000 µs. */
export type Us = number;

/** An exact frame rate as a ratio of positive integers: NTSC 29.97 is `{ num: 30000, den: 1001 }`. */
export interface FrameRate {
  num: number;
  den: number;
}

export interface ProjectSettings {
  width: number;
  height: number;
  /**
   * Frames per second. A decimal NTSC rate (29.97, 23.976, 59.94) is read as
   * its exact `/1001` ratio; read the exact rate with `projectFrameRate(settings)`.
   */
  fps: number;
  /**
   * The exact rate, kept when it isn't a whole number (`fps` then mirrors
   * num/den). `project/set-settings` keeps the two in sync.
   */
  frameRate?: FrameRate;
  name?: string;
}

export type AssetKind = "video" | "audio" | "image" | "font";

/** Where an asset came from (a stock library, a generator, a recording, an upload). */
export interface AssetSource {
  /** Provider id, e.g. "openverse", "freesound", "recording", "upload". */
  provider: string;
  /** The provider's own id for the item (empty for uploads/recordings). */
  id: string;
  /** Human-facing page for the item (license and credits live there). */
  url?: string;
}

/** The terms an asset may be used under. */
export interface AssetLicense {
  /** SPDX-style id, e.g. "CC0-1.0", "CC-BY-4.0", "CC-BY-NC-4.0", or a provider's own name. */
  id: string;
  url?: string;
  /** May the asset be used in commercial work? */
  commercial: boolean;
  /** Must the work credit the author (see `Asset.attribution`)? */
  attributionRequired: boolean;
}

export interface Asset {
  id: string;
  kind: AssetKind;
  src: string;
  /** Display name (e.g. a stock track's title). */
  name?: string;
  /** Provenance — set by importers; absent for plain uploads. */
  source?: AssetSource;
  license?: AssetLicense;
  /** The credit line to show when the license requires it, e.g. "“Calm Piano” by Jane Doe (CC BY 4.0)". */
  attribution?: string;
  /** Intrinsic duration of the media, if applicable (video/audio). */
  durationUs?: Us;
  width?: number;
  height?: number;
  fps?: number;
  /** Font assets: the CSS font-family name clips reference. */
  family?: string;
  /** Font assets: the face's weight descriptor (100–900; default 400). */
  weight?: FontWeight;
  /** Font assets: the face's style descriptor (default "normal"). */
  style?: FontStyle;
  /**
   * Font assets: a VARIABLE font's weight axis range, e.g. [100, 900]. The
   * face is declared over the whole range, so every weight in it renders
   * from the font's own axis instead of a synthesized bold. Takes precedence
   * over `weight`.
   */
  weightRange?: [FontWeight, FontWeight];
}

/** CSS font weight: 100–900 in steps of 100 (validated by the command schemas). */
export type FontWeight = number;
export type FontStyle = "normal" | "italic";
export type TextAlign = "left" | "center" | "right";

/**
 * Optional typography shared by text clips and caption styles. Absent fields
 * mean the default (see `TYPOGRAPHY_DEFAULTS`) — which is exactly how clips
 * rendered before these fields existed. Documents only carry what was set, so
 * older projects load, render, and serialize unchanged.
 */
export interface Typography {
  /** 100–900 (default 400). */
  fontWeight?: FontWeight;
  /** Default "normal". */
  fontStyle?: FontStyle;
  /**
   * Line box height as a multiple of font size. Absent = today's rendering:
   * the font's natural line height for text clips, 1.3 for captions.
   */
  lineHeight?: number;
  /** Extra space between characters in em — scales with font size (default 0). */
  letterSpacing?: number;
}

export type TrackKind = "video" | "audio";

export interface Track {
  id: string;
  kind: TrackKind;
  name: string;
  muted: boolean;
  solo: boolean;
  locked: boolean;
  /** Visual tracks: when true, the track's clips aren't drawn (preview, export, stills). Audio is unaffected — use `muted`. */
  hidden?: boolean;
}

export interface Transform {
  /** Normalized center position: 0.5/0.5 = canvas center. */
  x: number;
  y: number;
  scale: number;
  /**
   * Extra stretch along the clip's own horizontal / vertical axis, multiplied with `scale`
   * (default 1, absent in documents that never used it). Negative mirrors the content
   * (a flip); never 0. Not animatable.
   */
  scaleX?: number;
  scaleY?: number;
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
  /**
   * Clip-relative time. By default measured from the clip's visible start
   * (0 = start; never moves with trims). With `anchor: "end"` it is measured
   * BACK from the clip's visible end (0 = the last instant), so Out animations
   * stay glued to the end when the clip is trimmed or resized.
   */
  timeUs: Us;
  /** Omitted = "start". */
  anchor?: "end";
  value: number;
  /** The curve from THIS keyframe to the next one. */
  easing: Easing;
}

export type AnimatableProperty = "x" | "y" | "scale" | "rotation" | "opacity" | "volume";

/**
 * One effect in a clip's stack. `kind` resolves through the effect registry
 * (built-ins: see EFFECT_CATALOG); `params` are validated against
 * the kind's schema at command time. Length-denoting params are normalized
 * to composition units — absolute pixels would render differently between a
 * scaled preview and a full-resolution export.
 */
export interface EffectInstance {
  id: string;
  kind: string;
  enabled: boolean;
  params: Record<string, unknown>;
  /**
   * Limit the effect to part of the clip (absent = the whole clip): blur or
   * pixelate a password field, or darken everything BUT a button (`invert`).
   */
  region?: EffectRegion;
}

export type EffectRegionProperty = "x" | "y" | "width" | "height";

/**
 * Where an effect applies, as fractions of the clip's own frame (0..1 from
 * its top-left), so the region stays on the same content when the clip is
 * moved, zoomed or rotated. Each coordinate can be keyframed.
 */
export interface EffectRegion {
  /** Left edge, 0..1 of the clip's width. */
  x: number;
  /** Top edge, 0..1 of the clip's height. */
  y: number;
  width: number;
  height: number;
  /** Default "rect". */
  shape?: "rect" | "ellipse";
  /** Soft edge width as a fraction of the region's shorter side (default 0). */
  feather?: number;
  /** Apply the effect everywhere EXCEPT the region (spotlight). */
  invert?: boolean;
  /** Keyframes per coordinate, clip-relative like clip keyframes. */
  animations?: Partial<Record<EffectRegionProperty, Keyframe[]>>;
}

export type ClipKind = "video" | "audio" | "image" | "text" | "caption" | "html";

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

/** Linear fades at a sound-making clip's edges (absent = none). Clamped to the clip's length when rendered. */
export interface AudioFades {
  fadeInUs?: Us;
  fadeOutUs?: Us;
}

/**
 * The part of a picture that shows, as fractions of the source (0..1, from its top-left):
 * `{ x: 0.25, y: 0, width: 0.5, height: 1 }` is the middle half across, full height.
 * Absent means the whole picture. The clip is then the cropped picture: its size, bounds and
 * fit are those of the cropped part.
 */
export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoClip extends ClipBase, AudioFades {
  kind: "video";
  assetId: string;
  /** The part of the picture that shows (absent: all of it). */
  crop?: Crop;
  /** Source trim: offset into the asset where playback starts. */
  trimStartUs: Us;
  volume: number;
  /**
   * Playback speed (absent = 1): 2 plays twice as fast, 0.5 half speed, and
   * 0 is a freeze frame showing the source frame at `trimStartUs` (silent).
   * Map times with `toSourceUs` / `toTimelineUs`.
   */
  speed?: number;
}

export interface AudioClip extends ClipBase, AudioFades {
  kind: "audio";
  assetId: string;
  trimStartUs: Us;
  volume: number;
  /** Playback speed (absent = 1). Audio clips can't freeze (no 0). Pitch follows speed. */
  speed?: number;
}

export interface ImageClip extends ClipBase {
  kind: "image";
  assetId: string;
  /** The part of the picture that shows (absent: all of it). */
  crop?: Crop;
}

/**
 * Optional outline and drop shadow / glow, shared by text clips and caption styles.
 * Absent fields draw nothing, and documents only carry what was set.
 */
export interface TextDecoration {
  /** Outline color; width is `strokeWidthFrac` × font size (default 0.08 when a color is set). */
  strokeColor?: string;
  strokeWidthFrac?: number;
  /** Drop shadow / glow color. Blur and downward offset are fractions of font size (defaults 0.15 / 0.06). An offset of 0 is a glow. */
  shadowColor?: string;
  shadowBlurFrac?: number;
  shadowOffsetFrac?: number;
}

export interface TextClip extends ClipBase, Typography, TextDecoration {
  kind: "text";
  text: string;
  fontFamily: string;
  fontSizePx: number;
  color: string;
  /** Alignment of lines within the text block (default "left"). Independent of the clip's anchor/transform. */
  textAlign?: TextAlign;
}

/** A template parameter value — plain data, so html clips serialize and cross process boundaries. */
export type HtmlParamValue = string | number | boolean;

/**
 * HTML rendered into the composition: the template (with `{{param}}`
 * placeholders) is rasterized via SVG foreignObject at `widthPx`×`heightPx`
 * (default: the composition size) and composited like any other clip —
 * keyframes, effects, and transitions all apply to the raster.
 */
export interface HtmlClip extends ClipBase {
  kind: "html";
  /** HTML markup; `{{name}}` placeholders substitute from `params`. */
  template: string;
  params: Record<string, HtmlParamValue>;
  /** Raster size in composition pixels (default: the composition size). */
  widthPx?: number;
  heightPx?: number;
  /**
   * Re-rasterize every frame at the clip's local time, so CSS animations
   * inside the template play (and seek, and export) frame-exactly. The
   * renderer pauses every animation and sets its delay to
   * `calc(var(--d, 0s) - var(--t))`, with `--t` = seconds into the clip and
   * `--T` = the clip's animation length on the root element: write
   * `@keyframes` + `animation` as usual and stagger with `style="--d:.4s"`.
   * Static (false/absent) clips raster once per param change.
   */
  animated?: boolean;
  /**
   * The template's motion comes from its own scripts (GSAP, Lottie, anime.js,
   * the Web Animations API, …). Renderers run it in a sandboxed frame, seek it
   * to each frame's time and snapshot the result — frame-exact, never played.
   * Implies `animated`.
   */
  scripted?: boolean;
  /**
   * Animated clips: animation time at the clip's start (default 0). A split
   * advances the right half's offset so the animation continues across the
   * cut instead of restarting.
   */
  animationOffsetUs?: number;
}

/** One word of a caption, timed relative to the clip's start. */
export interface CaptionWord {
  text: string;
  startUs: Us;
  durationUs: Us;
}

/** Caption lines are always centered, so captions take no `textAlign`. */
export interface CaptionStyle extends Typography, TextDecoration {
  /**
   * How words react to timing: `plain` (static), `highlight` (active word in
   * highlightColor), `karaoke` (every started word lit), `pop` (active word
   * enlarged + lit), `reveal` (words appear as they are spoken).
   */
  preset: "plain" | "highlight" | "karaoke" | "pop" | "reveal";
  fontFamily: string;
  /** Font size as a fraction of composition height (resolution-independent). */
  fontSizeFrac: number;
  color: string;
  highlightColor: string;
  /** Optional box behind the caption block. */
  backgroundColor?: string;
  /** `word` shows only the active word (word-by-word captions); default `block` (the whole clip). */
  display?: "block" | "word";
  /** Case transform applied when drawing (the words keep their original text). */
  textTransform?: "uppercase" | "lowercase";
  /** Rounded box behind each emphasized word (highlight / karaoke / pop). */
  activeBackgroundColor?: string;
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

export type BuiltinClip = VideoClip | AudioClip | ImageClip | TextClip | CaptionClip | HtmlClip;
export type Clip = BuiltinClip | CustomClip;

// `CustomClip.kind: string` swallows literal narrowing (`clip.kind ===
// "video"` no longer proves VideoClip), so consumers use these guards.
export const isVideoClip = (clip: Clip): clip is VideoClip =>
  clip.kind === "video" && "assetId" in clip;
export const isAudioClip = (clip: Clip): clip is AudioClip =>
  clip.kind === "audio" && "assetId" in clip;
export const isImageClip = (clip: Clip): clip is ImageClip =>
  clip.kind === "image" && "assetId" in clip;
/**
 * What an absent typography field means. Renderers and editor UIs read these
 * rather than hard-coding them; the schema deliberately has no `.default()`s
 * for these fields, so parsed documents never gain keys nobody set.
 */
export const TYPOGRAPHY_DEFAULTS = {
  fontWeight: 400,
  fontStyle: "normal",
  letterSpacing: 0,
  textAlign: "left",
  /** Caption line height multiple (text clips default to the font's natural line height). */
  captionLineHeight: 1.3,
} as const satisfies {
  fontWeight: FontWeight;
  fontStyle: FontStyle;
  letterSpacing: number;
  textAlign: TextAlign;
  captionLineHeight: number;
};

export const isTextClip = (clip: Clip): clip is TextClip =>
  clip.kind === "text" && "text" in clip;
export const isCaptionClip = (clip: Clip): clip is CaptionClip =>
  clip.kind === "caption" && "words" in clip;
export const isHtmlClip = (clip: Clip): clip is HtmlClip =>
  clip.kind === "html";

/** Which clip kinds a track kind accepts (custom kinds declare theirs at registration). */
export const TRACK_ACCEPTS: Record<TrackKind, readonly ClipKind[]> = {
  video: ["video", "image", "text", "caption", "html"],
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
  /** Registry-resolved kind (built-ins: crossDissolve, dipToBlack, dipToWhite, wipe, slide, zoomThrough). */
  kind: string;
  durationUs: Us;
  /** Reserved: only "centered" in v4. */
  alignment: "centered";
  params: Record<string, unknown>;
}

/**
 * A plugin the document needs: code that registers custom clip, effect or
 * transition kinds. Loaders fetch `url`, check `integrity` (an SRI hash like
 * "sha384-…") when given, and import it — so the document renders the same
 * in every runtime that loads its plugins.
 */
export interface PluginRef {
  /** Unique within the document, e.g. "@acme/charts". */
  name: string;
  version: string;
  /** Where the plugin's standalone ES module lives (https:, or a path the runtime resolves). */
  url: string;
  /** Subresource-integrity hash of the module source, e.g. "sha384-…". */
  integrity?: string;
}

/**
 * A named point (or span) on the timeline: a chapter, a tutorial step, a
 * guide section, a review note. Markers don't render; players, planners and
 * exporters read them. `data` is free-form JSON for whoever placed it.
 */
export interface Marker {
  id: string;
  /** Timeline position. */
  timeUs: Us;
  label: string;
  /** Optional span length (a chapter or step that lasts a while). */
  durationUs?: Us;
  /** Free-form JSON payload (e.g. `{ kind: "step", selector: "#save" }`). */
  data?: Record<string, unknown>;
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
  /** Timeline markers keyed by id (absent until the first marker is added). */
  markers?: Record<string, Marker>;
  /** Plugins that define the custom kinds this document uses (absent when none). */
  plugins?: PluginRef[];
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
