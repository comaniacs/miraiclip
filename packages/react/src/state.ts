import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore, type MutableRefObject } from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector.js";
import type { Clip, ProjectSettings, ProjectState, Track, Transition, Us } from "@miraiclip/core";
import { clipsByTrack, compositionDurationUs, createCommands, transitionsByTrack, type Commands } from "@miraiclip/editor";
import { useProject } from "./project.js";

/**
 * Subscribe to a slice of project state. Re-renders only when the selected
 * value changes (per `isEqual`, default `Object.is`). Every other state hook
 * builds on this one; narrow selectors keep a busy timeline cheap.
 */
export function useProjectState<T>(selector: (state: ProjectState) => T, isEqual?: (a: T, b: T) => boolean): T {
  const project = useProject();
  const subscribe = useCallback((onChange: () => void) => project.store.subscribe(onChange), [project]);
  const getSnapshot = useCallback(() => project.store.getState(), [project]);
  return useSyncExternalStoreWithSelector(subscribe, getSnapshot, getSnapshot, selector, isEqual);
}

/** Shallow equality for arrays and objects of primitives — for list selectors. */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

const EMPTY_CLIPS: Clip[] = [];
const EMPTY_TRANSITIONS: Transition[] = [];

/** Project settings (size, frame rate, name). */
export function useSettings(): ProjectSettings {
  return useProjectState((s) => s.doc.settings);
}

/** Track ids in render order (index 0 = bottom layer). */
export function useTrackOrder(): string[] {
  return useProjectState((s) => s.doc.trackOrder, shallowEqual);
}

/** All tracks, in render order. */
export function useTracks(): Track[] {
  return useProjectState(
    (s) => s.doc.trackOrder.map((id) => s.doc.tracks[id]).filter((t): t is Track => !!t),
    shallowEqual,
  );
}

export function useTrack(trackId: string): Track | undefined {
  return useProjectState((s) => s.doc.tracks[trackId]);
}

/** A track's clips, sorted by start time. */
export function useClips(trackId: string): Clip[] {
  return useProjectState((s) => clipsByTrack(s.doc.clips).get(trackId) ?? EMPTY_CLIPS, shallowEqual);
}

/** How many clips a track has. */
export function useClipCount(trackId: string): number {
  return useProjectState((s) => clipsByTrack(s.doc.clips).get(trackId)?.length ?? 0);
}

/** A track's transitions. */
export function useTransitions(trackId: string): Transition[] {
  return useProjectState((s) => transitionsByTrack(s.doc.transitions).get(trackId) ?? EMPTY_TRANSITIONS, shallowEqual);
}

export function useClip(clipId: string | null | undefined): Clip | undefined {
  return useProjectState((s) => (clipId ? s.doc.clips[clipId] : undefined));
}

/** Selected clip ids. */
export function useSelection(): string[] {
  return useProjectState((s) => s.selection, shallowEqual);
}

/** The selected clip when exactly one is selected. */
export function useSelectedClip(): Clip | undefined {
  return useProjectState((s) => (s.selection.length === 1 ? s.doc.clips[s.selection[0]!] : undefined));
}

/**
 * Playhead position in µs. Re-renders on every played frame (60×/s), so use
 * it only in small components; `usePlayheadRef` reads it without re-rendering.
 */
export function usePlayheadUs(): Us {
  return useProjectState((s) => s.playheadUs);
}

/**
 * The playhead in a ref that updates without re-rendering. Pass `onChange` to
 * write to the DOM directly on each change (e.g. a time label's textContent).
 */
export function usePlayheadRef(onChange?: (us: Us) => void): MutableRefObject<Us> {
  const project = useProject();
  const ref = useRef<Us>(project.getState().playheadUs);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    ref.current = project.getState().playheadUs;
    return project.subscribe(
      (s) => s.playheadUs,
      (us) => {
        ref.current = us;
        onChangeRef.current?.(us);
      },
    );
  }, [project]);
  return ref;
}

/** Composition length: the end of the last clip. Recomputed only on edits. */
export function useDurationUs(): Us {
  return useProjectState((s) => compositionDurationUs(s.doc.clips));
}

export interface UndoRedo {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => boolean;
  redo: () => boolean;
}

/** Undo and redo, with live availability for the buttons. */
export function useUndoRedo(): UndoRedo {
  const project = useProject();
  const snapshot = useSyncExternalStore(
    useCallback(
      (onChange: () => void) => {
        const offStore = project.store.subscribe(onChange);
        const offHistory = project.events.on("history", onChange);
        return () => {
          offStore();
          offHistory();
        };
      },
      [project],
    ),
    () => `${project.canUndo() ? 1 : 0}${project.canRedo() ? 1 : 0}`,
  );
  return useMemo(
    () => ({
      canUndo: snapshot[0] === "1",
      canRedo: snapshot[1] === "1",
      undo: () => project.undo(),
      redo: () => project.redo(),
    }),
    [snapshot, project],
  );
}

/** @deprecated Use `useUndoRedo`. */
export function useHistoryState(): { canUndo: boolean; canRedo: boolean } {
  const { canUndo, canRedo } = useUndoRedo();
  return { canUndo, canRedo };
}

/** Typed command builders bound to the current project. Stable across renders. */
export function useCommands(): Commands {
  const project = useProject();
  return useMemo(() => createCommands(project), [project]);
}
