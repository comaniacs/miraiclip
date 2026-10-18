/**
 * Blocks → commands. A pure planner: give it a block, where it goes and the
 * values to fill in, and it returns core commands to dispatch (or hand to an
 * agent's `apply_commands`). Nothing here touches a project.
 */
import type { Block, BlockField } from "./types.js";

export interface Command {
  type: string;
  payload: Record<string, unknown>;
}

export type FieldValues = Record<string, string | number | boolean>;

export interface BlockCommandOptions {
  /** Clip id for html blocks (default: the block name). */
  id?: string;
  /** Track to place the clip on. */
  trackId: string;
  /** Create the track first (a video track on top). Default false. */
  createTrack?: boolean;
  startUs: number;
  /** Override the block's default length. */
  durationUs?: number;
  /** Field values; missing ones use the block's defaults. */
  values?: FieldValues;
  /** The composition the block lands in (scales sized blocks from the 1080p reference). */
  composition: { width: number; height: number };
  /** Placement overrides (x/y as fractions of the frame, scale multiplies the fitted scale). */
  transform?: Partial<{ x: number; y: number; scale: number; rotation: number; opacity: number }>;
}

/** The block's field values with defaults filled in, validated against field types. */
export function resolveFieldValues(block: Pick<Block, "name" | "fields">, values: FieldValues = {}): FieldValues {
  const known = new Map<string, BlockField>(block.fields.map((f) => [f.key, f]));
  for (const key of Object.keys(values)) {
    if (!known.has(key)) {
      throw new Error(`block "${block.name}" has no field "${key}" (fields: ${[...known.keys()].join(", ") || "none"})`);
    }
  }
  const out: FieldValues = {};
  for (const field of block.fields) {
    const raw = values[field.key] ?? field.default;
    out[field.key] = coerce(block.name, field, raw);
  }
  return out;
}

function coerce(blockName: string, field: BlockField, raw: string | number | boolean): string | number | boolean {
  switch (field.type) {
    case "number": {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n)) throw new Error(`block "${blockName}": field "${field.key}" needs a number, got ${JSON.stringify(raw)}`);
      return n;
    }
    case "boolean":
      if (typeof raw === "boolean") return raw;
      if (raw === "true" || raw === "1" || raw === "yes") return true;
      if (raw === "false" || raw === "0" || raw === "no") return false;
      throw new Error(`block "${blockName}": field "${field.key}" needs true or false, got ${JSON.stringify(raw)}`);
    case "color": {
      const v = String(raw);
      if (!/^#[0-9a-fA-F]{3,8}$|^(rgb|hsl)a?\(.*\)$|^[a-z]+$/.test(v)) {
        throw new Error(`block "${blockName}": field "${field.key}" needs a CSS colour, got ${JSON.stringify(raw)}`);
      }
      return v;
    }
    default:
      return String(raw);
  }
}

/** How much a sized block scales in a composition (1 at 1080p, either orientation). */
export function referenceScale(composition: { width: number; height: number }): number {
  return Math.min(composition.width, composition.height) / 1080;
}

/**
 * Commands that place an html block as a clip. Caption-style blocks don't
 * place anything: use `captionStyleCommands` to apply them to caption clips.
 */
export function blockCommands(block: Block, options: BlockCommandOptions): Command[] {
  if (block.content.kind !== "html") {
    throw new Error(`block "${block.name}" is a ${block.content.kind} block: apply it to caption clips with captionStyleCommands`);
  }
  const content = block.content;
  const params = resolveFieldValues(block, options.values);
  const commands: Command[] = [];
  if (options.createTrack) commands.push({ type: "track/add", payload: { id: options.trackId, kind: "video" } });
  const sized = content.widthPx !== undefined || content.heightPx !== undefined;
  const fit = sized ? referenceScale(options.composition) : 1;
  const transform = { ...(content.transform ?? {}), ...(options.transform ?? {}) };
  const scale = (transform.scale ?? 1) * fit;
  const payload: Record<string, unknown> = {
    kind: "html",
    id: options.id ?? block.name,
    trackId: options.trackId,
    startUs: Math.round(options.startUs),
    durationUs: Math.round(options.durationUs ?? content.durationUs),
    template: content.template,
    params,
  };
  if (content.widthPx !== undefined) payload["widthPx"] = content.widthPx;
  if (content.heightPx !== undefined) payload["heightPx"] = content.heightPx;
  if (content.animated) payload["animated"] = true;
  // A sized block's default spot is designed for 16:9: keep it inside the
  // frame (with a 4% margin) in other shapes. Explicit positions are kept.
  if (sized) {
    const margin = 0.04;
    for (const [axis, sizePx, compPx] of [
      ["x", content.widthPx, options.composition.width],
      ["y", content.heightPx, options.composition.height],
    ] as const) {
      if (sizePx === undefined || transform[axis] === undefined || options.transform?.[axis] !== undefined) continue;
      const half = (sizePx * scale) / 2 / compPx;
      if (half * 2 > 1 - 2 * margin) {
        transform[axis] = 0.5;
        continue;
      }
      transform[axis] = Math.min(Math.max(transform[axis]!, margin + half), 1 - margin - half);
    }
  }
  const t: Record<string, number> = {};
  for (const key of ["x", "y", "rotation", "opacity"] as const) if (transform[key] !== undefined) t[key] = Number(transform[key]!.toFixed(6));
  if (scale !== 1) t["scale"] = Number(scale.toFixed(6));
  if (Object.keys(t).length) payload["transform"] = t;
  commands.push({ type: "clip/add", payload });
  return commands;
}

/** Commands that apply a caption-style block to caption clips (style merges onto each). */
export function captionStyleCommands(block: Block, clipIds: readonly string[]): Command[] {
  if (block.content.kind !== "caption-style") {
    throw new Error(`block "${block.name}" is not a caption style`);
  }
  const style = block.content.style;
  return clipIds.map((clipId) => ({ type: "clip/set-property", payload: { clipId, style: { ...style } } }));
}
