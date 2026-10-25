/**
 * A brand's identity from its website: name, tagline, colours, fonts, logo
 * and samples of its copy (for the voice), so a video can look and sound like
 * the brand without anyone filling in a brand kit first.
 *
 * Heuristic and fetch-only (no DOM, no browser): it reads the page's HTML and
 * up to a few of its stylesheets. Run it on a server: browsers can't read
 * other sites (CORS). Sites that render everything with JavaScript, or block
 * bots, give less; `warnings` says what was missing.
 */
import { parseBrandKit, type BrandKit } from "./kit.js";

export interface WebsiteColor {
  color: string;
  /** How often it appears in the page's CSS (backgrounds and text count double). */
  count: number;
}

export interface WebsiteImage {
  src: string;
  kind: "logo" | "icon" | "share" | "photo";
  /** The image's alt text: what it shows, as the site describes it. */
  alt?: string;
  width?: number;
  height?: number;
}

export interface WebsiteFont {
  family: string;
  role: "heading" | "body" | "other";
  /** A font file a renderer can load (Google Fonts woff2, CORS-enabled); absent when the font isn't on Google Fonts. */
  src?: string;
  weightRange?: [number, number];
  source: "google-fonts" | "font-face" | "css";
}

export interface WebsiteBrand {
  /** The page that was read (after redirects). */
  url: string;
  name: string;
  tagline?: string;
  description?: string;
  colors: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    /** Brand-ish (saturated) colours, most used first. */
    palette: WebsiteColor[];
  };
  fonts: WebsiteFont[];
  logo?: string;
  /** The site's own images (absolute URLs): logo candidates, share images and the photos and screenshots on the page, largest first. */
  images: WebsiteImage[];
  /** Look cues beyond colour: light or dark site, and the shape of its buttons. */
  style: { theme?: "light" | "dark"; buttonShape?: "pill" | "rounded" | "square"; radiusPx?: number };
  /** The site's own words, for matching its voice. */
  copy: { title?: string; headings: string[]; ctas: string[]; paragraphs: string[] };
  /** A brand kit built from what was found (absent without a primary colour). */
  kit?: BrandKit;
  warnings: string[];
}

