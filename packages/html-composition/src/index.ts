export { importHtmlComposition } from "./import.js";
export type { ImportOptions, ImportResult, ImportedDocument } from "./import.js";
export { exportHtmlComposition } from "./export.js";
export type { ExportOptions, ExportResult } from "./export.js";
export {
  HTML_ID_ATTR,
  HtmlEditError,
  cleanHtml,
  defaultAllowUrl,
  describeHtml,
  editHtml,
  formatHtmlOutline,
  parseInlineStyle,
  planHtmlEdit,
  stampHtmlIds,
} from "./edit.js";
export type {
  CleanOptions,
  CleanResult,
  DescribeOptions,
  HtmlEditCommand,
  HtmlEditDocument,
  HtmlEditErrorCode,
  HtmlEditOp,
  HtmlEditOptions,
  HtmlEditResult,
  HtmlElementInfo,
  HtmlPosition,
} from "./edit.js";
export { hexColor, htmlFonts, htmlPalette, htmlTexts, recolorHtml, refontHtml, setHtmlTexts } from "./content.js";
export type { HtmlColor, HtmlFont, HtmlText } from "./content.js";
export { mergeHtml } from "./merge.js";
export type { MergeResult } from "./merge.js";
