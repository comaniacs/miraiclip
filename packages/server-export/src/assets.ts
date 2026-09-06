import path from "node:path";
import type { ProjectDocument } from "@miraiclip/core";

export interface ResolvedAssets {
  /** The document with every local asset's `src` rewritten to `/assets/<id>`. */
  doc: ProjectDocument;
  /** URL path (`/assets/<id>`) → absolute local file path, for the static server. */
  files: Map<string, string>;
}

const isRemote = (src: string): boolean =>
  src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:");

/**
 * Decide where each asset's bytes come from. Pure given `exists`, so the
 * mapping rules are unit-testable: an explicit `assets` entry wins, remote
 * URLs pass through untouched, and anything else is treated as a local path
 * resolved against `assetsDir`. Local assets are rewritten to `/assets/<id>`
 * so the in-page pipeline fetches them from the harness's own origin (media
 * fetches are range requests — the static server must answer them).
 */
export function resolveAssetSources(
  doc: ProjectDocument,
  options: {
    assets?: Record<string, string> | undefined;
    assetsDir?: string | undefined;
    exists: (filePath: string) => boolean;
  },
): ResolvedAssets {
  const files = new Map<string, string>();
  const rewritten = JSON.parse(JSON.stringify(doc)) as ProjectDocument;
  const baseDir = options.assetsDir ?? process.cwd();

  for (const asset of Object.values(rewritten.assets)) {
    const mapped = options.assets?.[asset.id];
    if (mapped === undefined && isRemote(asset.src)) continue;

    const localPath = path.resolve(baseDir, mapped ?? asset.src);
    if (!options.exists(localPath)) {
      throw new Error(
        `asset "${asset.id}": no file at ${localPath}` +
          (mapped === undefined
            ? ` (from src "${asset.src}" — pass assets: { "${asset.id}": "<path>" } or set assetsDir)`
            : ""),
      );
    }
    const urlPath = `/assets/${encodeURIComponent(asset.id)}`;
    files.set(urlPath, localPath);
    asset.src = urlPath;
  }
  return { doc: rewritten, files };
}

/** Content types the media pipeline may fetch; anything else is served as octet-stream. */
export function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".mov": "video/quicktime",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return types[ext] ?? "application/octet-stream";
}
