import { createProject, type Command, type Project } from "@miraiclip/core";

/**
 * A working copy of a project that records every command that sticks.
 *
 * The assistant edits the copy while the model thinks (async, many steps);
 * the real project only changes when the turn commits, by replaying the
 * recorded commands in one transaction — one undo step, and nothing half-done
 * if the request fails. Commands inside a transaction that rolls back are
 * dropped, exactly as the copy drops their effects.
 *
 * Replay must produce the same ids the model saw, so commands whose ids are
 * optional get explicit ones before they run.
 */
export interface RecordingProject extends Project {
  /** Commands that changed the copy, in order. */
  readonly recorded: readonly Command[];
}

export interface ForkOptions {
  /** Build the copy (default: `createProject(doc)`). Register custom commands here. */
  createFork?: (doc: ReturnType<Project["toJSON"]>) => Project;
  /** Give commands explicit ids (default handles the built-ins with optional ids). */
  ensureIds?: (command: Command) => Command;
}

let seq = 0;
const genId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Built-in commands that would otherwise get a random id inside the engine. */
export function withExplicitIds(command: Command): Command {
  const p = (command.payload ?? {}) as Record<string, unknown>;
  const set = (field: string, prefix: string) =>
    p[field] === undefined ? { ...command, payload: { ...p, [field]: genId(prefix) } } : command;
  switch (command.type) {
    case "clip/split":
    case "clip/duplicate":
      return set("newClipId", "clip");
    case "effect/add":
      return set("effectId", "fx");
    case "transition/add":
      return set("id", "tr");
    default:
      return command;
  }
}

export function forkProject(project: Project, options: ForkOptions = {}): RecordingProject {
  const fork = (options.createFork ?? ((doc) => createProject(doc)))(project.toJSON());
  const state = project.getState();
  fork.setPlayhead(state.playheadUs);
  fork.setSelection([...state.selection]);
  const ensure = options.ensureIds ?? withExplicitIds;
  const recorded: Command[] = [];
  let depth = 0;
  let buffer: Command[] = [];

  return {
    ...fork,
    get recorded() {
      return recorded;
    },
    dispatch(command) {
      const explicit = ensure(command as Command);
      const before = fork.getState().doc;
      fork.dispatch(explicit);
      if (fork.getState().doc === before) return; // no-op: nothing to replay
      if (depth > 0) buffer.push(explicit);
      else recorded.push(explicit);
    },
    transaction(fn, label) {
      if (depth > 0) {
        fn();
        return;
      }
      depth = 1;
      buffer = [];
      try {
        fork.transaction(fn, label);
        recorded.push(...buffer);
      } finally {
        depth = 0;
        buffer = [];
      }
    },
  };
}

export type CommitResult = { ok: true; applied: number } | { ok: false; error: string };

/** Replay a fork's commands onto the real project as one undoable step. */
export function commitFork(project: Project, fork: RecordingProject, label?: string): CommitResult {
  if (fork.recorded.length === 0) return { ok: true, applied: 0 };
  try {
    project.transaction(() => {
      for (const command of fork.recorded) project.dispatch(command);
    }, label);
    return { ok: true, applied: fork.recorded.length };
  } catch (err) {
    return {
      ok: false,
      error: `The project changed while the assistant was working, so its edit no longer applies (${(err as Error)?.message ?? err}). Ask again.`,
    };
  }
}
