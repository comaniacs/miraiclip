/**
 * Miraiclip document → HTML composition: the inverse of the importer, for
 * handing a project to tools that read data-attribute HTML. Media clips
 * become <video>/<audio>/<img> elements, html clips their substituted
 * markup, text clips styled divs. Track order becomes `data-track-index`
 * (0 = bottom) and CSS z-index. What has no equivalent (keyframes, effects,
 * transitions, captions) is listed in `warnings`.
 */
export interface ExportOptions {
  /** `data-composition-id` of the root (default: the project name, else "main"). */
  compositionId?: string;
  /** Map an asset to the URL the page should load (default: its `src`). */
  assetUrl?: (asset: { id: string; src: string; kind: string }) => string;
}

export interface ExportResult {
  html: string;
  warnings: string[];
}

interface DocLike {
  settings: { width: number; height: number; fps: number; name?: string };
  assets: Record<string, { id: string; kind: string; src: string }>;
  trackOrder: string[];
  tracks: Record<string, { id: string; kind: string; hidden?: boolean }>;
  clips: Record<string, Record<string, unknown> & { id: string; kind: string; trackId: string; startUs: number; durationUs: number }>;
  transitions?: Record<string, unknown>;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sec = (us: number) => String(Number((us / 1e6).toFixed(6)));

function substitute(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (whole, key: string) => (params[key] === undefined ? whole : esc(String(params[key]))));
}

/** CSS for a clip's static transform (x/y are the centre as fractions of the frame). */
function transformCss(t: { x?: number; y?: number; scale?: number; rotation?: number; opacity?: number } | undefined, w: number, h: number): string {
  if (!t) return "";
  const parts: string[] = [];
  const dx = ((t.x ?? 0.5) - 0.5) * w;
  const dy = ((t.y ?? 0.5) - 0.5) * h;
  if (dx || dy) parts.push(`translate(${Number(dx.toFixed(2))}px,${Number(dy.toFixed(2))}px)`);
  if ((t.rotation ?? 0) !== 0) parts.push(`rotate(${t.rotation}deg)`);
  if ((t.scale ?? 1) !== 1) parts.push(`scale(${t.scale})`);
  return `${parts.length ? `transform:${parts.join(" ")};` : ""}${(t.opacity ?? 1) !== 1 ? `opacity:${t.opacity};` : ""}`;
}

