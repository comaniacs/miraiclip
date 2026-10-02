import { animationPreset, describeAnimation, describeProject, findCuts, keyframeTimeUs, readAnimation, type AnimationRecipe, type Clip, type ProjectDocument } from "@miraiclip/core";

/**
 * The project as the model sees it: core's `describeProject`, plus what a
 * model needs to make RELATIVE edits ("bigger", "louder", "keep the
 * entrance") — track names, every clip's position, size and opacity, text
 * styling, volume, effects and its animation recipe.
 */
export function describeForAssistant(doc: ProjectDocument): string {
  const lines = [
    describeProject(doc),
    "",
    "track names: " +
      doc.trackOrder
        .map((id) => {
          const t = doc.tracks[id] as { name?: string; hidden?: boolean; muted?: boolean; solo?: boolean; locked?: boolean } | undefined;
          const flags = [t?.hidden && "hidden", t?.muted && "muted", t?.solo && "solo", t?.locked && "locked"].filter(Boolean);
          return `${id} = "${t?.name ?? id}"${flags.length ? ` (${flags.join(", ")})` : ""}`;
        })
        .join(", ") +
      " (track flags muted / solo / locked / hidden: track/set-property)",
  ];
  const cuts = findCuts(doc);
  lines.push(
    cuts.length
      ? `cuts (where one clip ends and the next starts on the same track; transitions go here): ${cuts.map((c) => `${n(c.atUs / 1e6)}s ${c.fromClipId}→${c.toClipId}${c.transition ? ` (${c.transition.kind})` : ""}`).join(", ")}`
      : "cuts: none",
  );
  const clips = Object.values(doc.clips).sort((a, b) => a.trackId.localeCompare(b.trackId) || a.startUs - b.startUs);
  if (clips.length) {
    lines.push("clip details (transform x/y: 0.5 = center; scale 1 = full size; times in seconds):");
    for (const clip of clips) lines.push(`- ${clip.id}: ${details(clip)}`);
  }
  return lines.join("\n");
}

const n = (v: number) => Number(v.toFixed(3));

function details(clip: Clip): string {
  const parts: string[] = [`${clip.kind} on ${clip.trackId}`, `${n(clip.startUs / 1e6)}–${n((clip.startUs + clip.durationUs) / 1e6)}s`];
  if (clip.kind !== "audio") {
    const t = clip.transform;
    parts.push(`x ${n(t.x)} y ${n(t.y)} scale ${n(t.scale)}${t.rotation ? ` rotation ${n(t.rotation)}°` : ""} opacity ${n(t.opacity)}`);
  }
  if (clip.kind === "text") {
    const c = clip as Clip & { fontSizePx: number; color: string; fontFamily: string; fontWeight?: number; textAlign?: string };
    parts.push(`font ${c.fontFamily} ${c.fontSizePx}px${c.fontWeight ? ` weight ${c.fontWeight}` : ""} color ${c.color}${c.textAlign ? ` align ${c.textAlign}` : ""}`);
  }
  if (clip.kind === "caption") {
    const c = clip as Clip & { words: { text: string }[]; style: { preset: string; color: string; highlightColor: string; backgroundColor?: string } };
    parts.push(
      `words "${c.words.map((w) => w.text).join(" ").slice(0, 80)}" · style preset ${c.style.preset} color ${c.style.color} highlight ${c.style.highlightColor} box ${c.style.backgroundColor ?? "none"} (style.backgroundColor)`,
    );
  }
  if (clip.kind === "html") {
    const c = clip as Clip & { template: string; params: Record<string, unknown> };
    parts.push(`params ${JSON.stringify(c.params)} (template placeholders: ${htmlPlaceholders(c.template).join(", ") || "none"})`);
  }
  if ("volume" in clip) {
    const c = clip as Clip & { volume: number; fadeInUs?: number; fadeOutUs?: number; trimStartUs: number };
    parts.push(`volume ${n(c.volume)}${c.fadeInUs ? ` fade-in ${n(c.fadeInUs / 1e6)}s` : ""}${c.fadeOutUs ? ` fade-out ${n(c.fadeOutUs / 1e6)}s` : ""}`);
    parts.push(`source from ${n(c.trimStartUs / 1e6)}s`);
  }
  if (clip.effects?.length) parts.push(`effects ${clip.effects.map((e) => `${e.kind}#${e.id}${e.enabled ? "" : " (off)"}`).join(", ")}`);
  const volumeKeys = clip.animations?.volume ?? [];
  if (volumeKeys.length) parts.push(`volume keyframes ${volumeKeys.map((k) => `${n((clip.startUs + keyframeTimeUs(k, clip.durationUs)) / 1e6)}s=${n(k.value)}`).join(", ")}`);
  const visual = Object.entries(clip.animations ?? {}).some(([prop, list]) => prop !== "volume" && list && list.length);
  if (visual) {
    const read = readClipAnimation(clip);
    parts.push(read.custom ? `custom keyframes (not presets): ${describeKeyframes(clip)}` : `animation ${describeAnimation(read.recipe)}`);
  }
  return parts.join(" · ");
}

/** The `{{name}}` placeholders an html clip's template substitutes from its params. */
export function htmlPlaceholders(template: string): string[] {
  return [...new Set([...template.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map((m) => m[1]!))];
}

/**
 * core's `readAnimation`, stricter: a "stale" reading (In / Out plus a loop
 * whose spacing a trim broke) is only trusted when the loop's properties have
 * enough keyframes to be a loop. Two keyframes are someone's own animation,
 * and rewriting them as presets would destroy it.
 */
export function readClipAnimation(clip: Clip): { recipe: AnimationRecipe; custom: boolean } {
  const read = readAnimation(clip);
  if (read.custom) return { recipe: {}, custom: true };
  if (read.stale && read.recipe.loop) {
    const preset = animationPreset(read.recipe.loop.preset);
    const props = Object.keys(preset?.build(clip.transform, 1_000_000, "linear") ?? {}) as (keyof NonNullable<Clip["animations"]>)[];
    const count = props.reduce((sum, prop) => sum + (clip.animations?.[prop]?.length ?? 0), 0);
    if (count < 4) return { recipe: {}, custom: true };
  }
  return { recipe: read.recipe, custom: false };
}

/** Visual keyframes per property, at timeline seconds: "opacity 0.5s 0 → 1s 1; scale …". */
export function describeKeyframes(clip: Clip): string {
  return Object.entries(clip.animations ?? {})
    .filter(([prop, list]) => prop !== "volume" && list?.length)
    .map(([prop, list]) => `${prop} ${list!.map((k) => `${n((clip.startUs + keyframeTimeUs(k, clip.durationUs)) / 1e6)}s ${n(k.value)}`).join(" → ")}`)
    .join("; ");
}