export interface BrandFromWebsiteOptions {
  fetch?: typeof fetch;
  signal?: AbortSignal;
  /** Linked stylesheets to read (default 4). */
  maxStylesheets?: number;
  /** Bytes read per response (default 2 MB). */
  maxBytes?: number;
  /** Look up Google Fonts files for the fonts found (default true). */
  resolveFonts?: boolean;
  userAgent?: string;
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export async function brandFromWebsite(input: string, options: BrandFromWebsiteOptions = {}): Promise<WebsiteBrand> {
  const doFetch = options.fetch ?? fetch;
  const maxBytes = options.maxBytes ?? 2_000_000;
  const warnings: string[] = [];
  const get = (url: URL, accept: string) => fetchText(doFetch, url, { accept, ua: options.userAgent ?? UA, maxBytes, ...(options.signal ? { signal: options.signal } : {}) });

  const page = await get(publicUrl(input), "text/html,application/xhtml+xml");
  const base = new URL(page.url);
  const html = page.text;
  const head = html.slice(0, 200_000);

  // ---- CSS: inline <style>, style="" attributes, linked stylesheets
  const cssParts: string[] = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]!);
  const inlineStyles = [...html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map((m) => decode(m[1]!)).join(";");
  const sheetUrls = tags(head, "link")
    .filter((a) => /\bstylesheet\b/i.test(a.rel ?? "") || (/\bpreload\b/i.test(a.rel ?? "") && a.as === "style"))
    .map((a) => absolute(a.href, base))
    .filter((u): u is string => !!u && !/fonts\.googleapis\.com/.test(u));
  const sheets = await Promise.all(
    [...new Set(sheetUrls)].slice(0, options.maxStylesheets ?? 4).map(async (href) => {
      try {
        return (await get(publicUrl(href), "text/css,*/*;q=0.1")).text;
      } catch {
        warnings.push(`couldn't read stylesheet ${href}`);
        return "";
      }
    }),
  );
  const css = [...cssParts, ...sheets].join("\n");
  if (!css.trim()) warnings.push("no CSS found (the page may be rendered by JavaScript): colours and fonts are guesses or missing");

  // ---- meta and copy
  const metas = tags(head, "meta");
  const meta = (key: string) => metas.find((m) => (m.name ?? m.property ?? "").toLowerCase() === key)?.content?.trim();
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");
  const title = text(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1]);
  const headings = unique([...body.matchAll(/<h([12])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => text(m[2]))).filter((t) => t.length >= 3 && t.length <= 140).slice(0, 10);
  const ctas = unique(
    [...body.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi)]
      .filter((m) => /btn|button|cta/i.test(m[2]!) || m[1]!.toLowerCase() === "button")
      .map((m) => text(m[3]))
      .filter((t) => t.length >= 2 && t.split(/\s+/).length <= 5),
  ).slice(0, 8);
  const paragraphs = unique([...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => text(m[1]))).filter((t) => t.length >= 50 && t.length <= 320).slice(0, 6);
  const description = meta("og:description") ?? meta("description") ?? meta("twitter:description");
  const name = brandName(meta("og:site_name") ?? meta("application-name"), meta("og:title") ?? title, base.hostname);
  const tagline = shortLine(headings[0]) ?? shortLine(description);
  if (!headings.length && !paragraphs.length) warnings.push("little readable text in the HTML (the page may be rendered by JavaScript): voice samples are thin");

  // ---- colours
  const counts = new Map<string, number>();
  for (const m of `${css};${inlineStyles}`.matchAll(/(^|[;{\s])(background(?:-color)?|color|border(?:-[a-z]+)?-color|fill|stroke|outline-color|--[\w-]+)\s*:\s*([^;}]+)/gi)) {
    if (/^--tw-/i.test(m[2]!)) continue;
    const weight = /^(background|color)/i.test(m[2]!) ? 2 : 1;
    for (const c of colorsIn(m[3]!)) if (isBrandish(c)) counts.set(c, (counts.get(c) ?? 0) + weight);
  }
  const palette = [...counts].map(([color, count]) => ({ color, count })).sort((a, b) => b.count - a.count).slice(0, 12);
  const vars = cssVars(css);
  const theme = colorsIn(meta("theme-color") ?? "")[0];
  const fromVar = (re: RegExp) => vars.filter((v) => re.test(v.name) && !/(text|fg|foreground|hover|active|light|dark|muted|bg|background|border|[^a-z]\d{2,3}$)/i.test(v.name.replace(re, ""))).map((v) => v.color).find(isBrandish);
  const primary = fromVar(/(^|-)(primary|brand)(-color)?$/i) ?? (theme && isBrandish(theme) ? theme : undefined) ?? palette[0]?.color;
  const accentVar = fromVar(/(^|-)accent(-color)?$/i);
  const secondary = fromVar(/(^|-)secondary(-color)?$/i) ?? palette.map((p) => p.color).find((c) => c !== primary && c !== accentVar && hueDistance(c, primary) >= 30);
  const accent = accentVar ?? palette.map((p) => p.color).find((c) => c !== primary && c !== secondary && hueDistance(c, primary) >= 30 && hueDistance(c, secondary) >= 30);
  const background = ruleColor(css, /(^|[\s,}])(html|body)\s*[,{]/i, /background(-color)?/i) ?? vars.find((v) => /^(background|bg|color-background|bg-color)$/i.test(v.name))?.color;
  const textColor = ruleColor(css, /(^|[\s,}])(body)\s*[,{]/i, /^color$/i) ?? vars.find((v) => /^(foreground|text|text-color|color-text|fg)$/i.test(v.name))?.color;
  if (!primary) warnings.push("no brand colour found");

  // ---- fonts
  const fonts = findFonts(head, css);
  if (options.resolveFonts !== false) {
    await Promise.all(
      fonts.slice(0, 3).map(async (f) => {
        const file = await googleFontFile(doFetch, f.family, options.userAgent ?? UA, options.signal).catch(() => undefined);
        if (file) Object.assign(f, file);
      }),
    );
  }
  if (!fonts.length) warnings.push("no fonts found");

  // ---- logo and images
  const links = tags(head, "link");
  const images: WebsiteImage[] = [];
  const push = (src: string | undefined, kind: WebsiteImage["kind"], extra: Partial<WebsiteImage> = {}) => {
    const abs = absolute(src, base);
    if (abs && !images.some((i) => i.src === abs)) images.push({ src: abs, kind, ...extra });
  };
  const imgTags = tags(body, "img").slice(0, 400);
  const logoSrc = pickLogo(body, name, base.hostname);
  if (logoSrc) push(logoSrc.src, "logo", logoSrc.alt ? { alt: logoSrc.alt } : {});
  for (const l of links) if (/\bicon\b/i.test(l.rel ?? "") && /\.svg(\?|$)/i.test(l.href ?? "")) push(l.href, "icon");
  for (const l of links) if (/apple-touch-icon/i.test(l.rel ?? "")) push(l.href, "icon");
  push(meta("og:image"), "share");
  push(meta("twitter:image"), "share");
  const photos: WebsiteImage[] = [];
  for (const img of imgTags) {
    const src = largestSrc(img);
    const hint = `${img.class ?? ""} ${img.id ?? ""} ${img.alt ?? ""} ${src ?? ""}`;
    // Product shots and photos only: no logos, icons, award badges or rating graphics (they look poor enlarged and cropped).
    if (!src || /logo|icon|sprite|pixel|spacer|tracking|badge|award|top-?\d+|g2|capterra|trustpilot|rating|stars|flag|avatar|emoji|arrow|chevron|1x1|favicon/i.test(hint)) continue;
    if (/\.svg(\?|$)/i.test(src) || /^data:/.test(src)) continue;
    const width = Number(img.width) || undefined;
    const height = Number(img.height) || undefined;
    if ((width && width < 400) || (height && height < 225)) continue;
    const abs = absolute(src, base);
    if (!abs || images.some((i) => i.src === abs) || photos.some((i) => i.src === abs)) continue;
    photos.push({ src: abs, kind: "photo", ...(img.alt?.trim() ? { alt: img.alt.trim().slice(0, 140) } : {}), ...(width ? { width } : {}), ...(height ? { height } : {}) });
  }
  // Known-large first (in page order otherwise): heroes and product shots tend to be both.
  photos.sort((a, b) => (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0));
  images.push(...photos);
  const logo = images.find((i) => i.kind === "logo")?.src ?? images.find((i) => i.kind === "icon")?.src;

  // ---- style cues
  const radii = new Map<string, number>();
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/btn|button|cta/i.test(m[1]!)) continue;
    const r = /border-radius\s*:\s*([^;}]+)/i.exec(m[2]!)?.[1]?.trim();
    if (r && !r.includes("var(")) radii.set(r, (radii.get(r) ?? 0) + 1);
  }
  const radius = [...radii].sort((a, b) => b[1] - a[1])[0]?.[0];
  const radiusPx = radius ? (/(999|50%|100%)/.test(radius) ? 9999 : parseFloat(radius) * (/rem|em/.test(radius) ? 16 : 1)) : undefined;
  const style = {
    ...(background ? { theme: luminance(background) > 0.5 ? ("light" as const) : ("dark" as const) } : {}),
    ...(radiusPx !== undefined && Number.isFinite(radiusPx) ? { buttonShape: radiusPx >= 999 ? ("pill" as const) : radiusPx >= 4 ? ("rounded" as const) : ("square" as const), ...(radiusPx < 999 ? { radiusPx } : {}) } : {}),
  };

  const colors = {
    ...(primary ? { primary } : {}),
    ...(secondary ? { secondary } : {}),
    ...(accent ? { accent } : {}),
    ...(background ? { background } : {}),
    ...(textColor ? { text: textColor } : {}),
    palette,
  };
  const heading = fonts.find((f) => f.role === "heading") ?? fonts[0];
  const bodyFont = fonts.find((f) => f.role === "body" && f !== heading);
  const kitFont = (f: WebsiteFont | undefined) => (f ? { family: f.family, ...(f.src ? { src: f.src } : {}), ...(f.weightRange ? { weightRange: f.weightRange } : {}) } : undefined);
  let kit: BrandKit | undefined;
  if (primary) {
    try {
      kit = parseBrandKit({
        name,
        ...(tagline ? { tagline } : {}),
        url: base.hostname.replace(/^www\./, ""),
        colors: { primary, ...(secondary ? { secondary } : {}), ...(accent ? { accent } : {}), ...(background ? { background } : {}), ...(textColor ? { text: textColor } : {}) },
        ...(heading ? { fonts: { heading: kitFont(heading), ...(bodyFont ? { body: kitFont(bodyFont) } : {}) } } : {}),
      });
    } catch {
      /* leave the kit out; the raw findings are still returned */
    }
  }

  return {
    url: base.href,
    name,
    ...(tagline ? { tagline } : {}),
    ...(description ? { description } : {}),
    colors,
    fonts,
    ...(logo ? { logo } : {}),
    images: images.slice(0, 16),
    style,
    copy: { ...(title ? { title } : {}), headings, ctas, paragraphs },
    ...(kit ? { kit } : {}),
    warnings,
  };
}

