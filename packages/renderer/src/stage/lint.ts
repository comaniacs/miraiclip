/**
 * Static checks for stage-kit sequences, before they ever render: the rules
 * that keep a scripted clip frame-exact (the same frame for the same time, in
 * preview and every export path) and resolution-independent. Each finding
 * says how to fix it, for people and for models.
 */

export interface SequenceLintFinding {
  rule: string;
  message: string;
}

export interface SequenceLintResult {
  /** Must be fixed: the sequence would render wrongly or differently each time. */
  errors: SequenceLintFinding[];
  /** Should be fixed: it will render, but not well everywhere. */
  warnings: SequenceLintFinding[];
}

const scriptsOf = (template: string) => [...template.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map((m) => ({ attrs: m[1] ?? "", code: m[2] ?? "" }));
const stylesOf = (template: string) => [...template.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1] ?? "").join("\n");
/** Code without comments and string contents, for pattern checks that shouldn't trip on text. */
const codeOnly = (code: string) =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '""');

const FORBIDDEN: { rule: string; re: RegExp; message: string }[] = [
  { rule: "random", re: /\bMath\.random\s*\(/, message: "Math.random() gives a different frame every render: use S.rand(seed) for a repeatable random sequence" },
  { rule: "clock", re: /\b(Date\.now|performance\.now)\s*\(|\bnew\s+Date\s*\(/, message: "the clock isn't the timeline: derive everything from timeline positions, never from Date or performance.now" },
  { rule: "async-loop", re: /\b(requestAnimationFrame|setTimeout|setInterval|queueMicrotask)\s*\(/, message: "frames are seeked, never played: no requestAnimationFrame, timers or loops — put every change on the timeline" },
  { rule: "network", re: /\b(fetch|XMLHttpRequest|WebSocket|EventSource)\b|\bimport\s*\(/, message: "no network in a sequence: images are asset:<id> references, libraries come from data-libs" },
  { rule: "infinite", re: /\brepeat\s*:\s*-1\b|\bloop\s*:\s*true\b|\biterations\s*:\s*Infinity\b/, message: "no infinite loops: repeat a finite number of times inside the sequence's length" },
  { rule: "owned-hooks", re: /\b(__timelines|__anime|__lottie|__miraiclipSeek|__miraiclipReady)\b/, message: "the stage kit owns the seek hooks: build the timeline with stage.build((tl, S) => …) only" },
  { rule: "gsap", re: /\b(gsap|TweenMax|TweenLite|TimelineMax|ScrollTrigger)\b/, message: "GSAP isn't available here: use the stage kit's tl.to / tl.from / tl.fromTo / tl.set / tl.label / tl.camera" },
];


const V2_VERBS = "morph|iris|zoomThrough|hop|gather|impact|press|pointer|follow|whip|handheld|shake|hit|rest|cut|shadow|focus";
/** Verbs whose first argument(s) name elements, with how many leading selector arguments to check. */
const TARGET_ARGS: Record<string, number> = { morph: 2, iris: 1, zoomThrough: 1, hop: 1, gather: 1, impact: 1, press: 1, follow: 1, whip: 1, shadow: 1 };
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

/** Which ids sit inside `<div class="world">`, by walking the markup's tags. */
function idsByWorld(template: string): { inside: Set<string>; all: Set<string>; classes: Set<string> } {
  const markup = template.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  const inside = new Set<string>(), all = new Set<string>(), classes = new Set<string>();
  const stack: { tag: string; world: boolean }[] = [];
  for (const m of markup.matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g)) {
    const [, close, tag, attrs, selfClose] = m;
    const name = tag!.toLowerCase();
    if (close) {
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i]!.tag === name) { stack.length = i; break; }
      continue;
    }
    const id = /\bid\s*=\s*["']([^"']+)["']/.exec(attrs!)?.[1];
    const cls = /\bclass\s*=\s*["']([^"']+)["']/.exec(attrs!)?.[1]?.split(/\s+/) ?? [];
    const isWorld = cls.includes("world");
    const world = isWorld || stack.some((e) => e.world);
    if (id) { all.add(id); if (world) inside.add(id); }
    cls.forEach((c) => classes.add(c));
    if (!selfClose && !VOID.has(name)) stack.push({ tag: name, world: isWorld });
  }
  return { inside, all, classes };
}

/** Lint a stage-kit sequence template. */
export function lintSequence(template: string): SequenceLintResult {
  const errors: SequenceLintFinding[] = [];
  const warnings: SequenceLintFinding[] = [];
  const err = (rule: string, message: string) => errors.push({ rule, message });
  const warn = (rule: string, message: string) => warnings.push({ rule, message });

  if (!/data-libs\s*=\s*["'][^"']*\bstage\b/i.test(template)) err("libs", 'the stage root needs data-libs="stage" (it brings the stage kit and its animation engine)');
  const dur = /data-duration\s*=\s*["']([\d.]+)["']/i.exec(template);
  if (!dur) err("duration", 'the stage root needs data-duration="<seconds>", the sequence\'s length');

  const scripts = scriptsOf(template);
  if (scripts.some((s) => /\bsrc\s*=/.test(s.attrs))) err("external-script", "no <script src>: libraries come from data-libs, everything else is inline");
  const code = scripts.map((s) => codeOnly(s.code)).join("\n");
  const builds = (code.match(/\bstage\.build\s*\(/g) ?? []).length;
  if (builds === 0) err("build", "build the timeline with stage.build((tl, S) => { … }) in one inline <script>");
  if (builds > 1) err("build", "call stage.build once: put the whole sequence on one timeline");
  for (const f of FORBIDDEN) if (f.re.test(code)) err(f.rule, f.message);
  if (/\banime\.\w+/.test(code)) warn("engine", "use the stage kit (tl.to/from/fromTo/set/label/camera, S.*) rather than anime.js directly: the kit keeps seeking deterministic");

  const css = stylesOf(template);
  if (/\d(vw|vh|vmin|vmax)\b/.test(css + template.replace(/<script[\s\S]*?<\/script>/gi, ""))) err("units", "viewport units (vw/vh/vmin) render at the wrong size: use container units (cqw, cqh, cqmin) in CSS and S.w/S.h/S.min in the script");
  if (/position\s*:\s*fixed/i.test(css)) err("fixed", "position:fixed doesn't work in a clip: use position:absolute inside the stage");

  // Large blurred layers: some GPU rasterizers draw a big `filter: blur()` under the camera's 3D tilt with
  // tile-shaped artifacts. Soft glows look the same as a radial-gradient fading to transparent.
  const styled = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ where: m[1]!.trim(), body: m[2]! }));
  for (const m of template.replace(/<script[\s\S]*?<\/script>/gi, "").matchAll(/style\s*=\s*"([^"]*)"/gi)) styled.push({ where: "an inline style", body: m[1]! });
  const big = (body: string) =>
    /(^|;)\s*inset\s*:\s*-?0/.test(body) ||
    [...body.matchAll(/(?:^|;)\s*(?:width|height)\s*:\s*(\d+(?:\.\d+)?)(cqw|cqh|cqmin|%)/g)].some((m) => Number(m[1]) >= 30);
  const blurred = styled.filter((r) => /(^|;)\s*filter\s*:[^;]*blur\(/.test(r.body) && big(r.body)).map((r) => r.where);
  if (blurred.length) warn("big-blur", `${blurred.slice(0, 3).join(", ")}: a large layer with filter: blur() can render with tile-shaped artifacts while the camera tilts — make soft glows with a radial-gradient fading to transparent instead`);

  // Pixel literals for positions and sizes don't survive another frame size.
  const raw = [...code.matchAll(/\b(x|y|left|top|width|height)\s*:\s*(-?\d+(?:\.\d+)?)(?![\d.]*\s*(?:%|cq|em|rem))/g)].filter((m) => Math.abs(Number(m[2])) > 40);
  if (raw.length) warn("pixels", `${raw.map((m) => `${m[1]}: ${m[2]}`).slice(0, 3).join(", ")} are pixels: use S.w(…) / S.h(…) / S.min(…) (percent of the stage) so the sequence fits 16:9, 9:16 and 1:1`);

  // ---- continuous shot (version 2)
  const rawCode = scripts.map((x) => x.code).join("\n");
  const version2 = /data-stage-version\s*=\s*["']2["']/i.test(template);
  const usesV2 = new RegExp(`\\btl\\s*\\.\\s*(${V2_VERBS})\\s*\\(|\\bS\\s*\\.\\s*grid\\s*\\(|\\banchor\\s*:`).test(code);
  if (usesV2 && !version2) err("version", 'this sequence uses continuous-shot verbs (morph, hop, follow, shake, rest, anchor …): add data-stage-version="2" to the stage root');
  if (usesV2 || version2) {
    const ids = idsByWorld(template);
    for (const m of rawCode.matchAll(new RegExp(`\\btl\\s*\\.\\s*(${Object.keys(TARGET_ARGS).join("|")})\\s*\\(\\s*((?:"[^"]*"|'[^']*')(?:\\s*,\\s*(?:"[^"]*"|'[^']*'))?)`, "g"))) {
      const verb = m[1]!;
      const sels = [...m[2]!.matchAll(/["']([^"']*)["']/g)].map((x) => x[1]!).slice(0, TARGET_ARGS[verb]);
      for (const sel of sels) {
        const id = /^#([\w-]+)$/.exec(sel)?.[1];
        const cls = /^\.([\w-]+)$/.exec(sel)?.[1];
        if ((id && !ids.all.has(id)) || (cls && !ids.classes.has(cls))) err("carry-target", `tl.${verb}("${sel}"): nothing in the markup matches "${sel}". Add the element, or fix the selector.`);
        if (verb === "zoomThrough" && id && ids.all.has(id) && !ids.inside.has(id)) err("zoom-target", `tl.zoomThrough("${sel}"): the target must be inside <div class="world"> so the camera can move to it.`);
      }
    }
    for (const m of code.matchAll(/\bzoom\s*:\s*(\d+(?:\.\d+)?)/g)) {
      if (Number(m[1]) > 50 && !/\banchor\s*:/.test(code)) warn("zoom-anchor", `zoom: ${m[1]} without an anchor: a deep zoom drifts off its subject. Key it in screen space with tl.camera({ anchor: "#target", at: [50, 50], zoom: ${m[1]} }).`);
    }
    const animated = new Set<string>();
    for (const m of rawCode.matchAll(/\btl\s*\.\s*(morph|hop|gather|impact|press)\s*\(\s*["']#([\w-]+)["']/g)) animated.add(m[2]!);
    for (const id of animated) {
      const inline = new RegExp(`id\\s*=\\s*["']${id}["'][^>]*style\\s*=\\s*"[^"]*\\btransform\\s*:`, "i").test(template) || new RegExp(`style\\s*=\\s*"[^"]*\\btransform\\s*:[^"]*"[^>]*id\\s*=\\s*["']${id}["']`, "i").test(template);
      const sheet = new RegExp(`#${id}\\s*\\{[^}]*\\btransform\\s*:`, "i").test(css);
      if (inline || sheet) warn("verb-transform", `#${id} has a CSS transform, but a verb animates it and writes its own transform. Move the transform onto a wrapper, or use translate / scale / rotate properties.`);
    }
  }
  return { errors, warnings };
}
