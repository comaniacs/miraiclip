/**
 * Charts as html clips: a pure planner from typed data to an `html` clip's content (an
 * inline SVG), so a chart renders the same in preview, browser and server export and is
 * edited by changing its data and planning again. The spec travels with the clip
 * (`params.chart`, JSON) so an editor can read it back; colors are params too, so a
 * palette or a brand kit recolors the chart without re-planning.
 */
import { z } from "zod";

export const CHART_TYPES = ["bar", "column", "line", "pie", "donut"] as const;
export type ChartType = (typeof CHART_TYPES)[number];

/** Most data points a chart takes (more stop being readable at clip size). */
export const CHART_MAX_POINTS = 12;
const PALETTE = ["#4f7cff", "#ff7a59", "#2bb673", "#f2b134", "#9b5de5", "#00b8d9", "#e5486a", "#7a8699"];

export const chartSpecSchema = z.object({
  type: z.enum(CHART_TYPES),
  /** One label per value, in order. */
  labels: z.array(z.string().max(40)).min(1).max(CHART_MAX_POINTS),
  values: z.array(z.number().finite()).min(1).max(CHART_MAX_POINTS),
  title: z.string().max(80).optional(),
  /** Series colors (pie and donut: one per slice), cycled; default a built-in palette. */
  colors: z.array(z.string()).max(CHART_MAX_POINTS).optional(),
  /** Labels, values and the title. */
  textColor: z.string().optional(),
  fontFamily: z.string().optional(),
  /** Print each value on its bar, point or slice (default true). */
  showValues: z.boolean().optional(),
  /** Appended to printed values ("%", " k"). */
  unit: z.string().max(8).optional(),
});
export type ChartSpec = z.infer<typeof chartSpecSchema>;

