import {
  applyPatches,
  enablePatches,
  produceWithPatches,
  type Patch as ImmerPatch,
} from "immer";
import type { z } from "zod";
import { createStore, type StoreApi } from "zustand/vanilla";
import { subscribeWithSelector } from "zustand/middleware";
import { builtinHandlers, type CommandHandler } from "./commands/handlers.js";
import {
  builtinPayloadSchemas,
  commandCatalog,
  type BuiltinCommand,
  type Command,
} from "./commands/schemas.js";
import { CommandValidationError, UnknownCommandError } from "./errors.js";
import { Emitter } from "./events.js";
import { toJsonPatches, type JsonPatchOp } from "./patches.js";
import type { ProjectDocument, ProjectSettings, ProjectState, Us } from "./types.js";

enablePatches();

export type PatchSource = "dispatch" | "undo" | "redo" | "transaction-rollback";

export interface ProjectEvents extends Record<string, unknown> {
  /** Emitted on every document change, as RFC-6902 patches relative to the document root. */
  patches: { patches: JsonPatchOp[]; inverse: JsonPatchOp[]; source: PatchSource };
  history: { kind: "commit" | "undo" | "redo"; label?: string };
  playhead: { positionUs: Us };
  selection: { ids: string[] };
}

interface HistoryEntry {
  label?: string;
  commands: Command[];
  patches: ImmerPatch[];
  inversePatches: ImmerPatch[];
}

export interface CommandDefinition<S extends z.ZodType = z.ZodType> {
  type: string;
  schema: S;
  handler: CommandHandler<z.output<S>>;
}

export interface CreateProjectOptions {
  /** Maximum number of history entries kept (default 500). */
  historyLimit?: number;
}

export interface Project {
  /** Read the current state. Never mutate it — dispatch commands instead. */
  getState: () => ProjectState;
  /** Subscribe to a slice of state. Returns an unsubscribe function. */
  subscribe: <T>(
    selector: (state: ProjectState) => T,
    listener: (value: T, previous: T) => void,
  ) => () => void;
  /** The underlying Zustand store, for framework adapters. */
  store: StoreApi<ProjectState>;

  events: Emitter<ProjectEvents>;

  /** Dispatch a command. Throws typed errors; on error, state is untouched. */
  dispatch: (command: BuiltinCommand | Command) => void;
  /** Run several dispatches as one undoable history entry (atomic: all or nothing). */
  transaction: (fn: () => void, label?: string) => void;
  /** Register a custom command type. */
  registerCommand: <S extends z.ZodType>(definition: CommandDefinition<S>) => void;
  /** JSON Schema per command type — hand this to an LLM as its tool catalog. */
  commandCatalog: () => Record<string, unknown>;

  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;

  /** Ephemeral (not undoable, not serialized). */
  setPlayhead: (positionUs: Us) => void;
  setSelection: (ids: string[]) => void;

  /** Serialize the document. Feed the result back to createProject to restore. */
  toJSON: () => ProjectDocument;
}

const DEFAULT_HISTORY_LIMIT = 500;

function emptyDocument(settings: ProjectSettings): ProjectDocument {
  return {
    schemaVersion: 1,
    settings: { ...settings },
    assets: {},
    tracks: {},
    trackOrder: [],
    clips: {},
  };
}

function isDocument(input: ProjectSettings | ProjectDocument): input is ProjectDocument {
  return "schemaVersion" in input;
}

