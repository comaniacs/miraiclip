/**
 * Template construction and loading. `defineTemplate` cross-checks coherence
 * at AUTHOR time — every placeholder has a field, every field is used, asset
 * fields point at real assets — so a template that loads is a template that
 * hydrates. `parseTemplate` applies the same checks to untrusted JSON (a
 * `.miraiclip-template.json` file) behind a structural Zod schema.
 */
import { z } from "zod";
import type { ProjectDocument } from "@miraiclip/core";
import { scanPlaceholders } from "./scan.js";
import {
  TemplateValidationError,
  type Template,
  type TemplateField,
  type TemplateIssue,
} from "./types.js";

const FIELD_NAME = /^[\w-]+$/;

const fieldBase = {
  name: z.string().regex(FIELD_NAME, "field names are letters, digits, _ and -"),
  description: z.string().optional(),
  required: z.boolean().optional(),
};

const assetValueSchema = z.union([
  z.string().min(1),
  z.object({ src: z.string().min(1), durationUs: z.number().int().positive().optional() }),
]);

const fieldSchema = z.discriminatedUnion("type", [
  z.object({
    ...fieldBase,
    type: z.literal("text"),
    default: z.string().optional(),
    maxLength: z.number().int().positive().optional(),
    pattern: z.string().optional(),
    enum: z.array(z.string()).min(1).optional(),
  }),
  z.object({
    ...fieldBase,
    type: z.literal("number"),
    default: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    integer: z.boolean().optional(),
  }),
  z.object({ ...fieldBase, type: z.literal("boolean"), default: z.boolean().optional() }),
  z.object({ ...fieldBase, type: z.literal("color"), default: z.string().min(1).optional() }),
  z.object({
    ...fieldBase,
    type: z.literal("asset"),
    assetId: z.string().min(1),
    default: assetValueSchema.optional(),
  }),
]);

/** Structural shape of a template file. The doc itself is validated by core at hydrate/use time. */
const templateSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1),
  description: z.string().optional(),
  doc: z.object({
    schemaVersion: z.literal(1),
    settings: z.record(z.string(), z.unknown()),
    assets: z.record(z.string(), z.unknown()),
    tracks: z.record(z.string(), z.unknown()),
    trackOrder: z.array(z.string()),
    clips: z.record(z.string(), z.unknown()),
    transitions: z.record(z.string(), z.unknown()),
  }),
  fields: z.array(fieldSchema),
});

/** Coherence checks shared by defineTemplate and parseTemplate. */
function coherenceIssues(doc: ProjectDocument, fields: TemplateField[]): TemplateIssue[] {
  const issues: TemplateIssue[] = [];
  const byName = new Map<string, TemplateField>();
  fields.forEach((field, index) => {
    if (byName.has(field.name)) {
      issues.push({ path: `fields.${index}`, message: `duplicate field "${field.name}"` });
    }
    byName.set(field.name, field);
  });

  const sites = scanPlaceholders(doc);
  const placeholderNames = new Set(sites.map((site) => site.name));

  for (const site of sites) {
    const field = byName.get(site.name);
    if (!field) {
      issues.push({
        path: `doc.${site.path}`,
        message: `placeholder {{${site.name}}} has no declared field`,
      });
    } else if (field.type === "asset") {
      issues.push({
        path: `doc.${site.path}`,
        message: `{{${site.name}}} binds an asset field — asset fields replace their asset's src and never appear as placeholders`,
      });
    }
  }

  for (const field of fields) {
    if (field.type === "asset") {
      if (!(field.assetId in doc.assets)) {
        issues.push({
          path: `fields.${field.name}`,
          message: `assetId "${field.assetId}" is not an asset in the document`,
        });
      }
    } else if (!placeholderNames.has(field.name)) {
      issues.push({
        path: `fields.${field.name}`,
        message: `field is never used — no {{${field.name}}} placeholder in the document`,
      });
    }
  }
  return issues;
}

/** Build a template from a document and its declared fields; throws on incoherence. */
export function defineTemplate(input: {
  name: string;
  description?: string;
  doc: ProjectDocument;
  fields: TemplateField[];
}): Template {
  const issues = coherenceIssues(input.doc, input.fields);
  if (issues.length > 0) throw new TemplateValidationError(issues);
  return {
    version: 1,
    name: input.name,
    ...(input.description !== undefined ? { description: input.description } : {}),
    doc: input.doc,
    fields: input.fields,
  };
}

/** Parse and validate untrusted template JSON (a parsed file, an API body). */
export function parseTemplate(json: unknown): Template {
  const parsed = templateSchema.safeParse(json);
  if (!parsed.success) {
    throw new TemplateValidationError(
      parsed.error.issues.map((issue) => ({
        path: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    );
  }
  const template = parsed.data as unknown as Template;
  const issues = coherenceIssues(template.doc, template.fields);
  if (issues.length > 0) throw new TemplateValidationError(issues);
  return template;
}
