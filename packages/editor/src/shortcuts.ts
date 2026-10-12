import type { Project } from "@miraiclip/core";

/** The parts of a keyboard event the shortcut map reads (a DOM KeyboardEvent fits). */
export interface ShortcutKey {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

/** Editing actions with a default key. */
export type EditorAction = "delete" | "split" | "undo" | "redo";

/**
 * The default key map:
 * - Delete / Backspace → delete the selected clips
 * - S → split the selected clips at the playhead
 * - Ctrl/⌘ + Z → undo; Ctrl/⌘ + Shift + Z or Ctrl/⌘ + Y → redo
 *
 * Returns null for any other key. Callers skip events from text fields.
 */
export function matchEditorShortcut(event: ShortcutKey): EditorAction | null {
  const mod = !!(event.ctrlKey || event.metaKey);
  if (event.altKey) return null;
  const key = event.key.toLowerCase();
  if (mod) {
    if (key === "z") return event.shiftKey ? "redo" : "undo";
    if (key === "y") return "redo";
    return null;
  }
  if (event.shiftKey) return null;
  if (key === "delete" || key === "backspace") return "delete";
  if (key === "s") return "split";
  return null;
}

/** Selected clips that exist and sit on unlocked tracks. */
function editableSelection(project: Project): string[] {
  const { doc, selection } = project.getState();
  return selection.filter((id) => {
    const clip = doc.clips[id];
    return !!clip && !doc.tracks[clip.trackId]?.locked;
  });
}

/**
 * Run an editing action against the project. Delete and split act on every
 * selected clip on an unlocked track, as one undo step. Returns whether
 * anything happened (so a key handler knows to `preventDefault`).
 */
export function runEditorAction(project: Project, action: EditorAction): boolean {
  switch (action) {
    case "undo":
      return project.undo();
    case "redo":
      return project.redo();
    case "delete": {
      const ids = editableSelection(project);
      if (ids.length === 0) return false;
      project.transaction(() => {
        for (const clipId of ids) project.dispatch({ type: "clip/remove", payload: { clipId } });
      }, ids.length === 1 ? "delete clip" : "delete clips");
      project.setSelection(project.getState().selection.filter((id) => !ids.includes(id)));
      return true;
    }
    case "split": {
      const { doc, playheadUs } = project.getState();
      const ids = editableSelection(project).filter((id) => {
        const clip = doc.clips[id]!;
        return playheadUs > clip.startUs && playheadUs < clip.startUs + clip.durationUs;
      });
      if (ids.length === 0) return false;
      const atUs = Math.round(playheadUs);
      project.transaction(() => {
        for (const clipId of ids) project.dispatch({ type: "clip/split", payload: { clipId, atUs } });
      }, ids.length === 1 ? "split clip" : "split clips");
      return true;
    }
  }
}
