/**
 * Provenance helpers — pure reads over the document. Importers (stock
 * libraries, generators, recorders) record where an asset came from and its
 * license on `asset/add`; these turn that into credits and a license check.
 */
import type { Asset, ProjectDocument } from "./types.js";

/** Assets referenced by at least one clip (fonts count when a clip names their family). */
export function usedAssets(doc: ProjectDocument): Asset[] {
  const ids = new Set<string>();
  const families = new Set<string>();
  for (const clip of Object.values(doc.clips)) {
    if ("assetId" in clip && typeof clip.assetId === "string") ids.add(clip.assetId);
    if ("fontFamily" in clip && typeof clip.fontFamily === "string") families.add(clip.fontFamily);
    const style = (clip as { style?: { fontFamily?: unknown } }).style;
    if (style && typeof style.fontFamily === "string") families.add(style.fontFamily);
  }
  return Object.values(doc.assets)
    .filter((a) => ids.has(a.id) || (a.kind === "font" && a.family !== undefined && families.has(a.family)))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Credit lines for the assets the project uses whose license asks for
 * attribution (or that carry an attribution anyway), de-duplicated, in a
 * stable order — ready for an end card, a description box, or a sidecar file.
 */
export function creditsFor(doc: ProjectDocument): string[] {
  const lines: string[] = [];
  for (const asset of usedAssets(doc)) {
    const line = asset.attribution ?? (asset.license?.attributionRequired ? fallbackCredit(asset) : undefined);
    if (line && !lines.includes(line)) lines.push(line);
  }
  return lines;
}

function fallbackCredit(asset: Asset): string {
  const title = asset.name ?? asset.id;
  const where = asset.source?.url ? ` — ${asset.source.url}` : "";
  return `${title} (${asset.license!.id})${where}`;
}

export interface LicenseIssue {
  assetId: string;
  kind: "non-commercial" | "unknown-license" | "missing-attribution";
  message: string;
}

/**
 * License check for the assets the project uses. `commercial: true` reports
 * non-commercial assets; assets without license info are reported only when
 * they came from a provider (plain uploads are the user's own business).
 */
export function licenseReport(doc: ProjectDocument, options: { commercial?: boolean } = {}): LicenseIssue[] {
  const issues: LicenseIssue[] = [];
  for (const asset of usedAssets(doc)) {
    const label = asset.name ? `"${asset.name}" (${asset.id})` : asset.id;
    if (!asset.license) {
      if (asset.source && asset.source.provider !== "upload" && asset.source.provider !== "recording") {
        issues.push({ assetId: asset.id, kind: "unknown-license", message: `${label} from ${asset.source.provider} has no license recorded` });
      }
      continue;
    }
    if (options.commercial && !asset.license.commercial) {
      issues.push({ assetId: asset.id, kind: "non-commercial", message: `${label} is licensed ${asset.license.id}, which does not allow commercial use` });
    }
    if (asset.license.attributionRequired && !asset.attribution) {
      issues.push({ assetId: asset.id, kind: "missing-attribution", message: `${label} requires attribution but has no credit line` });
    }
  }
  return issues;
}