/**
 * Parse a user-supplied site address ("acme.com", "https://acme.com/x") and
 * refuse anything that isn't a public web address: other schemes, localhost,
 * .local / .internal names and private or reserved IP addresses. (Names that
 * resolve to private addresses are not detected; run this where that's
 * acceptable, e.g. a Worker, or add a resolver check.)
 */
export function publicUrl(input: string): URL {
  const raw = input.trim();
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    throw new Error(`not a web address: "${input}"`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(`only http(s) addresses: "${input}"`);
  if (url.username || url.password) throw new Error("addresses with credentials aren't allowed");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host.includes(".") && !host.includes(":")) throw new Error(`not a public address: "${host}"`);
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/.test(host)) throw new Error(`not a public address: "${host}"`);
  if (isPrivateIp(host)) throw new Error(`not a public address: "${host}"`);
  return url;
}

function isPrivateIp(host: string): boolean {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
  }
  if (host.includes(":")) {
    const h = host.toLowerCase();
    if (h === "::" || h === "::1") return true;
    if (/^f[cd]/.test(h) || /^fe[89ab]/.test(h)) return true;
    const mapped = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(h);
    if (mapped) return isPrivateIp(mapped[1]!);
    return false;
  }
  return false;
}

async function fetchText(
  doFetch: typeof fetch,
  start: URL,
  o: { accept: string; ua: string; maxBytes: number; signal?: AbortSignal },
): Promise<{ url: string; text: string }> {
  let url = start;
  for (let hop = 0; hop < 6; hop++) {
    const res = await doFetch(url.href, { redirect: "manual", headers: { accept: o.accept, "user-agent": o.ua, "accept-language": "en" }, ...(o.signal ? { signal: o.signal } : {}) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = publicUrl(new URL(res.headers.get("location")!, url).href);
      continue;
    }
    if (!res.ok) throw new Error(`${url.hostname} answered ${res.status}`);
    return { url: url.href, text: await readCapped(res, o.maxBytes) };
  }
  throw new Error("too many redirects");
}

async function readCapped(res: Response, max: number): Promise<string> {
  if (!res.body) return (await res.text()).slice(0, max);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
    if (size >= max) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  const all = new Uint8Array(Math.min(size, max));
  let at = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.min(c.byteLength, all.byteLength - at));
    all.set(part, at);
    at += part.byteLength;
    if (at >= all.byteLength) break;
  }
  return new TextDecoder().decode(all);
}

