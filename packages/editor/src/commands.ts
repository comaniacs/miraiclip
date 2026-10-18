import type { AnimatableProperty, AssetLicense, AssetSource, CaptionStyle, CaptionWord, Easing, EasingPreset, FontStyle, FontWeight, HtmlParamValue, Project, TextAlign, Transform, Us } from "@miraiclip/core";

/**
 * Typed command builders. UI code dispatches through these helpers instead of
 * hand-writing raw command objects, so the command vocabulary lives in one
 * place. Property edits are `clip/set-property` and `track/set-property`;
 * there is no generic `clip/update`.
 */

export function createCommands(project: Project) {
  const d = project.dispatch;

  return {
    /* ---- project ---- */
    /** Composition size / fps / name. Clip positions are fractions, so they follow a new aspect. */
    setProjectSettings(patch: { width?: number; height?: number; fps?: number; name?: string }) {
      d({ type: "project/set-settings", payload: patch });
    },

    /* ---- assets ---- */
    addAsset(payload: {
      id: string;
      kind: "video" | "audio" | "image" | "font";
      src: string;
      durationUs?: Us;
      width?: number;
      height?: number;
      fps?: number;
      family?: string;
      /** Font assets: this face's weight / style descriptors. */
      weight?: FontWeight;
      style?: FontStyle;
      /** Variable fonts: the weight axis, e.g. [100, 900]. */
      weightRange?: [FontWeight, FontWeight];
      /** Display name, and where the asset came from / under what terms. */
      name?: string;
      source?: AssetSource;
      license?: AssetLicense;
      attribution?: string;
    }) {
      d({ type: "asset/add", payload });
    },
    /** Rename an asset or edit its provenance. `null` clears a field. */
    setAssetProperty(
      id: string,
      patch: { name?: string | null; source?: AssetSource | null; license?: AssetLicense | null; attribution?: string | null },
    ) {
      d({ type: "asset/set-property", payload: { id, ...patch } });
    },

    /* ---- tracks ---- */
    addTrack(payload: { id: string; kind: "video" | "audio"; name?: string; index?: number }) {
      d({ type: "track/add", payload });
    },
    /** Remove a track and every clip on it (one undo step). */
    removeTrack(trackId: string) {
      d({ type: "track/remove", payload: { id: trackId } });
    },
    renameTrack(trackId: string, name: string) {
      d({ type: "track/rename", payload: { trackId, name } });
    },
    reorderTrack(trackId: string, index: number) {
      d({ type: "track/reorder", payload: { trackId, index } });
    },
    setTrackProperty(
      trackId: string,
      /** `hidden`: the track's clips aren't drawn (sound follows `muted`). */
      patch: { muted?: boolean; solo?: boolean; locked?: boolean; hidden?: boolean },
    ) {
      d({ type: "track/set-property", payload: { trackId, ...patch } });
    },

    /* ---- clips ---- */
    addVideoClip(payload: {
      id: string;
      trackId: string;
      assetId: string;
      startUs: Us;
      durationUs: Us;
      trimStartUs?: Us;
      volume?: number;
      fadeInUs?: Us;
      fadeOutUs?: Us;
      /** Playback speed (default 1; 0 = freeze frame). */
      speed?: number;
      transform?: Partial<Transform>;
    }) {
      d({ type: "clip/add", payload: { kind: "video", ...payload } });
    },
    addAudioClip(payload: {
      id: string;
      trackId: string;
      assetId: string;
      startUs: Us;
      durationUs: Us;
      trimStartUs?: Us;
      volume?: number;
      fadeInUs?: Us;
      fadeOutUs?: Us;
      /** Playback speed (default 1). */
      speed?: number;
    }) {
      d({ type: "clip/add", payload: { kind: "audio", ...payload } });
    },
    addImageClip(payload: {
      id: string;
      trackId: string;
      assetId: string;
      startUs: Us;
      durationUs: Us;
      transform?: Partial<Transform>;
    }) {
      d({ type: "clip/add", payload: { kind: "image", ...payload } });
    },
    addTextClip(payload: {
      id: string;
      trackId: string;
      startUs: Us;
      durationUs: Us;
      text: string;
      fontFamily?: string;
      fontSizePx?: number;
      color?: string;
      fontWeight?: FontWeight;
      textAlign?: TextAlign;
      transform?: Partial<Transform>;
    }) {
      d({ type: "clip/add", payload: { kind: "text", ...payload } });
    },
    /** Word-timed caption (subtitles). */
    addCaptionClip(payload: {
      id: string;
      trackId: string;
      startUs: Us;
      durationUs: Us;
      words: CaptionWord[];
      style?: Partial<CaptionStyle>;
      transform?: Partial<Transform>;
    }) {
      d({ type: "clip/add", payload: { kind: "caption", ...payload } });
    },
    /** Designed text (and any other markup): an html template rasterized by the renderer. */
    addHtmlClip(payload: {
      id: string;
      trackId: string;
      startUs: Us;
      durationUs: Us;
      template: string;
      params: Record<string, HtmlParamValue>;
      widthPx?: number;
      heightPx?: number;
      animated?: boolean;
      transform?: Partial<Transform>;
    }) {
      d({ type: "clip/add", payload: { kind: "html", ...payload } });
    },

    moveClip(clipId: string, patch: { startUs?: Us; trackId?: string }) {
      d({ type: "clip/move", payload: { clipId, ...patch } });
    },
    trimClip(clipId: string, patch: { startUs?: Us; durationUs?: Us; trimStartUs?: Us }) {
      d({ type: "clip/trim", payload: { clipId, ...patch } });
    },
    splitClip(clipId: string, atUs: Us, newClipId?: string) {
      d({ type: "clip/split", payload: { clipId, atUs, newClipId } });
    },
    /** Change playback speed; by default the clip keeps its footage and its length changes. */
    setClipSpeed(clipId: string, speed: number, options?: { keepDuration?: boolean; ripple?: boolean }) {
      d({ type: "clip/set-speed", payload: { clipId, speed, ...options } });
    },
    /** Hold the frame at `atUs` for `durationUs` (splits the clip; ripples the track by default). */
    freezeFrame(clipId: string, atUs: Us, durationUs: Us, options?: { freezeClipId?: string; rightClipId?: string; ripple?: boolean }) {
      d({ type: "clip/freeze", payload: { clipId, atUs, durationUs, ...options } });
    },
    /* ---- markers ---- */
    addMarker(payload: { id?: string; timeUs: Us; label: string; durationUs?: Us; data?: Record<string, unknown> }) {
      d({ type: "marker/add", payload });
    },
    updateMarker(
      markerId: string,
      patch: { timeUs?: Us; label?: string; durationUs?: Us | null; data?: Record<string, unknown> | null },
    ) {
      d({ type: "marker/update", payload: { markerId, ...patch } });
    },
    removeMarker(markerId: string) {
      d({ type: "marker/remove", payload: { markerId } });
    },

    duplicateClip(clipId: string, patch?: { newClipId?: string; startUs?: Us; trackId?: string }) {
      d({ type: "clip/duplicate", payload: { clipId, ...patch } });
    },
    removeClip(clipId: string) {
      d({ type: "clip/remove", payload: { clipId } });
    },

    /** Text/appearance/transform/volume edits (verified command name). */
    setClipProperty(
      clipId: string,
      patch: {
        transform?: Partial<Transform>;
        volume?: number;
        /** Video/audio: linear fade lengths. `null` removes the fade. */
        fadeInUs?: Us | null;
        fadeOutUs?: Us | null;
        text?: string;
        fontFamily?: string;
        fontSizePx?: number;
        color?: string;
        /** Typography (text clips). `null` clears back to TYPOGRAPHY_DEFAULTS. */
        fontWeight?: FontWeight | null;
        fontStyle?: FontStyle | null;
        lineHeight?: number | null;
        letterSpacing?: number | null;
        textAlign?: TextAlign | null;
        style?: Record<string, unknown>;
        /** html clips: merged into the template params (re-rasters). */
        params?: Record<string, HtmlParamValue>;
        /** html clips (code editing): replace the markup, drop params, change the raster size, toggle per-frame CSS animation. */
        template?: string;
        unsetParams?: string[];
        widthPx?: number | null;
        heightPx?: number | null;
        animated?: boolean;
        /** Caption clips: replace the words (clip-relative timing). */
        words?: CaptionWord[];
      },
    ) {
      d({ type: "clip/set-property", payload: { clipId, ...patch } });
    },

    /* ---- effects (built-ins: colorAdjust, blur, chromaKey) ---- */
    addEffect(clipId: string, kind: string, params?: Record<string, unknown>, enabled = true) {
      d({ type: "effect/add", payload: { clipId, kind, params, enabled } });
    },
    updateEffect(
      clipId: string,
      effectId: string,
      patch: { params?: Record<string, unknown>; enabled?: boolean },
    ) {
      d({ type: "effect/update", payload: { clipId, effectId, ...patch } });
    },
    removeEffect(clipId: string, effectId: string) {
      d({ type: "effect/remove", payload: { clipId, effectId } });
    },

    /* ---- transitions (built-ins: crossDissolve, dipToBlack, dipToWhite, wipe, slide) ---- */
    /** Across the cut where `fromClipId` ends and `toClipId` starts (same track). Centered on the cut. */
    addTransition(payload: { id?: string; kind: string; fromClipId: string; toClipId: string; durationUs: Us; params?: Record<string, unknown> }) {
      d({ type: "transition/add", payload });
    },
    updateTransition(transitionId: string, patch: { durationUs?: Us; params?: Record<string, unknown> }) {
      d({ type: "transition/update", payload: { transitionId, ...patch } });
    },
    removeTransition(transitionId: string) {
      d({ type: "transition/remove", payload: { transitionId } });
    },

    /* ---- keyframes (clip-relative time) ---- */
    setKeyframe(payload: {
      clipId: string;
      property: AnimatableProperty;
      timeUs: Us;
      value: number;
      easing?: EasingPreset | Easing;
      /** "end" measures timeUs back from the clip's end, so the keyframe follows trims. */
      anchor?: "start" | "end";
    }) {
      d({ type: "keyframe/set", payload });
    },
    /** Omit `property` to clear every animated property. */
    clearKeyframes(clipId: string, property?: AnimatableProperty) {
      d({ type: "keyframe/clear", payload: { clipId, ...(property ? { property } : {}) } });
    },

    /* ---- selection & playhead (ephemeral) ---- */
    select(ids: string[]) {
      project.setSelection(ids);
    },
    setPlayhead(us: Us) {
      project.setPlayhead(Math.max(0, Math.round(us)));
    },

    /** Batch several dispatches into one undoable history entry. */
    transaction(fn: () => void, label?: string) {
      project.transaction(fn, label);
    },
  };
}

export type Commands = ReturnType<typeof createCommands>;
