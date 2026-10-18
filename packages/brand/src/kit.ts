/**
 * A brand kit: everything that makes a video look like yours, as one JSON
 * object you can store, share between projects and hand to an agent.
 */
import { z } from "zod";

const color = z.string().regex(/^#[0-9a-fA-F]{3,8}$|^(rgb|hsl)a?\(.*\)$/, "a CSS colour (#hex, rgb() or hsl())");

const font = z.object({
  /** CSS family name clips use. */
  family: z.string().min(1),
  /** Font file to load (absent = a system or already-loaded font). */
  src: z.string().min(1).optional(),
  /** This file's weight (default 400), or the variable font's range. */
  weight: z.number().int().min(100).max(900).optional(),
  weightRange: z.tuple([z.number().int(), z.number().int()]).optional(),
});

const corner = z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]);

const bookend = z.object({
  /** A registry block name (default: intro-logo-reveal / outro-cta). */
  block: z.string().min(1).optional(),
  /** Field values for the block (brand name and colours are filled from the kit). */
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  durationUs: z.number().int().positive().optional(),
});

export const brandKitSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().optional(),
  url: z.string().optional(),
  colors: z.object({
    primary: color,
    secondary: color.optional(),
    /** Highlights: active caption words, outlines, badges (default: primary). */
    accent: color.optional(),
    /** Backgrounds of cards and end screens (default "#0a0d18"). */
    background: color.optional(),
    /** Text on the background (default "#ffffff"). */
    text: color.optional(),
  }),
  fonts: z.object({ heading: font.optional(), body: font.optional() }).optional(),
  logo: z
    .object({
      src: z.string().min(1),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      corner: corner.optional(),
      /** Logo width as a fraction of the frame width (default 0.1). */
      widthFrac: z.number().gt(0).max(1).optional(),
      opacity: z.number().min(0).max(1).optional(),
    })
    .optional(),
  /** Caption style overrides (merged onto every caption clip). */
  captions: z.record(z.string(), z.unknown()).optional(),
  intro: bookend.optional(),
  outro: bookend.optional(),
});

export type BrandKit = z.infer<typeof brandKitSchema>;
export type BrandFont = z.infer<typeof font>;

/** Validate a brand kit (throws a readable error). */
export function parseBrandKit(input: unknown): BrandKit {
  const r = brandKitSchema.safeParse(input);
  if (!r.success) throw new Error(`invalid brand kit: ${r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`);
  return r.data;
}
