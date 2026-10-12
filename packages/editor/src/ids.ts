import { nanoid } from "nanoid";

/** A unique id with a readable prefix, e.g. `clip-V1StGXR8_Z`. */
export function newId(prefix = "id"): string {
  return `${prefix}-${nanoid(10)}`;
}
