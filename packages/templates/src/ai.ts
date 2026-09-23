/**
 * The AI surface: a template's fields as an LLM tool, and a compact template
 * summary for prompts — same philosophy as core's `toToolDefinitions` and
 * `describeProject`. An agent designs the template once (via commands/MCP);
 * from then on FILLING it is a plain tool call with a typed schema, and no
 * LLM sits in the render loop.
 */
import type { Template, TemplateField } from "./types.js";

export interface ToFieldToolDefinitionOptions {
  /**
   * Wire shape: "anthropic" (default) → `{ name, description, input_schema }`;
   * "openai" → `{ type: "function", function: { name, description, parameters } }`.
   */
  style?: "anthropic" | "openai";
  /** Tool name (default: "render_" + the template name, sanitized). */
  name?: string;
}

function fieldSchema(field: TemplateField): Record<string, unknown> {
  const description = field.description !== undefined ? { description: field.description } : {};
  switch (field.type) {
    case "text":
      return {
        type: "string",
        ...description,
        ...(field.maxLength !== undefined ? { maxLength: field.maxLength } : {}),
        ...(field.pattern !== undefined ? { pattern: field.pattern } : {}),
        ...(field.enum !== undefined ? { enum: field.enum } : {}),
        ...(field.default !== undefined ? { default: field.default } : {}),
      };
    case "number":
      return {
        type: field.integer ? "integer" : "number",
        ...description,
        ...(field.min !== undefined ? { minimum: field.min } : {}),
        ...(field.max !== undefined ? { maximum: field.max } : {}),
        ...(field.default !== undefined ? { default: field.default } : {}),
      };
    case "boolean":
      return {
        type: "boolean",
        ...description,
        ...(field.default !== undefined ? { default: field.default } : {}),
      };
    case "color":
      return {
        type: "string",
        description: [field.description, "A CSS color (e.g. \"#ff8c32\")."]
          .filter(Boolean)
          .join(" "),
        ...(field.default !== undefined ? { default: field.default } : {}),
      };
    case "asset":
      return {
        description: [
          field.description,
          `Replaces asset "${field.assetId}": a source URL/path, or { src, durationUs? }.`,
        ]
          .filter(Boolean)
          .join(" "),
        anyOf: [
          { type: "string", minLength: 1 },
          {
            type: "object",
            properties: {
              src: { type: "string", minLength: 1 },
              durationUs: { type: "integer", minimum: 1 },
            },
            required: ["src"],
            additionalProperties: false,
          },
        ],
      };
  }
}

/**
 * The template's fields as one ready-to-send tool definition — the payload an
 * agent produces is exactly what `hydrate` takes.
 */
export function toFieldToolDefinition(
  template: Template,
  options: ToFieldToolDefinitionOptions = {},
): unknown {
  const style = options.style ?? "anthropic";
  const name =
    options.name ?? `render_${template.name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  const description =
    (template.description ? `${template.description} ` : "") +
    `Fill the "${template.name}" video template's fields; the values hydrate the template into a renderable document.`;

  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const field of template.fields) {
    properties[field.name] = fieldSchema(field);
    if (field.required !== false && field.default === undefined) required.push(field.name);
  }
  const schema = {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };

  return style === "openai"
    ? { type: "function", function: { name, description, parameters: schema } }
    : { name, description, input_schema: schema };
}

/** A compact, deterministic template summary for prompts. */
export function describeTemplate(template: Template): string {
  const { settings } = template.doc;
  const size = `${(settings as { width?: number }).width}x${(settings as { height?: number }).height}`;
  const fps = (settings as { fps?: number }).fps;
  const lines = [
    `template "${template.name}" — ${size} @ ${fps}fps, ${Object.keys(template.doc.clips).length} clips, ${Object.keys(template.doc.tracks).length} tracks`,
  ];
  if (template.description) lines.push(template.description);
  lines.push("fields:");
  for (const field of template.fields) {
    const flags: string[] = [field.type];
    if (field.type === "asset") flags.push(`asset ${field.assetId}`);
    if (field.required === false || field.default !== undefined) flags.push("optional");
    if (field.default !== undefined) flags.push(`default ${JSON.stringify(field.default)}`);
    lines.push(
      `- ${field.name} (${flags.join(", ")})${field.description ? `: ${field.description}` : ""}`,
    );
  }
  return lines.join("\n");
}
