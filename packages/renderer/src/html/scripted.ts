/**
 * Scripted html clips: templates whose motion comes from JavaScript —
 * GSAP timelines, Lottie, anime.js, the Web Animations API, or your own code.
 *
 * Each distinct template runs in a hidden, sandboxed iframe (scripts on,
 * no same-origin access to the editor). To draw time `t`, the frame is
 * SEEKED — never played — through the adapters below, then its DOM is
 * snapshotted: inline styles the scripts wrote are kept, CSS/WAAPI animation
 * values are baked into inline styles, canvases become images. The snapshot
 * is static markup, rasterized through the same foreignObject path as any
 * html clip, so preview, browser export, worker export (rasters come from
 * the main thread) and server export all draw the same frame for the same `t`.
 *
 * Seek adapters, tried in order on every frame:
 *  1. `window.__miraiclipSeek(t)` — your own hook (may return a promise).
 *  2. `window.__timelines` — an object (or array) of GSAP-style timelines:
 *     anything with `seek()`/`pause()`, or `progress()` + `duration()`.
 *  3. Lottie: animations from `lottie.getRegisteredAnimations()` and any in
 *     `window.__lottie` — `goToAndStop(ms, false)`.
 *  4. anime.js instances in `window.__anime` — `seek(ms)`.
 *  5. Every Web Animation / CSS animation in the document — paused and set to `t`.
 */

const BRIDGE = String.raw`(() => {
  const toList = (v) => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []);
  async function seek(t) {
    if (typeof window.__miraiclipSeek === "function") await window.__miraiclipSeek(t);
    for (const tl of toList(window.__timelines)) {
      try {
        if (typeof tl.pause === "function") tl.pause();
        if (typeof tl.seek === "function") tl.seek(t, false);
        else if (typeof tl.progress === "function" && typeof tl.duration === "function") tl.progress(tl.duration() ? Math.min(1, t / tl.duration()) : 0);
      } catch (e) {}
    }
    const lotties = [];
    try { if (window.lottie && window.lottie.getRegisteredAnimations) lotties.push(...window.lottie.getRegisteredAnimations()); } catch (e) {}
    lotties.push(...toList(window.__lottie));
    for (const a of new Set(lotties)) { try { a.goToAndStop(t * 1000, false); } catch (e) {} }
    for (const a of toList(window.__anime)) { try { a.pause && a.pause(); a.seek(t * 1000); } catch (e) {} }
    if (document.getAnimations) {
      for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = t * 1000; } catch (e) {} }
    }
  }
  function bakeAnimations(source, clone) {
    if (!document.getAnimations) return;
    const pairs = new Map();
    const walkA = document.createTreeWalker(source, NodeFilter.SHOW_ELEMENT);
    const walkB = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT);
    let a = walkA.currentNode, b = walkB.currentNode;
    while (a && b) { pairs.set(a, b); a = walkA.nextNode(); b = walkB.nextNode(); }
    for (const anim of document.getAnimations()) {
      const target = anim.effect && anim.effect.target;
      const copy = target && pairs.get(target);
      if (!copy) continue;
      const props = new Set();
      for (const k of anim.effect.getKeyframes()) for (const p of Object.keys(k)) if (!["offset", "easing", "composite", "computedOffset"].includes(p)) props.add(p);
      const cs = getComputedStyle(target);
      for (const p of props) {
        const css = p.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()).replace(/^css-/, "");
        const v = cs.getPropertyValue(css);
        if (v) copy.style.setProperty(css, v, "important");
      }
      copy.style.setProperty("animation", "none", "important");
    }
  }
  function snapshot() {
    const body = document.body;
    const clone = body.cloneNode(true);
    bakeAnimations(body, clone);
    const canvases = body.querySelectorAll("canvas");
    const copies = clone.querySelectorAll("canvas");
    canvases.forEach((c, i) => {
      const img = document.createElement("img");
      try { img.src = c.toDataURL(); } catch (e) {}
      img.setAttribute("style", (c.getAttribute("style") || "") + ";width:" + c.offsetWidth + "px;height:" + c.offsetHeight + "px");
      if (c.className) img.className = c.className;
      copies[i].replaceWith(img);
    });
    clone.querySelectorAll("script").forEach((s) => s.remove());
    clone.querySelectorAll("*").forEach((el) => { el.style && el.style.setProperty("transition", "none", "important"); });
    const wrap = document.createElement("div");
    wrap.setAttribute("style", "position:relative;width:100%;height:100%");
    const styles = [...document.querySelectorAll("style")].map((s) => s.outerHTML).join("");
    wrap.innerHTML = styles;
    wrap.append(...clone.childNodes);
    return new XMLSerializer().serializeToString(wrap);
  }
  let queue = Promise.resolve();
  window.addEventListener("message", (event) => {
    const m = event.data;
    if (!m || m.__miraiclip !== "seek") return;
    queue = queue.then(async () => {
      try {
        await seek(m.t);
        // Let promise-based adapters settle, then force style and layout. (Not requestAnimationFrame:
        // browsers don't run it in hidden cross-origin frames, which is what this sandboxed frame is.)
        await new Promise((r) => setTimeout(r, 0));
        void document.body.offsetHeight;
        parent.postMessage({ __miraiclip: "frame", id: m.id, markup: snapshot() }, "*");
      } catch (e) {
        parent.postMessage({ __miraiclip: "frame", id: m.id, error: String(e && e.message || e) }, "*");
      }
    });
  });
  const ready = () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => parent.postMessage({ __miraiclip: "ready" }, "*"));
  if (document.readyState === "complete") ready(); else window.addEventListener("load", ready);
})();`;

