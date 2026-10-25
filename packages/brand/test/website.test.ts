import { describe, expect, it } from "vitest";
import { brandFromWebsite, colorsIn, publicUrl } from "../src/index.js";

const HTML = `<!doctype html><html><head>
<title>Zestly | The all-in-one sales platform for agencies</title>
<meta name="description" content="Capture, nurture and close more leads with one platform built for agencies.">
<meta property="og:image" content="/img/share.png">
<meta name="theme-color" content="#ffffff">
<link rel="stylesheet" href="/css/site.css">
<link rel="preconnect" href="https://fonts.gstatic.com">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700&amp;family=Inter:wght@400&amp;display=swap" rel="stylesheet">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<style>:root{--color-primary:#155eef;--accent:#f97316;--text-primary:#101828;--tw-ring-color:#ff0000}</style>
</head><body>
<header><a href="/"><img class="site-logo" src="/img/zestly-logo.svg" alt="Zestly"></a></header>
<h1>Grow your agency on autopilot</h1>
<h2>Everything you need to win clients &amp; keep them</h2>
<p>Zestly brings your CRM, funnels, calendars and messaging into one place, so your team spends less time switching tools and more time closing deals.</p>
<a class="btn btn-primary" href="/trial">Start your free trial</a>
<button>Book a demo</button>
<img src="/img/hero-small.jpg" srcset="/img/hero-800.jpg 800w, /img/hero-1600.jpg 1600w" alt="The Zestly dashboard with a pipeline board" width="1600" height="1000">
<img data-src="/img/team.jpg" alt="An agency team reviewing leads" width="800" height="600">
<img src="/img/icon-check.png" width="24" height="24" alt="">
<img src="/img/tracking.gif" width="1" height="1">
<img src="/img/2026-top-50-agentic-ai.png" alt="2026 Top 50 Agentic AI Products" width="600" height="600">
<script>var x = "<h1>not this</h1>";</script>
</body></html>`;

const CSS = `body{font-family:"Plus Jakarta Sans",system-ui,sans-serif;color:#101828;background:#ffffff}
h1,h2,.hero-title{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800}
p{font-family:Inter,sans-serif}
.btn-primary{background-color:#155eef;color:#fff;border-radius:999px}
.btn-primary:hover{background-color:#004eeb}
.badge{background:#f97316}
.link{color:#155eef}.card{border-color:#e4e7ec}
.fa{font-family:"Font Awesome 6 Free"}`;

const GOOGLE_CSS = `/* cyrillic-ext */
@font-face { font-family: 'Plus Jakarta Sans'; font-style: normal; src: url(https://fonts.gstatic.com/s/pjs/v8/cyr.woff2) format('woff2'); unicode-range: U+0460-052F; }
/* latin */
@font-face { font-family: 'Plus Jakarta Sans'; font-style: normal; src: url(https://fonts.gstatic.com/s/pjs/v8/latin.woff2) format('woff2'); unicode-range: U+0000-00FF; }`;

