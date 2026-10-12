import type { Asset, Clip, ProjectDocument, ProjectSettings } from "@miraiclip/core";

/** Output-format presets. The short side stays 1080 so quality is constant. */
export const ASPECT_PRESETS = [
  { id: "9:16", label: "9:16", hint: "Reels, Shorts, TikTok", width: 1080, height: 1920 },
  { id: "16:9", label: "16:9", hint: "YouTube, landscape", width: 1920, height: 1080 },
  { id: "1:1", label: "1:1", hint: "Square post", width: 1080, height: 1080 },
  { id: "4:5", label: "4:5", hint: "Instagram feed", width: 1080, height: 1350 },
  { id: "4:3", label: "4:3", hint: "Classic", width: 1440, height: 1080 },
] as const;

export type AspectPreset = (typeof ASPECT_PRESETS)[number];

export function presetFor(settings: Pick<ProjectSettings, "width" | "height">): AspectPreset | undefined {
  return ASPECT_PRESETS.find((p) => p.width * settings.height === p.height * settings.width);
}

/** Clips whose picture can be framed (fit/fill/scale). */
export function isFramable(clip: Clip | undefined): clip is Clip & { assetId: string } {
  return !!clip && (clip.kind === "video" || clip.kind === "image") && "assetId" in clip;
}

/**
 * The renderer draws video/image clips so that `transform.scale = 1` FITS the
 * composition (contain). FILL (cover) is therefore `max ratio / min ratio`.
 * Needs the asset's pixel size; returns undefined when it isn't known.
 */
export function fillScale(asset: Asset | undefined, settings: Pick<ProjectSettings, "width" | "height">): number | undefined {
  if (!asset?.width || !asset.height) return undefined;
  const rx = settings.width / asset.width;
  const ry = settings.height / asset.height;
  return Math.max(rx, ry) / Math.min(rx, ry);
}

/**
 * For an aspect-ratio change: clips currently framed to FILL stay filled
 * (their fill scale changes with the aspect). Returns [clipId, newScale] pairs.
 */
export function refillForAspect(
  doc: ProjectDocument,
  next: Pick<ProjectSettings, "width" | "height">,
): [string, number][] {
  const out: [string, number][] = [];
  for (const clip of Object.values(doc.clips)) {
    if (!isFramable(clip)) continue;
    const asset = doc.assets[clip.assetId];
    const before = fillScale(asset, doc.settings);
    const after = fillScale(asset, next);
    const scale = clip.transform?.scale ?? 1;
    if (before === undefined || after === undefined || before <= 1.0001) continue;
    if (Math.abs(scale - before) / before < 0.01) out.push([clip.id, after]);
  }
  return out;
}
