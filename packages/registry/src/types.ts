/**
 * The block format: one ready-made piece of a video (a lower third, a callout,
 * an intro card, a caption style) described as plain JSON, so blocks can live
 * in this package, in a static registry on any web host, or in your own repo.
 */
import { z } from "zod";

export const BLOCK_CATEGORIES = [
  "lower-third",
  "callout",
  "title",
  "intro",
  "outro",
  "cursor",
  "progress",
  "background",
  "caption-style",
  "scene",
  "overlay",
] as const;

export type BlockCategory = (typeof BLOCK_CATEGORIES)[number];

/** A value the user fills in. Html blocks substitute it into `{{key}}` placeholders. */
export const blockFieldSchema = z.object({
  key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
  label: z.string().min(1),
  type: z.enum(["text", "number", "color", "boolean"]),
  default: z.union([z.string(), z.number(), z.boolean()]),
  description: z.string().optional(),
});
export type BlockField = z.infer<typeof blockFieldSchema>;

const transformSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    scale: z.number().positive(),
    rotation: z.number(),
    opacity: z.number().min(0).max(1),
  })
  .partial();

/** An html clip: the template, its raster size, timing and placement. */
export const htmlContentSchema = z.object({
  kind: z.literal("html"),
  template: z.string().min(1),
  /**
   * Raster size at the 1080p reference (1920×1080 or 1080×1920). Omit both for
   * a full-frame block that fills any composition (size it with vmin units).
   */
  widthPx: z.number().int().positive().optional(),
  heightPx: z.number().int().positive().optional(),
  /** CSS @keyframes play frame-exactly (see html clips). */
  animated: z.boolean().optional(),
  /** Default on-screen time. */
  durationUs: z.number().int().positive(),
  /** Default placement (x/y are the clip centre as fractions of the frame). */
  transform: transformSchema.optional(),
});
export type HtmlBlockContent = z.infer<typeof htmlContentSchema>;

/** A caption style to apply to caption clips (merged with `clip/set-property` style). */
export const captionStyleContentSchema = z.object({
  kind: z.literal("caption-style"),
  style: z.record(z.string(), z.union([z.string(), z.number()])),
});
export type CaptionStyleBlockContent = z.infer<typeof captionStyleContentSchema>;

export const blockSchema = z.object({
  /** Unique slug, e.g. "lower-third-classic". */
  name: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(BLOCK_CATEGORIES),
  tags: z.array(z.string()).default([]),
  version: z.string().default("1.0.0"),
  /** Shapes the block is designed for. */
  aspects: z.array(z.enum(["16:9", "9:16", "1:1", "any"])).default(["any"]),
  fields: z.array(blockFieldSchema).default([]),
  content: z.discriminatedUnion("kind", [htmlContentSchema, captionStyleContentSchema]),
  /** Where a preview image or video lives (relative to the registry root, or absolute). */
  preview: z.string().optional(),
});
export type Block = z.output<typeof blockSchema>;
export type BlockInput = z.input<typeof blockSchema>;

/** One line of a registry's index.json. */
export interface RegistryEntry {
  name: string;
  title: string;
  description: string;
  category: BlockCategory;
  tags: string[];
  version: string;
  aspects: string[];
  /** The block's JSON, relative to the registry root. */
  path: string;
  preview?: string;
}

/** A static registry's index.json. */
export interface RegistryIndex {
  /** Registry format version. */
  format: 1;
  name: string;
  blocks: RegistryEntry[];
}

/** Parse and validate a block (throws with the zod issues on bad input). */
export function parseBlock(input: unknown): Block {
  const result = blockSchema.safeParse(input);
  if (!result.success) {
    const name = typeof (input as { name?: unknown })?.name === "string" ? ` "${(input as { name: string }).name}"` : "";
    throw new Error(`invalid block${name}: ${result.error.message}`);
  }
  const block = result.data;
  for (const field of block.fields) {
    const ok =
      (field.type === "number" && typeof field.default === "number") ||
      (field.type === "boolean" && typeof field.default === "boolean") ||
      ((field.type === "text" || field.type === "color") && typeof field.default === "string");
    if (!ok) throw new Error(`block "${block.name}": field "${field.key}" default doesn't match its type ${field.type}`);
  }
  return block;
}