/** Attributes of every `<name …>` tag. */
function tags(html: string, name: string): Record<string, string>[] {
  return [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "gi"))].map((m) => {
    const attrs: Record<string, string> = {};
    for (const a of m[1]!.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) attrs[a[1]!.toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? "");
    return attrs;
  });
}

function absolute(src: string | undefined, base: URL): string | undefined {
  if (!src || src.startsWith("data:")) return undefined;
  try {
    const u = new URL(src, base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|apos|#39|nbsp|rsquo|lsquo|rdquo|ldquo|mdash|ndash|hellip);/g, (_, n: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…" })[n] ?? "");
}

const text = (html: string | undefined) => (html ? decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() : "");
const unique = (list: string[]) => [...new Set(list.filter(Boolean))];

function shortLine(s: string | undefined): string | undefined {
  if (!s) return undefined;
  const first = s.split(/(?<=[.!?])\s/)[0]!.trim();
  return first.length <= 90 ? first : undefined;
}

function brandName(site: string | undefined, title: string | undefined, hostname: string): string {
  if (site?.trim()) return site.trim();
  const core = hostname.replace(/^www\./, "").split(".")[0]!;
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const parts = (title ?? "").split(/\s[|\-–—:·]\s|\s\|\s?|\|/).map((p) => p.trim()).filter(Boolean);
  const match = parts.find((p) => squash(p) === squash(core)) ?? parts.find((p) => squash(p).includes(squash(core)) && p.length <= 40);
  if (match) return match;
  return core.charAt(0).toUpperCase() + core.slice(1);
}

/**
 * The brand's own logo, not a customer's: sites show rows of other companies'
 * logos ("trusted by…"), and those are named "logo" too. Scores each logo-ish
 * <img>: the brand's name in it, a place in the header or nav, and nothing
 * that looks like a logo wall around it.
 */
function pickLogo(body: string, name: string, hostname: string): { src: string; alt?: string } | undefined {
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const words = [squash(name), squash(hostname.replace(/^www\./, "").split(".")[0]!)].filter((w) => w.length >= 3);
  const header = /<(header|nav)\b[\s\S]*?<\/\1>/i.exec(body);
  const headerEnd = header ? header.index + header[0].length : Math.min(body.length, 4000);
  const imgs = [...body.matchAll(/<img\b([^>]*)>/gi)].slice(0, 400).map((m) => {
    const attrs: Record<string, string> = {};
    for (const a of m[1]!.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) attrs[a[1]!.toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? "");
    return { at: m.index!, attrs, hint: `${attrs.class ?? ""} ${attrs.id ?? ""} ${attrs.alt ?? ""} ${attrs.src ?? attrs["data-src"] ?? ""}` };
  });
  const logos = imgs.filter((i) => /logo/i.test(i.hint) || words.some((w) => squash(i.hint).includes(w)));
  let best: { score: number; src: string; alt?: string } | undefined;
  for (const img of logos) {
    const src = img.attrs.src ?? img.attrs["data-src"];
    if (!src) continue;
    let score = 0;
    const named = words.some((w) => squash(img.hint).includes(w));
    if (named) score += 4;
    if (img.at < headerEnd) score += 3;
    if (/logo/i.test(img.hint)) score += 1;
    // Next to other companies' logos: a customer wall, unless it carries the brand's own name.
    const near = logos.filter((o) => o !== img && Math.abs(o.at - img.at) < 1500).length;
    const before = body.slice(Math.max(0, img.at - 1500), img.at);
    if (!named && (near >= 2 || /trusted|customers|clients|partners|logo-?wall|logos|brands|marquee|featured in|as seen/i.test(before))) score -= 5;
    if (score >= 3 && (!best || score > best.score)) best = { score, src, ...(img.attrs.alt ? { alt: img.attrs.alt } : {}) };
  }
  return best;
}

/** The best URL of an <img>: the widest srcset entry, else src (lazy-loaded variants too). */
function largestSrc(img: Record<string, string>): string | undefined {
  const set = img.srcset ?? img["data-srcset"];
  if (set) {
    const best = set
      .split(/,\s+(?=\S)/)
      .map((part) => {
        const [url, size] = part.trim().split(/\s+/);
        return { url, w: size?.endsWith("w") ? parseFloat(size) : size?.endsWith("x") ? parseFloat(size) * 1000 : 0 };
      })
      .filter((c) => c.url)
      .sort((a, b) => b.w - a.w)[0];
    if (best?.url) return best.url;
  }
  return img["data-src"] ?? img["data-lazy-src"] ?? img.src;
}

function luminance(hex: string): number {
  const c = parseHex(hex)!;
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}

// ---------- colours

interface Rgb {
  r: number;
  g: number;
  b: number;
  a: number;
}

const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
const toHex = (c: Rgb) => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;

function parseHex(h: string): Rgb | undefined {
  let s = h.slice(1);
  if (s.length === 3 || s.length === 4) s = [...s].map((c) => c + c).join("");
  if (s.length !== 6 && s.length !== 8) return undefined;
  const n = (i: number) => parseInt(s.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: s.length === 8 ? n(6) / 255 : 1 };
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255, a: 1 };
}

/** Every opaque colour written in a CSS value, as #rrggbb. */
export function colorsIn(value: string): string[] {
  const out: string[] = [];
  for (const m of value.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\(([^)]*)\)|hsla?\(([^)]*)\)/g)) {
    let c: Rgb | undefined;
    if (m[0].startsWith("#")) c = parseHex(m[0]);
    else {
      const nums = (m[1] ?? m[2]!).split(/[\s,/]+/).filter(Boolean);
      if (nums.length < 3 || nums.some((x, i) => i < 3 && x.includes("var("))) continue;
      const num = (x: string, scale: number) => (x.endsWith("%") ? (parseFloat(x) / 100) * scale : parseFloat(x));
      const alpha = nums[3] !== undefined ? num(nums[3], 1) : 1;
      c = m[1] !== undefined ? { r: num(nums[0]!, 255), g: num(nums[1]!, 255), b: num(nums[2]!, 255), a: alpha } : { ...hslToRgb(parseFloat(nums[0]!), num(nums[1]!, 1), num(nums[2]!, 1)), a: alpha };
    }
    if (c && [c.r, c.g, c.b].every(Number.isFinite) && c.a >= 0.6) out.push(toHex(c));
  }
  return out;
}

