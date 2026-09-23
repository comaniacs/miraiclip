/**
 * @miraiclip/templates — parameterized videos: a template project + a data
 * payload → a hydrated document → export. All data, no code: templates are
 * JSON, hydration is pure, and the field schema drives validation, UI forms,
 * and LLM tools alike. Batch rendering lives at `@miraiclip/templates/render`
 * (Node-only — it drives @miraiclip/server-export).
 */
export { defineTemplate, parseTemplate } from "./define.js";
export { hydrate, tryHydrate, validateData } from "./hydrate.js";
export { extractFields, scanPlaceholders, type PlaceholderSite } from "./scan.js";
export { rowsFromCsv, rowsFromNdjson } from "./data.js";
export { describeTemplate, toFieldToolDefinition, type ToFieldToolDefinitionOptions } from "./ai.js";
export {
  TemplateValidationError,
  type AssetField,
  type AssetValue,
  type BooleanField,
  type ColorField,
  type HydrateResult,
  type NumberField,
  type Template,
  type TemplateData,
  type TemplateField,
  type TemplateIssue,
  type TemplateValue,
  type TextField,
} from "./types.js";
