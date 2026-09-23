import type { ProjectDocument } from "@miraiclip/core";

/**
 * A template field: one declared blank in the document. The declaration is
 * the whole API surface — it drives payload validation, UI form generation,
 * and LLM tool schemas, the same one-source-of-truth pattern as the command
 * catalog.
 */
export type TemplateField =
  | TextField
  | NumberField
  | BooleanField
  | ColorField
  | AssetField;

interface FieldBase {
  /** Placeholder name: `{{name}}` in the document binds to this field. */
  name: string;
  /** What this blank means — surfaces in forms, prompts, and tool schemas. */
  description?: string;
  /** Required fields must appear in every payload (unless a default exists). */
  required?: boolean;
}

export interface TextField extends FieldBase {
  type: "text";
  default?: string;
  maxLength?: number;
  /** A RegExp source the value must match (anchored by the author as needed). */
  pattern?: string;
  /** Restrict the value to one of these. */
  enum?: string[];
}

export interface NumberField extends FieldBase {
  type: "number";
  default?: number;
  min?: number;
  max?: number;
  integer?: boolean;
}

export interface BooleanField extends FieldBase {
  type: "boolean";
  default?: boolean;
}

/** A CSS color string ("#ff8c32", "rgb(...)", "tomato"). */
export interface ColorField extends FieldBase {
  type: "color";
  default?: string;
}

/**
 * A media slot: the payload's value replaces the named asset's `src` (and
 * optionally `durationUs`). Hydration never touches clip timing — swapped
 * video/audio should match the placeholder's duration, or carry `durationUs`.
 */
export interface AssetField extends FieldBase {
  type: "asset";
  /** The asset in the template document this field replaces. */
  assetId: string;
  default?: AssetValue;
}

/** An asset payload value: a source alone, or a source with its duration. */
export type AssetValue = string | { src: string; durationUs?: number };

/** A payload value for any field. */
export type TemplateValue = string | number | boolean | AssetValue;

/** One data row: field name → value. */
export type TemplateData = Record<string, TemplateValue>;

/**
 * A template: an ordinary ProjectDocument plus the declared blanks. Plain
 * JSON end to end — it serializes, crosses process boundaries, and needs no
 * code to run, exactly like the documents it hydrates.
 */
export interface Template {
  version: 1;
  name: string;
  description?: string;
  doc: ProjectDocument;
  fields: TemplateField[];
}

/** One machine-readable problem with a template or a payload. */
export interface TemplateIssue {
  /** Where: "fields.headline", "data.name", "doc.clips.intro". */
  path: string;
  message: string;
}

/** Thrown by `defineTemplate`/`parseTemplate`/`hydrate` on invalid input. */
export class TemplateValidationError extends Error {
  constructor(public readonly issues: TemplateIssue[]) {
    super(
      `template validation failed:\n${issues.map((i) => `  ${i.path}: ${i.message}`).join("\n")}`,
    );
    this.name = "TemplateValidationError";
  }
}

/** `tryHydrate`'s result: a hydrated document, or the issues an agent can self-correct from. */
export type HydrateResult =
  | { ok: true; doc: ProjectDocument }
  | { ok: false; issues: TemplateIssue[] };