export interface ChartContent {
  kind: "html";
  template: string;
  params: Record<string, string>;
  widthPx: number;
  heightPx: number;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Parse a spec (throws a readable error), labels and values paired up to the shorter list. */
export function parseChartSpec(input: unknown): ChartSpec {
  const r = chartSpecSchema.safeParse(input);
  if (!r.success) {
    throw new Error(`invalid chart: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  const n = Math.min(r.data.labels.length, r.data.values.length);
  return { ...r.data, labels: r.data.labels.slice(0, n), values: r.data.values.slice(0, n) };
}

/** The colors a spec draws with (params `c0`…), the default palette where it gives none. */
export function chartColors(spec: ChartSpec): string[] {
  const own = spec.colors?.length ? spec.colors : PALETTE;
  const n = spec.type === "pie" || spec.type === "donut" ? spec.values.length : 1;
  return Array.from({ length: Math.max(1, n) }, (_, i) => own[i % own.length]!);
}

/**
 * An html clip's content for a chart: an SVG at `widthPx`×`heightPx` (default 1000×700).
 * Colors are `{{c0}}`… and `{{text}}` params; the spec is kept as `params.chart`.
 */
export function chartContent(input: unknown, size: { widthPx?: number; heightPx?: number } = {}): ChartContent {
  const spec = parseChartSpec(input);
  const W = size.widthPx ?? 1000;
  const H = size.heightPx ?? 700;
  const colors = chartColors(spec);
  const font = esc(spec.fontFamily ?? "Inter,system-ui,sans-serif");
  const show = spec.showValues !== false;
  const unit = spec.unit ?? "";
  const label = (v: number) => esc(`${num(v)}${unit}`);
  const titleH = spec.title ? Math.round(H * 0.12) : 0;
  const fs = Math.round(Math.min(W, H) * 0.045);
  const parts: string[] = [];
  if (spec.title) {
    parts.push(`<text x="${W / 2}" y="${r1(titleH * 0.75)}" text-anchor="middle" font-size="${Math.round(fs * 1.4)}" font-weight="700" fill="{{text}}">${esc(spec.title)}</text>`);
  }
  // Room above the plot for a value printed over the tallest column or point.
  const top = titleH + fs * (show && (spec.type === "column" || spec.type === "line") ? 2.2 : 1);
  const n = spec.values.length;
  const max = Math.max(0, ...spec.values);
  const min = Math.min(0, ...spec.values);
  const span = max - min || 1;

  if (spec.type === "column" || spec.type === "line") {
    const left = fs * 1.5;
    const right = W - fs * 1.5;
    const bottom = H - fs * 2.4;
    const ph = bottom - top;
    const y = (v: number) => r1(top + ((max - v) / span) * ph);
    const step = (right - left) / n;
    parts.push(`<line x1="${r1(left)}" y1="${y(0)}" x2="${r1(right)}" y2="${y(0)}" stroke="{{text}}" stroke-opacity="0.35" stroke-width="2"/>`);
    const xs = spec.values.map((_, i) => left + step * (i + 0.5));
    if (spec.type === "column") {
      const bw = step * 0.62;
      spec.values.forEach((v, i) => {
        const y0 = Math.min(y(v), y(0));
        const h = Math.abs(y(v) - y(0));
        parts.push(`<rect x="${r1(xs[i]! - bw / 2)}" y="${r1(y0)}" width="${r1(bw)}" height="${r1(Math.max(h, 1))}" rx="${r1(bw * 0.08)}" fill="{{c0}}"/>`);
        if (show) parts.push(`<text x="${r1(xs[i]!)}" y="${r1(v >= 0 ? y0 - fs * 0.4 : y0 + h + fs)}" text-anchor="middle" font-size="${fs}" fill="{{text}}">${label(v)}</text>`);
      });
    } else {
      const pts = spec.values.map((v, i) => `${r1(xs[i]!)},${y(v)}`).join(" ");
      parts.push(`<polyline points="${pts}" fill="none" stroke="{{c0}}" stroke-width="${r1(fs * 0.22)}" stroke-linejoin="round" stroke-linecap="round"/>`);
      spec.values.forEach((v, i) => {
        parts.push(`<circle cx="${r1(xs[i]!)}" cy="${y(v)}" r="${r1(fs * 0.28)}" fill="{{c0}}"/>`);
        if (show) parts.push(`<text x="${r1(xs[i]!)}" y="${r1(y(v) - fs * 0.6)}" text-anchor="middle" font-size="${fs}" fill="{{text}}">${label(v)}</text>`);
      });
    }
    spec.labels.forEach((l, i) => {
      parts.push(`<text x="${r1(xs[i]!)}" y="${r1(bottom + fs * 1.5)}" text-anchor="middle" font-size="${fs}" fill="{{text}}" fill-opacity="0.8">${esc(l)}</text>`);
    });
  } else if (spec.type === "bar") {
    const labelW = W * 0.26;
    const left = labelW + fs;
    const right = W - fs * 3.5;
    const bottom = H - fs;
    const step = (bottom - top) / n;
    const bh = step * 0.62;
    const x = (v: number) => r1(left + ((v - min) / span) * (right - left));
    spec.values.forEach((v, i) => {
      const cy = top + step * (i + 0.5);
      const x0 = Math.min(x(v), x(0));
      const w = Math.abs(x(v) - x(0));
      parts.push(`<text x="${r1(labelW)}" y="${r1(cy + fs * 0.35)}" text-anchor="end" font-size="${fs}" fill="{{text}}" fill-opacity="0.8">${esc(spec.labels[i]!)}</text>`);
      parts.push(`<rect x="${r1(x0)}" y="${r1(cy - bh / 2)}" width="${r1(Math.max(w, 1))}" height="${r1(bh)}" rx="${r1(bh * 0.12)}" fill="{{c0}}"/>`);
      if (show) parts.push(`<text x="${r1(x0 + w + fs * 0.4)}" y="${r1(cy + fs * 0.35)}" font-size="${fs}" fill="{{text}}">${label(v)}</text>`);
    });
  } else {
    // pie / donut: negative values count as 0
    const vals = spec.values.map((v) => Math.max(0, v));
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    const legendW = W * 0.34;
    const cx = (W - legendW) / 2;
    const cy = top + (H - top) / 2 - fs * 0.5;
    const R = Math.min(W - legendW, H - top) / 2 - fs;
    const inner = spec.type === "donut" ? R * 0.58 : 0;
    let a = -Math.PI / 2;
    const pt = (ang: number, rad: number) => `${r1(cx + rad * Math.cos(ang))},${r1(cy + rad * Math.sin(ang))}`;
    vals.forEach((v, i) => {
      const sweep = (v / total) * Math.PI * 2;
      if (sweep <= 0) return;
      const b = a + Math.min(sweep, Math.PI * 2 - 1e-4);
      const large = sweep > Math.PI ? 1 : 0;
      const d = inner > 0
        ? `M${pt(a, R)} A${r1(R)},${r1(R)} 0 ${large} 1 ${pt(b, R)} L${pt(b, inner)} A${r1(inner)},${r1(inner)} 0 ${large} 0 ${pt(a, inner)} Z`
        : `M${r1(cx)},${r1(cy)} L${pt(a, R)} A${r1(R)},${r1(R)} 0 ${large} 1 ${pt(b, R)} Z`;
      parts.push(`<path d="${d}" fill="{{c${i}}}"/>`);
      if (show && sweep > 0.25) {
        const mid = (a + b) / 2;
        const rr = inner > 0 ? (R + inner) / 2 : R * 0.62;
        parts.push(`<text x="${r1(cx + rr * Math.cos(mid))}" y="${r1(cy + rr * Math.sin(mid) + fs * 0.35)}" text-anchor="middle" font-size="${fs}" font-weight="700" fill="#ffffff">${esc(`${Math.round((v / total) * 100)}%`)}</text>`);
      }
      a += sweep;
    });
    const lx = W - legendW + fs;
    const ly0 = cy - (n * fs * 1.6) / 2;
    spec.labels.forEach((l, i) => {
      const ly = ly0 + i * fs * 1.6;
      parts.push(`<rect x="${r1(lx)}" y="${r1(ly)}" width="${fs}" height="${fs}" rx="${r1(fs * 0.2)}" fill="{{c${i}}}"/>`);
      parts.push(`<text x="${r1(lx + fs * 1.5)}" y="${r1(ly + fs * 0.85)}" font-size="${fs}" fill="{{text}}">${esc(l)}${show ? ` · ${label(spec.values[i]!)}` : ""}</text>`);
    });
  }

  const template = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${font}">${parts.join("")}</svg>`;
  const params: Record<string, string> = { chart: JSON.stringify(spec), text: spec.textColor ?? "#1a1a1a" };
  colors.forEach((c, i) => {
    params[`c${i}`] = c;
  });
  return { kind: "html", template, params, widthPx: W, heightPx: H };
}

/** The spec an html clip made by `chartContent` carries, or null for any other clip. */
export function chartSpecOf(params: Record<string, unknown> | undefined): ChartSpec | null {
  const raw = params?.["chart"];
  if (typeof raw !== "string") return null;
  try {
    return parseChartSpec(JSON.parse(raw));
  } catch {
    return null;
  }
}