function site(routes: Record<string, () => Response>) {
  const calls: string[] = [];
  const fetch = (async (input: string) => {
    calls.push(String(input));
    const url = new URL(String(input));
    const key = url.hostname === "fonts.googleapis.com" ? `fonts:${url.searchParams.get("family")}` : `${url.hostname}${url.pathname}`;
    return (routes[key] ?? (() => new Response("not found", { status: 404 })))();
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

describe("brandFromWebsite", () => {
  const routes = {
    "zestly.com/": () => new Response(null, { status: 301, headers: { location: "https://www.zestly.com/" } }),
    "www.zestly.com/": () => new Response(HTML, { headers: { "content-type": "text/html" } }),
    "www.zestly.com/css/site.css": () => new Response(CSS),
    "fonts:Plus Jakarta Sans:wght@100..900": () => new Response(GOOGLE_CSS),
  };

  it("reads name, copy, colours, fonts and logo", async () => {
    const { fetch } = site(routes);
    const b = await brandFromWebsite("zestly.com", { fetch });
    expect(b.url).toBe("https://www.zestly.com/");
    expect(b.name).toBe("Zestly");
    expect(b.tagline).toBe("Grow your agency on autopilot");
    expect(b.description).toMatch(/^Capture, nurture/);
    expect(b.colors).toMatchObject({ primary: "#155eef", accent: "#f97316", background: "#ffffff", text: "#101828" });
    expect(b.colors.palette[0]!.color).toBe("#155eef");
    expect(b.colors.secondary).toBeUndefined(); // no third brand colour; the accent isn't repeated as secondary
    expect(b.colors.palette.map((p) => p.color)).not.toContain("#ff0000"); // Tailwind internals don't count
    expect(b.fonts[0]).toMatchObject({ family: "Plus Jakarta Sans", role: "heading", src: "https://fonts.gstatic.com/s/pjs/v8/latin.woff2", weightRange: [100, 900] });
    expect(b.fonts.map((f) => f.family)).toContain("Inter");
    expect(b.fonts.map((f) => f.family)).not.toContain("Font Awesome 6 Free");
    expect(b.logo).toBe("https://www.zestly.com/img/zestly-logo.svg");
    expect(b.images).toContainEqual({ src: "https://www.zestly.com/img/share.png", kind: "share" });
    expect(b.images.filter((i) => i.kind === "photo")).toEqual([
      { src: "https://www.zestly.com/img/hero-1600.jpg", kind: "photo", alt: "The Zestly dashboard with a pipeline board", width: 1600, height: 1000 },
      { src: "https://www.zestly.com/img/team.jpg", kind: "photo", alt: "An agency team reviewing leads", width: 800, height: 600 },
    ]);
    expect(b.style).toEqual({ theme: "light", buttonShape: "pill" });
    expect(b.copy.headings).toEqual(["Grow your agency on autopilot", "Everything you need to win clients & keep them"]);
    expect(b.copy.ctas).toEqual(["Start your free trial", "Book a demo"]);
    expect(b.copy.paragraphs[0]).toMatch(/^Zestly brings your CRM/);
    expect(b.kit).toMatchObject({ name: "Zestly", url: "zestly.com", colors: { primary: "#155eef" }, fonts: { heading: { family: "Plus Jakarta Sans" } } });
    expect(b.warnings).toEqual([]);
  });

  it("refuses private addresses, including through redirects", async () => {
    for (const bad of ["http://localhost:5173", "http://127.0.0.1", "http://10.0.0.5/x", "http://[::1]/", "http://printer.local", "file:///etc/passwd", "http://169.254.169.254/latest"]) {
      expect(() => publicUrl(bad), bad).toThrow();
    }
    expect(publicUrl("Example.com/pricing").href).toBe("https://example.com/pricing");
    const { fetch } = site({ "evil.example/": () => new Response(null, { status: 302, headers: { location: "http://192.168.1.1/admin" } }) });
    await expect(brandFromWebsite("evil.example", { fetch })).rejects.toThrow(/not a public address/);
  });

  it("says what's missing on a JavaScript-only page", async () => {
    const { fetch } = site({ "spa.example/": () => new Response("<html><head><title>Spa</title></head><body><div id=root></div></body></html>") });
    const b = await brandFromWebsite("spa.example", { fetch, resolveFonts: false });
    expect(b.name).toBe("Spa");
    expect(b.kit).toBeUndefined();
    expect(b.warnings.join(" ")).toMatch(/no CSS found.*|no brand colour/);
  });
});

describe("logo", () => {
  it("picks the brand's logo, not a customer's from a logo wall", async () => {
    const page = `<html><head><title>HighLevel | The AI-powered business OS</title><meta property="og:site_name" content="HighLevel"></head><body>
<section class="trusted"><h3>Trusted by 2M+ businesses</h3><img class="logo" src="/c/printful-logo.svg" alt="Printful logo"><img class="logo" src="/c/acme-logo.svg" alt="Acme logo"><img class="logo" src="/c/zap-logo.svg" alt="Zap logo"></section>
<header><a href="/"><img src="/img/hl-mark.svg" alt="HighLevel"></a></header>
<footer><img src="/img/highlevel-logo-white.svg" alt="HighLevel logo"></footer></body></html>`;
    const fetch = (async () => new Response(page)) as unknown as typeof globalThis.fetch;
    const b = await brandFromWebsite("gohighlevel.com", { fetch, resolveFonts: false });
    expect(b.logo).toBe("https://gohighlevel.com/img/hl-mark.svg");
    expect(b.images.map((i) => i.src)).not.toContain("https://gohighlevel.com/c/printful-logo.svg");
  });

  it("leaves the logo out rather than guess from a logo wall", async () => {
    const page = `<html><head><title>Spa</title></head><body><section><h3>Our customers</h3><img class="logo" src="/c/printful-logo.svg" alt="Printful"><img class="logo" src="/c/b-logo.svg" alt="B"></section></body></html>`;
    const fetch = (async () => new Response(page)) as unknown as typeof globalThis.fetch;
    const b = await brandFromWebsite("spa.example", { fetch, resolveFonts: false });
    expect(b.logo).toBeUndefined();
  });
});

describe("colorsIn", () => {
  it("parses hex, rgb and hsl, and skips translucent ones", () => {
    expect(colorsIn("linear-gradient(#155EEF, rgb(249 115 22), hsl(0, 100%, 50%), rgba(0,0,0,.2), #fff)")).toEqual(["#155eef", "#f97316", "#ff0000", "#ffffff"]);
  });
});