function hsl(hex: string): { h: number; s: number; l: number } {
  const c = parseHex(hex)!;
  const [r, g, b] = [c.r / 255, c.g / 255, c.b / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return { h: (h + 360) % 360, s, l };
}

/** Saturated enough and not near black or white: a colour a brand would pick. */
function isBrandish(hex: string | undefined): hex is string {
  if (!hex) return false;
  const { s, l } = hsl(hex);
  return s >= 0.3 && l >= 0.18 && l <= 0.85;
}

function hueDistance(a: string, b: string | undefined): number {
  if (!b) return 360;
  const d = Math.abs(hsl(a).h - hsl(b).h);
  return Math.min(d, 360 - d);
}

/** CSS custom properties whose value is a plain colour (the last definition wins). */
function cssVars(css: string): { name: string; color: string }[] {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/--([\w-]+)\s*:\s*([^;}]+)/g)) {
    const name = m[1]!;
    if (name.startsWith("tw-")) continue;
    const color = colorsIn(m[2]!)[0];
    if (color && m[2]!.trim().split(/\s+/).length <= 4) out.set(name, color);
  }
  return [...out].map(([name, color]) => ({ name, color }));
}

/** The colour a property gets in rules whose selector matches. */
function ruleColor(css: string, selector: RegExp, property: RegExp): string | undefined {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selector.test(` ${m[1]!.trim()} {`)) continue;
    for (const d of m[2]!.split(";")) {
      const [p, ...v] = d.split(":");
      if (p && property.test(p.trim())) {
        const c = colorsIn(v.join(":"))[0];
        if (c) return c;
      }
    }
  }
  return undefined;
}

