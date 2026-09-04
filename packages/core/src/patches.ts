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
