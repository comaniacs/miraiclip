/**
 * Catch fields a command would silently ignore. Core's schemas strip unknown
 * keys, so `clip/move { at: … }` or `track/set-property { property, value }`
 * validate fine and change nothing — and a model then reports an edit that
 * never happened. Checking payload keys against the command's JSON Schema
 * turns those into errors the model can fix.
 */
type Schema = {
  type?: string;
  properties?: Record<string, Schema>;
  required?: string[];
  anyOf?: Schema[];
  oneOf?: Schema[];
  const?: unknown;
  additionalProperties?: boolean | Schema;
};

/** Object schemas a value may match (unions flattened). */
function branches(schema: Schema): Schema[] {
  const alts = schema.anyOf ?? schema.oneOf;
  return alts ? alts.flatMap(branches) : [schema];
}

/** `path` entries for keys the schema doesn't declare (one level into nested objects). */
function unknownIn(schema: Schema, value: Record<string, unknown>, prefix = ""): string[] {
  const props = schema.properties;
  if (!props || (schema.additionalProperties !== undefined && schema.additionalProperties !== false)) return [];
  const out: string[] = [];
  for (const [key, v] of Object.entries(value)) {
    const sub = props[key];
    if (!sub) out.push(prefix + key);
    else if (!prefix && v && typeof v === "object" && !Array.isArray(v)) {
      const objectBranch = branches(sub).find((b) => b.properties);
      if (objectBranch) out.push(...unknownIn(objectBranch, v as Record<string, unknown>, `${key}.`));
    }
  }
  return out;
}

export interface UnknownFields {
  unknown: string[];
  /** The fields the command does take (for the error message). */
  allowed: string[];
}

/** Unknown payload fields for a command, judged against the best-matching schema branch. */
export function unknownFields(schema: unknown, payload: unknown): UnknownFields | null {
  if (!schema || !payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const value = payload as Record<string, unknown>;
  let candidates = branches(schema as Schema).filter((b) => b.properties);
  if (candidates.length === 0) return null;
  // A discriminated union: prefer the branch whose `kind` constant matches.
  const byKind = candidates.filter((b) => b.properties!.kind?.const !== undefined && b.properties!.kind.const === value.kind);
  if (byKind.length) candidates = byKind;
  let best: UnknownFields | null = null;
  for (const b of candidates) {
    const unknown = unknownIn(b, value);
    if (!best || unknown.length < best.unknown.length) best = { unknown, allowed: Object.keys(b.properties!) };
  }
  return best && best.unknown.length ? best : null;
}