// ---------- fonts

const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[\w-]+|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica|helvetica neue|arial|inherit|initial|unset|apple color emoji|segoe ui emoji|segoe ui symbol|noto color emoji|emoji|math|times new roman|times|georgia|courier|courier new|verdana|tahoma)$/i;
const ICON_FONT = /icon|awesome|material symbols|glyph|fa-|eicons|dashicons|swiper|slick/i;

function findFonts(head: string, css: string): WebsiteFont[] {
  const fonts: WebsiteFont[] = [];
  const add = (family: string, role: WebsiteFont["role"], source: WebsiteFont["source"]) => {
    const f = family.trim().replace(/^['"]|['"]$/g, "");
    if (!f || GENERIC.test(f) || ICON_FONT.test(f) || f.startsWith("var(")) return;
    const existing = fonts.find((x) => x.family.toLowerCase() === f.toLowerCase());
    if (existing) {
      if (existing.role === "other" && role !== "other") existing.role = role;
      return;
    }
    fonts.push({ family: f, role, source });
  };
  // Google Fonts links name families explicitly.
  for (const m of head.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'\s>]+)/g)) {
    for (const fam of m[1]!.replace(/&amp;/g, "&").split("&").filter((p) => p.startsWith("family="))) {
      for (const one of decodeURIComponent(fam.slice(7)).split("|")) add(one.split(":")[0]!.replace(/\+/g, " "), "other", "google-fonts");
    }
  }
  // Which family headings and body text use, and how often each is used.
  const usage = new Map<string, { count: number; heading: number; body: number }>();
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const fam = /font-family\s*:\s*([^;}]+)/i.exec(m[2]!)?.[1];
    if (!fam) continue;
    const first = fam.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).find((s) => s && !GENERIC.test(s) && !ICON_FONT.test(s) && !s.startsWith("var("));
    if (!first) continue;
    const u = usage.get(first) ?? { count: 0, heading: 0, body: 0 };
    u.count++;
    if (/(^|[\s,>+~])h[1-3]\b|heading|title|display|hero/i.test(m[1]!)) u.heading++;
    if (/(^|[\s,])(html|body|p)\b/i.test(m[1]!)) u.body++;
    usage.set(first, u);
  }
  const faces = new Set([...css.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*['"]?([^;'"}]+)/gi)].map((m) => m[1]!.trim()));
  const ranked = [...usage].sort((a, b) => b[1].heading + b[1].body - (a[1].heading + a[1].body) || b[1].count - a[1].count);
  const headingFam = ranked.filter(([, u]) => u.heading > 0).sort((a, b) => b[1].heading - a[1].heading)[0]?.[0];
  const bodyFam = ranked.filter(([, u]) => u.body > 0).sort((a, b) => b[1].body - a[1].body)[0]?.[0];
  if (headingFam) add(headingFam, "heading", faces.has(headingFam) ? "font-face" : "css");
  if (bodyFam) add(bodyFam, "body", faces.has(bodyFam) ? "font-face" : "css");
  for (const [fam] of ranked.slice(0, 4)) add(fam, "other", faces.has(fam) ? "font-face" : "css");
  return fonts.slice(0, 5);
}

/** The latin woff2 file Google Fonts serves for a family (variable when it can be). */
async function googleFontFile(doFetch: typeof fetch, family: string, ua: string, signal?: AbortSignal): Promise<Pick<WebsiteFont, "src" | "weightRange" | "source"> | undefined> {
  const name = encodeURIComponent(family).replace(/%20/g, "+");
  for (const [axis, range] of [["wght@100..900", [100, 900]], ["wght@400;700", undefined]] as const) {
    const res = await doFetch(`https://fonts.googleapis.com/css2?family=${name}:${axis}&display=swap`, { headers: { "user-agent": ua, accept: "text/css" }, ...(signal ? { signal } : {}) });
    if (!res.ok) continue;
    const parts = (await res.text()).split("@font-face");
    // Each block is preceded by its subset's name: /* latin */ @font-face {…}
    const faces = parts.slice(1).map((block, i) => ({ block, subset: /\/\*\s*([\w-]+)\s*\*\/\s*$/.exec(parts[i]!)?.[1] }));
    const normal = faces.filter((f) => !/font-style:\s*italic/.test(f.block));
    const latin = normal.find((f) => f.subset === "latin") ?? normal.find((f) => /U\+0000-00FF/i.test(f.block)) ?? normal[0];
    const src = latin && /url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/.exec(latin.block)?.[1];
    if (src) return { src, ...(range ? { weightRange: [range[0], range[1]] as [number, number] } : {}), source: "google-fonts" };
  }
  return undefined;
}
