import type { Project } from "@miraiclip/core";

export interface Gesture {
  /** Apply the gesture's CURRENT absolute state (e.g. "x = start + delta"). All updates land in the gesture's one history entry. */
  update(apply: () => void): void;
  /** Finish: everything the updates changed becomes ONE history entry (none if nothing changed). */
  end(): void;
  /** Abandon the gesture: revert everything its updates changed and leave no history entry (Esc during a drag). */
  cancel(): void;
}

/**
 * A live, continuous edit (canvas drag, rotate) that lands in history as ONE
 * entry. It rides on core's `project.beginGesture`: every update is applied
 * to the document straight away (the canvas shows each intermediate frame),
 * but nothing is committed to history until `end()`, so undo steps back over
 * the whole gesture at once and listeners see a single "commit".
 *
 * Each update is its own transaction, so an `apply` that throws halfway leaves
 * the document as the previous update left it.
 *
 * If something ends the gesture mid-way (a keyboard undo or redo closes an open
 * core gesture first), the next update opens a fresh one instead of writing
 * outside any gesture, so it still ends as one entry and never reaches back
 * into earlier history.
 */
export function beginGesture(project: Project, label: string): Gesture {
  let handle = project.beginGesture(label);
  return {
    update(apply) {
      if (!project.inGesture()) handle = project.beginGesture(label);
      project.transaction(apply, label);
    },
    end() {
      handle.end();
    },
    cancel() {
      handle.cancel();
    },
  };
}
