/**
 * Data-row parsing for batches: JSON arrays, NDJSON, and CSV. Pure text →
 * rows (no filesystem), so it is unit-testable and usable from any host; the
 * CLI wraps it with file reading.
 */
import type { Template, TemplateData, TemplateValue } from "./types.js";

/** Minimal CSV: comma-separated, double-quote quoting ("" escapes a quote), CRLF-tolerant. */
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  const header = rows.shift();
  if (!header) return [];
  return rows
    .filter((cells) => cells.some((value) => value !== ""))
    .map((cells) => Object.fromEntries(header.map((name, i) => [name.trim(), cells[i] ?? ""])));
}

/**
 * CSV rows against a template: cells are strings, so values coerce to each
 * field's declared type (numbers, booleans); an empty cell means "not
 * provided" and the field's default applies.
 */
export function rowsFromCsv(template: Template, text: string): TemplateData[] {
  const types = new Map(template.fields.map((field) => [field.name, field.type]));
  return parseCsv(text).map((raw) => {
    const data: TemplateData = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value === "") continue;
      const type = types.get(key);
      let coerced: TemplateValue = value;
      if (type === "number") coerced = Number(value);
      else if (type === "boolean") coerced = value === "true" || value === "1";
      data[key] = coerced;
    }
    return data;
  });
}

/** One JSON object per non-empty line. */
export function rowsFromNdjson(text: string): TemplateData[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as TemplateData);
}
