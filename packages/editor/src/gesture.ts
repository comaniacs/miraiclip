import type { Project } from "@miraiclip/core";

export interface Gesture {
  /** Apply the gesture's CURRENT absolute state (e.g. "x = start + delta"). Replaces the previous update in history. */
  update(apply: () => void): void;
  /** Finish: the last update stays as one history entry. */
  end(): void;
}

/**
 * A live, continuous edit (canvas drag, rotate) that lands in history as ONE
 * entry. Each update undoes the gesture's previous entry and commits the new
 * absolute state, so the canvas shows every intermediate frame while undo
 * steps back over the whole gesture at once.
 *
 * Safety: it only ever undoes an entry it committed itself. If anything else
 * commits, undoes or redoes mid-gesture (an AI edit, a keyboard undo), the
 * next update starts a fresh entry instead of undoing someone else's.
 */
export function beginGesture(project: Project, label: string): Gesture {
  let applying = false;
  let committed = false;
  let topIsOurs = false;
  const off = project.events.on("history", (event) => {
    if (applying) {
      if (event.kind === "commit") committed = true;
      return;
    }
    topIsOurs = false; // someone else touched history
  });
  return {
    update(apply) {
      applying = true;
      committed = false;
      try {
        if (topIsOurs) project.undo();
        project.transaction(apply, label);
      } finally {
        applying = false;
      }
      // An update that changed nothing (back at the start value) leaves no entry.
      topIsOurs = committed;
    },
    end() {
      off();
    },
  };
}