export function createProject(
  init: ProjectSettings | ProjectDocument,
  options: CreateProjectOptions = {},
): Project {
  const historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT;

  if (isDocument(init) && init.schemaVersion !== 1) {
    throw new Error(
      `Unsupported project schemaVersion ${String(init.schemaVersion)} (expected 1)`,
    );
  }

  const initialDoc: ProjectDocument = isDocument(init)
    ? (JSON.parse(JSON.stringify(init)) as ProjectDocument)
    : emptyDocument(init);

  const store = createStore<ProjectState>()(
    subscribeWithSelector(
      (): ProjectState => ({
        doc: initialDoc,
        playheadUs: 0,
        selection: [],
      }),
    ),
  );

  const events = new Emitter<ProjectEvents>();
  const registry = new Map<string, CommandDefinition>();
  for (const [type, schema] of Object.entries(builtinPayloadSchemas)) {
    registry.set(type, {
      type,
      schema,
      handler: builtinHandlers[type as keyof typeof builtinHandlers] as CommandHandler,
    });
  }
  const customSchemas: Record<string, z.ZodType> = {};

  const undoStack: HistoryEntry[] = [];
  const redoStack: HistoryEntry[] = [];
  let txn: HistoryEntry | null = null;

  function applyCommand(command: Command): void {
    const definition = registry.get(command.type);
    if (!definition) throw new UnknownCommandError(command.type);

    const result = definition.schema.safeParse(command.payload);
    if (!result.success) throw new CommandValidationError(command.type, result.error);

    const doc = store.getState().doc;
    const [nextDoc, patches, inversePatches] = produceWithPatches(doc, (draft) => {
      definition.handler(draft, result.data);
    });
    if (patches.length === 0) return;

    store.setState({ doc: nextDoc });

    if (txn) {
      txn.commands.push(command);
      txn.patches.push(...patches);
      txn.inversePatches.unshift(...inversePatches);
    } else {
      pushHistory({ commands: [command], patches, inversePatches: [...inversePatches] });
      events.emit("history", { kind: "commit" });
    }

    events.emit("patches", {
      patches: toJsonPatches(patches),
      inverse: toJsonPatches(inversePatches),
      source: "dispatch",
    });
  }

  function pushHistory(entry: HistoryEntry): void {
    undoStack.push(entry);
    if (undoStack.length > historyLimit) undoStack.shift();
    redoStack.length = 0;
  }

  return {
    getState: store.getState,
    subscribe: (selector, listener) => store.subscribe(selector, listener),
    store,
    events,

    dispatch(command) {
      applyCommand(command);
    },

    transaction(fn, label) {
      if (txn) {
        // Nested transactions fold into the outer one.
        fn();
        return;
      }
      txn = { commands: [], patches: [], inversePatches: [] };
      if (label !== undefined) txn.label = label;
      try {
        fn();
      } catch (error) {
        // Roll back everything the transaction applied, then rethrow.
        const failed = txn;
        txn = null;
        if (failed.patches.length > 0) {
          const doc = applyPatches(store.getState().doc, failed.inversePatches);
          store.setState({ doc });
          events.emit("patches", {
            patches: toJsonPatches(failed.inversePatches),
            inverse: toJsonPatches(failed.patches),
            source: "transaction-rollback",
          });
        }
        throw error;
      }
      const finished = txn;
      txn = null;
      if (finished.patches.length === 0) return;
      pushHistory(finished);
      const historyEvent: ProjectEvents["history"] = { kind: "commit" };
      if (finished.label !== undefined) historyEvent.label = finished.label;
      events.emit("history", historyEvent);
    },

    registerCommand(definition) {
      if (registry.has(definition.type)) {
        throw new Error(`Command type "${definition.type}" is already registered`);
      }
      registry.set(definition.type, definition as CommandDefinition);
      customSchemas[definition.type] = definition.schema;
    },

    commandCatalog: () => commandCatalog(customSchemas),

    undo() {
      const entry = undoStack.pop();
      if (!entry) return false;
      const doc = applyPatches(store.getState().doc, entry.inversePatches);
      store.setState({ doc });
      redoStack.push(entry);
      events.emit("patches", {
        patches: toJsonPatches(entry.inversePatches),
        inverse: toJsonPatches(entry.patches),
        source: "undo",
      });
      const historyEvent: ProjectEvents["history"] = { kind: "undo" };
      if (entry.label !== undefined) historyEvent.label = entry.label;
      events.emit("history", historyEvent);
      return true;
    },

    redo() {
      const entry = redoStack.pop();
      if (!entry) return false;
      const doc = applyPatches(store.getState().doc, entry.patches);
      store.setState({ doc });
      undoStack.push(entry);
      events.emit("patches", {
        patches: toJsonPatches(entry.patches),
        inverse: toJsonPatches(entry.inversePatches),
        source: "redo",
      });
      const historyEvent: ProjectEvents["history"] = { kind: "redo" };
      if (entry.label !== undefined) historyEvent.label = entry.label;
      events.emit("history", historyEvent);
      return true;
    },

    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    clearHistory() {
      undoStack.length = 0;
      redoStack.length = 0;
    },

    setPlayhead(positionUs) {
      store.setState({ playheadUs: positionUs });
      events.emit("playhead", { positionUs });
    },
    setSelection(ids) {
      store.setState({ selection: [...ids] });
      events.emit("selection", { ids: [...ids] });
    },

    toJSON: () => JSON.parse(JSON.stringify(store.getState().doc)) as ProjectDocument,
  };
}