/** Build the frame document: the template at its logical size, plus the seek bridge. */
export function scriptedFrameDocument(markup: string, widthPx: number, heightPx: number): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8"/>` +
    `<style>html,body{margin:0;padding:0;width:${widthPx}px;height:${heightPx}px;overflow:hidden;background:transparent}</style>` +
    `</head><body>${markup}<script>${BRIDGE}</script></body></html>`
  );
}

interface Frame {
  iframe: HTMLIFrameElement;
  ready: Promise<void>;
  lastUsedMs: number;
  queue: Promise<unknown>;
}

const frames = new Map<string, Frame>();
const MAX_FRAMES = 8;
let nextId = 1;
const waiting = new Map<number, { resolve: (markup: string) => void; reject: (error: Error) => void }>();
let listening = false;

function listen(): void {
  if (listening) return;
  listening = true;
  window.addEventListener("message", (event: MessageEvent) => {
    const m = event.data as { __miraiclip?: string; id?: number; markup?: string; error?: string } | null;
    if (!m || m.__miraiclip !== "frame" || m.id === undefined) return;
    const w = waiting.get(m.id);
    if (!w) return;
    waiting.delete(m.id);
    if (m.error !== undefined) w.reject(new Error(`scripted html clip: ${m.error}`));
    else w.resolve(m.markup ?? "");
  });
}

function frameFor(key: string, markup: string, widthPx: number, heightPx: number, timeoutMs: number): Frame {
  const existing = frames.get(key);
  if (existing) {
    existing.lastUsedMs = Date.now();
    return existing;
  }
  listen();
  const iframe = document.createElement("iframe");
  // Scripts run, but the frame can't reach the editor (no same-origin).
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  iframe.style.cssText = `position:fixed;left:-${widthPx + 100}px;top:0;width:${widthPx}px;height:${heightPx}px;border:0;opacity:0;pointer-events:none`;
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("scripted html clip didn't load in time")), timeoutMs);
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      const m = event.data as { __miraiclip?: string } | null;
      if (m?.__miraiclip !== "ready") return;
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve();
    };
    window.addEventListener("message", onMessage);
  });
  iframe.srcdoc = scriptedFrameDocument(markup, widthPx, heightPx);
  document.body.append(iframe);
  const frame: Frame = { iframe, ready, lastUsedMs: Date.now(), queue: Promise.resolve() };
  frames.set(key, frame);
  // Least-recently-used frames go away: each holds a live document.
  while (frames.size > MAX_FRAMES) {
    let oldest: [string, Frame] | undefined;
    for (const entry of frames) if (!oldest || entry[1].lastUsedMs < oldest[1].lastUsedMs) oldest = entry;
    if (!oldest || oldest[0] === key) break;
    disposeFrame(oldest[0]);
  }
  return frame;
}

function disposeFrame(key: string): void {
  const frame = frames.get(key);
  if (!frame) return;
  frames.delete(key);
  frame.iframe.remove();
}

/** Remove every scripted-clip frame (tests, page teardown). */
export function disposeScriptedHtmlFrames(): void {
  for (const key of [...frames.keys()]) disposeFrame(key);
}

/**
 * The static markup of a scripted template at `timeS`: seek, wait a frame,
 * snapshot. Requests for one template are serialized (one frame document,
 * one time at a time). Needs a DOM.
 */
export async function snapshotScriptedHtml(options: {
  markup: string;
  widthPx: number;
  heightPx: number;
  timeS: number;
  /** How long the frame may take to load (default 15 s). */
  loadTimeoutMs?: number;
}): Promise<string> {
  const key = JSON.stringify([options.markup, options.widthPx, options.heightPx]);
  const frame = frameFor(key, options.markup, options.widthPx, options.heightPx, options.loadTimeoutMs ?? 15_000);
  const run = frame.queue.then(async () => {
    await frame.ready;
    const id = nextId++;
    const result = new Promise<string>((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      setTimeout(() => {
        if (!waiting.has(id)) return;
        waiting.delete(id);
        reject(new Error("scripted html clip didn't answer a seek in time"));
      }, 10_000);
    });
    frame.iframe.contentWindow?.postMessage({ __miraiclip: "seek", id, t: options.timeS }, "*");
    return result;
  });
  frame.queue = run.catch(() => undefined);
  return run;
}