export function exportHtmlComposition(doc: DocLike, options: ExportOptions = {}): ExportResult {
  const warnings: string[] = [];
  const { width, height } = doc.settings;
  const id = options.compositionId ?? (doc.settings.name ? doc.settings.name.replace(/[^\w-]+/g, "-") : "main");
  const assetUrl = options.assetUrl ?? ((a) => a.src);
  let durationUs = 0;
  for (const clip of Object.values(doc.clips)) durationUs = Math.max(durationUs, clip.startUs + clip.durationUs);
  if (doc.transitions && Object.keys(doc.transitions).length) warnings.push("transitions aren't exported (hard cuts instead)");

  const lines: string[] = [];
  const visualTracks = doc.trackOrder.filter((t) => doc.tracks[t]?.kind === "video");
  const audioTracks = doc.trackOrder.filter((t) => doc.tracks[t]?.kind === "audio");
  const trackIndex = new Map<string, number>([...visualTracks, ...audioTracks].map((t, i) => [t, i] as const));
  for (const trackId of [...visualTracks, ...audioTracks]) {
    const index = trackIndex.get(trackId)!;
    if (doc.tracks[trackId]?.hidden) {
      warnings.push(`track "${trackId}" is hidden; its clips are left out`);
      continue;
    }
    const clips = Object.values(doc.clips).filter((c) => c.trackId === trackId).sort((a, b) => a.startUs - b.startUs);
    for (const clip of clips) {
      const timing = `id="${esc(clip.id)}" class="clip" data-start="${sec(clip.startUs)}" data-duration="${sec(clip.durationUs)}" data-track-index="${index}"`;
      const t = clip["transform"] as Parameters<typeof transformCss>[0];
      const box = `position:absolute;left:0;top:0;width:${width}px;height:${height}px;z-index:${index};`;
      if (clip["animations"]) warnings.push(`"${clip.id}": keyframes aren't exported`);
      if (clip["effects"]) warnings.push(`"${clip.id}": effects aren't exported`);
      if ((clip["speed"] as number | undefined) !== undefined) warnings.push(`"${clip.id}": playback speed isn't exported`);
      const asset = typeof clip["assetId"] === "string" ? doc.assets[clip["assetId"]] : undefined;
      const trim = typeof clip["trimStartUs"] === "number" && clip["trimStartUs"] > 0 ? ` data-media-start="${sec(clip["trimStartUs"])}"` : "";
      const volume = typeof clip["volume"] === "number" ? clip["volume"] : 1;
      switch (clip.kind) {
        case "video":
          if (!asset) continue;
          lines.push(`  <video ${timing}${trim} src="${esc(assetUrl(asset))}" muted playsinline style="${box}object-fit:contain;${transformCss(t, width, height)}"></video>`);
          if (volume > 0) {
            lines.push(`  <audio id="${esc(clip.id)}-audio" data-start="${sec(clip.startUs)}" data-duration="${sec(clip.durationUs)}" data-track-index="${trackIndex.size + index}"${trim} data-volume="${volume}" src="${esc(assetUrl(asset))}"></audio>`);
          }
          break;
        case "audio":
          if (!asset) continue;
          lines.push(`  <audio ${timing}${trim} data-volume="${volume}" src="${esc(assetUrl(asset))}"></audio>`);
          break;
        case "image":
          if (!asset) continue;
          lines.push(`  <img ${timing} src="${esc(assetUrl(asset))}" style="${box}object-fit:contain;${transformCss(t, width, height)}"/>`);
          break;
        case "html": {
          let markup = substitute(String(clip["template"] ?? ""), (clip["params"] as Record<string, unknown>) ?? {});
          markup = markup.replace(/asset:([\w.-]+)/g, (whole, assetId: string) => (doc.assets[assetId] ? esc(assetUrl(doc.assets[assetId]!)) : whole));
          const w = typeof clip["widthPx"] === "number" ? clip["widthPx"] : width;
          const h = typeof clip["heightPx"] === "number" ? clip["heightPx"] : height;
          const left = ((t?.x ?? 0.5) * width - w / 2).toFixed(2);
          const top = ((t?.y ?? 0.5) * height - h / 2).toFixed(2);
          const extra = `${(t?.rotation ?? 0) !== 0 || (t?.scale ?? 1) !== 1 ? `transform:${(t?.rotation ?? 0) !== 0 ? `rotate(${t!.rotation}deg) ` : ""}${(t?.scale ?? 1) !== 1 ? `scale(${t!.scale})` : ""};` : ""}${(t?.opacity ?? 1) !== 1 ? `opacity:${t!.opacity};` : ""}`;
          lines.push(`  <div ${timing} style="position:absolute;left:${Number(left)}px;top:${Number(top)}px;width:${w}px;height:${h}px;overflow:hidden;z-index:${index};${extra}">${markup}</div>`);
          break;
        }
        case "text": {
          const style = [
            `font-family:${esc(String(clip["fontFamily"] ?? "sans-serif"))}`,
            `font-size:${clip["fontSizePx"] ?? 48}px`,
            `color:${esc(String(clip["color"] ?? "#fff"))}`,
            clip["fontWeight"] !== undefined ? `font-weight:${clip["fontWeight"]}` : "",
            clip["textAlign"] !== undefined ? `text-align:${clip["textAlign"]}` : "",
          ].filter(Boolean).join(";");
          const x = ((t?.x ?? 0.5) * 100).toFixed(3);
          const y = ((t?.y ?? 0.5) * 100).toFixed(3);
          const text = esc(String(clip["text"] ?? "")).replace(/\n/g, "<br/>");
          lines.push(`  <div ${timing} style="position:absolute;left:${Number(x)}%;top:${Number(y)}%;transform:translate(-50%,-50%)${(t?.scale ?? 1) !== 1 ? ` scale(${t!.scale})` : ""};white-space:pre;z-index:${index};${style}">${text}</div>`);
          break;
        }
        default:
          warnings.push(`"${clip.id}": ${clip.kind} clips have no HTML equivalent and were left out`);
      }
    }
  }
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0">
<div id="${esc(id)}" data-composition-id="${esc(id)}" data-start="0" data-duration="${sec(durationUs)}" data-width="${width}" data-height="${height}" data-fps="${doc.settings.fps}" style="position:relative;width:${width}px;height:${height}px;overflow:hidden;background:#000">
${lines.join("\n")}
</div>
</body>
</html>
`;
  return { html, warnings };
}
