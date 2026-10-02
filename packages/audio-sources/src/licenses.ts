import type { AssetLicense } from "@miraiclip/core";

/**
 * Creative Commons → `AssetLicense`. Accepts the forms providers use:
 * codes ("by-nc", "cc0", "pdm"), names ("Attribution Noncommercial",
 * "Creative Commons 0") and deed URLs
 * ("https://creativecommons.org/licenses/by-sa/4.0/").
 *
 * - `commercial`: false for any NC variant.
 * - `attributionRequired`: false for CC0 and the Public Domain Mark.
 * Returns null for anything unrecognized — callers treat that as unlicensed.
 */
export function parseCreativeCommons(input: string | null | undefined, version?: string | null): AssetLicense | null {
  if (!input) return null;
  const raw = input.trim();
  const lower = raw.toLowerCase();

  let code: string | null = null;
  let ver = version ?? undefined;
  let url: string | undefined;

  const deed = /creativecommons\.org\/(licenses|publicdomain)\/([a-z-]+)\/(\d(?:\.\d)?)/.exec(lower);
  if (deed) {
    code = deed[1] === "publicdomain" ? (deed[2] === "zero" ? "cc0" : deed[2] === "mark" ? "pdm" : null) : deed[2]!;
    ver = deed[3];
    url = raw.replace(/^http:/, "https:");
  } else if (/^(cc0|creative commons 0|cc-?zero|public domain dedication)/.test(lower)) {
    code = "cc0";
  } else if (/^(pdm|public domain mark|public domain)$/.test(lower)) {
    code = "pdm";
  } else if (/^(cc[- ])?by(-(nc|sa|nd))*$/.test(lower)) {
    code = lower.replace(/^cc[- ]/, "");
  } else if (/^attribution/.test(lower)) {
    // Freesound/older names: "Attribution", "Attribution Noncommercial", "Attribution NonCommercial ShareAlike"
    code = ["by", lower.includes("noncommercial") || lower.includes("non-commercial") ? "nc" : null, lower.includes("sharealike") ? "sa" : null, lower.includes("noderiv") ? "nd" : null]
      .filter(Boolean)
      .join("-");
  }
  if (!code) return null;
  if (code !== "cc0" && code !== "pdm" && !/^by(-(nc|sa|nd))*$/.test(code)) return null;

  if (code === "cc0") {
    return { id: "CC0-1.0", url: url ?? "https://creativecommons.org/publicdomain/zero/1.0/", commercial: true, attributionRequired: false };
  }
  if (code === "pdm") {
    return { id: "PDM-1.0", url: url ?? "https://creativecommons.org/publicdomain/mark/1.0/", commercial: true, attributionRequired: false };
  }
  const v = ver ?? "4.0";
  return {
    id: `CC-${code.toUpperCase()}-${v}`,
    url: url ?? `https://creativecommons.org/licenses/${code}/${v}/`,
    commercial: !code.includes("nc"),
    attributionRequired: true,
  };
}

/** A conventional credit line: “Title” by Creator (License). */
export function creditLine(title: string, creator: string | undefined, license: AssetLicense | null, landingUrl?: string): string {
  const parts = [`“${title}”`];
  if (creator) parts.push(`by ${creator}`);
  let line = parts.join(" ");
  // "CC-BY-NC-4.0" → "CC BY-NC 4.0", "CC0-1.0" → "CC0 1.0"
  if (license) line += `, ${license.id.replace(/^CC-/, "CC ").replace(/-(\d)/, " $1")}`;
  if (landingUrl) line += ` — ${landingUrl}`;
  return line;
}
