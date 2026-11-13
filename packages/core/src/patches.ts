import type { Patch as ImmerPatch } from "immer";

/** RFC-6902 JSON Patch operation (the subset Immer produces). */
export interface JsonPatchOp {
  op: "add" | "replace" | "remove";
  /** RFC-6901 JSON Pointer, e.g. "/doc/clips/clip-1/startUs". */
  path: string;
  value?: unknown;
}

function escapeSegment(segment: string | number): string {
  return String(segment).replace(/~/g, "~0").replace(/\//g, "~1");
}

export function toJsonPointer(path: readonly (string | number)[]): string {
  return "/" + path.map(escapeSegment).join("/");
}

/** Convert Immer patches to RFC-6902 JSON Patch operations. */
export function toJsonPatches(patches: readonly ImmerPatch[]): JsonPatchOp[] {
  return patches.map((p) => {
    const op: JsonPatchOp = { op: p.op, path: toJsonPointer(p.path) };
    if (p.op !== "remove") op.value = p.value;
    return op;
  });
}

function unescapeSegment(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

export function fromJsonPointer(pointer: string): string[] {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) {
    throw new Error(`Invalid JSON Pointer: "${pointer}"`);
  }
  return pointer.slice(1).split("/").map(unescapeSegment);
}

/**
 * Apply RFC-6902 add/replace/remove operations (the subset this engine emits)
 * to a plain JSON document, returning a new document. The input is not
 * mutated. Use this to replay a peer's `patches` events onto a local copy of
 * the document for sync/collaboration.
 */
export function applyJsonPatches<T>(doc: T, ops: readonly JsonPatchOp[]): T {
  const result = JSON.parse(JSON.stringify(doc)) as T;
  for (const op of ops) {
    const path = fromJsonPointer(op.path);
    if (path.length === 0) {
      throw new Error("Refusing to replace the document root");
    }
    let parent: unknown = result;
    for (let i = 0; i < path.length - 1; i++) {
      parent = (parent as Record<string, unknown>)[path[i] as string];
      if (parent === undefined || parent === null) {
        throw new Error(`Path not found: "${op.path}"`);
      }
    }
    const key = path[path.length - 1] as string;
    if (Array.isArray(parent)) {
      if (key === "length" && op.op === "replace") {
        // Immer emits length replacement when an array shrinks.
        parent.length = op.value as number;
        continue;
      }
      const index = key === "-" ? parent.length : Number(key);
      if (Number.isNaN(index)) throw new Error(`Bad array index in "${op.path}"`);
      if (op.op === "add") parent.splice(index, 0, op.value);
      else if (op.op === "replace") parent[index] = op.value;
      else parent.splice(index, 1);
    } else {
      const target = parent as Record<string, unknown>;
      if (op.op === "remove") delete target[key];
      else target[key] = op.value;
    }
  }
  return result;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sameJson = (a: unknown, b: unknown): boolean => a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * What changed between two documents, as patches coarse enough to be cheap and
 * fine enough for listeners that work per entity: one operation per changed
 * entry of each top-level map (`/clips/{id}`, `/assets/{id}`, `/tracks/{id}`,
 * `/transitions/{id}`, …) and one per changed top-level value (`/settings`,
 * `/trackOrder`). Returns the forward patches and their inverse.
 */
export function diffDocuments(
  from: object,
  to: object,
): { patches: JsonPatchOp[]; inverse: JsonPatchOp[] } {
  const patches: JsonPatchOp[] = [];
  const inverse: JsonPatchOp[] = [];
  const change = (path: (string | number)[], before: unknown, after: unknown): void => {
    const pointer = toJsonPointer(path);
    if (after === undefined) {
      patches.push({ op: "remove", path: pointer });
      inverse.unshift({ op: "add", path: pointer, value: before });
    } else if (before === undefined) {
      patches.push({ op: "add", path: pointer, value: after });
      inverse.unshift({ op: "remove", path: pointer });
    } else {
      patches.push({ op: "replace", path: pointer, value: after });
      inverse.unshift({ op: "replace", path: pointer, value: before });
    }
  };
  const a = from as Record<string, unknown>;
  const b = to as Record<string, unknown>;
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const before = a[key];
    const after = b[key];
    if (before === after) continue;
    // Settings is one value to listeners (a size change re-lays everything out).
    if (key !== "settings" && isRecord(before) && isRecord(after)) {
      for (const id of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (!sameJson(before[id], after[id])) change([key, id], before[id], after[id]);
      }
    } else if (!sameJson(before, after)) change([key], before, after);
  }
  return { patches, inverse };
}
