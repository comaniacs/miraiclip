/**
 * <miraiclip-player>: plays a rendered video file or a live Miraiclip
 * document, with a scrubber, chapters (from the document's markers, a JSON
 * list or a WebVTT chapters file) and keyboard control. No framework.
 *
 *   <miraiclip-player src="launch.mp4" chapters="launch.chapters.vtt" controls></miraiclip-player>
 *   <miraiclip-player document="video.miraiclip.json" controls></miraiclip-player>
 *
 * Events: ready, play, pause, timeupdate, chapterchange ({ chapter }), ended, error ({ message }).
 */
import { chapterAt, chaptersFromMarkers, formatTime, normalizeChapters, parseVttChapters, type PlayerChapter } from "./chapters.js";
import { createDocumentEngine, createVideoEngine, resolveAssetSources, type PlaybackEngine } from "./engines.js";

type Doc = import("@miraiclip/core").ProjectDocument;

const STYLE = `
:host{display:block;position:relative;--mc-accent:#22d3ee;--mc-bg:#000;--mc-fg:#fff;--mc-radius:12px;--mc-font:Inter,system-ui,sans-serif;color:var(--mc-fg);font-family:var(--mc-font)}
:host([hidden]){display:none}
.frame{position:relative;width:100%;aspect-ratio:var(--mc-aspect,16/9);background:var(--mc-bg);border-radius:var(--mc-radius);overflow:hidden;outline:none}
.stage,.stage>*{position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:contain}
.big{position:absolute;inset:0;margin:auto;width:76px;height:76px;border-radius:50%;border:0;background:#000a;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
.big svg{width:34px;height:34px;margin-left:4px}
:host([data-playing]) .big,:host(:not([data-ready])) .big{display:none}
.bar{position:absolute;left:0;right:0;bottom:0;display:flex;align-items:center;gap:10px;padding:28px 12px 10px;background:linear-gradient(transparent,#000c);opacity:0;transition:opacity .2s}
:host([controls]) .frame:hover .bar,:host([controls]) .frame:focus-within .bar,:host([controls]:not([data-playing])) .bar{opacity:1}
:host(:not([controls])) .bar{display:none}
button.icon{background:none;border:0;color:inherit;width:34px;height:34px;padding:5px;cursor:pointer;border-radius:8px;flex:none}
button.icon:hover,button.icon:focus-visible{background:#ffffff22;outline:none}
button svg{width:100%;height:100%;fill:currentColor}
.time{font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap;opacity:.9}
.scrub{position:relative;flex:1;height:22px;cursor:pointer;outline:none;touch-action:none}
.rail{position:absolute;left:0;right:0;top:9px;height:4px;border-radius:2px;background:#ffffff40}
.fill{position:absolute;left:0;top:9px;height:4px;border-radius:2px;background:var(--mc-accent);width:0}
.tick{position:absolute;top:7px;width:2px;height:8px;background:#fff;opacity:.85;border-radius:1px}
.thumb{position:absolute;top:4px;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:#fff;box-shadow:0 1px 4px #0008;left:0}
.scrub:focus-visible .thumb{outline:2px solid var(--mc-accent);outline-offset:2px}
.label{font-size:13px;max-width:30%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.9}
.menu{position:absolute;right:10px;bottom:56px;max-height:60%;overflow:auto;margin:0;padding:6px;list-style:none;border-radius:10px;background:#111827f2;box-shadow:0 10px 30px #0009;min-width:200px}
.menu[hidden]{display:none}
.menu button{display:flex;gap:10px;width:100%;padding:8px 10px;border:0;border-radius:6px;background:none;color:inherit;font:inherit;font-size:14px;text-align:left;cursor:pointer}
.menu button:hover,.menu button:focus-visible{background:#ffffff1f;outline:none}
.menu button[aria-current="true"]{color:var(--mc-accent)}
.menu .t{opacity:.7;font-variant-numeric:tabular-nums}
.error{position:absolute;left:12px;right:12px;top:12px;padding:8px 12px;border-radius:8px;background:#7f1d1dee;font-size:13px}
.error[hidden]{display:none}
`;

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>',
  chapters: '<svg viewBox="0 0 24 24"><path d="M4 6h2v2H4zm4 0h12v2H8zM4 11h2v2H4zm4 0h12v2H8zm-4 5h2v2H4zm4 0h12v2H8z"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg>',
  muted: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zm16.6 0L19 7.4 16.4 10 13.8 7.4 12.4 9l2.6 2.6-2.6 2.6 1.4 1.4 2.6-2.6 2.6 2.6 1.6-1.6-2.6-2.6z"/></svg>',
};

const BaseElement: typeof HTMLElement = typeof HTMLElement === "undefined" ? (class {} as unknown as typeof HTMLElement) : HTMLElement;

export class MiraiclipPlayerElement extends BaseElement {
  static get observedAttributes(): string[] {
    return ["src", "document", "chapters", "poster", "loop", "muted", "assets-base"];
  }

  private readonly root: ShadowRoot;
  private engine: PlaybackEngine | undefined;
  private loadToken = 0;
  private docValue: Doc | undefined;
  private chapterList: PlayerChapter[] = [];
  private explicitChapters: PlayerChapter[] | undefined;
  private currentChapter: PlayerChapter | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private dragging = false;
  private readonly els: Record<"frame" | "stage" | "big" | "play" | "time" | "scrub" | "fill" | "thumb" | "ticks" | "label" | "chaptersBtn" | "menu" | "mute" | "error", HTMLElement>;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    this.root.innerHTML = `<style>${STYLE}</style>
<div class="frame" part="frame" tabindex="0">
  <div class="stage" part="stage"></div>
  <button class="big" part="big-play" aria-label="Play">${ICON.play}</button>
  <div class="bar" part="controls">
    <button class="icon play" aria-label="Play">${ICON.play}</button>
    <span class="time" part="time">0:00 / 0:00</span>
    <div class="scrub" part="scrubber" role="slider" tabindex="0" aria-label="Seek" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">
      <div class="rail"></div><div class="fill"></div><div class="ticks"></div><div class="thumb"></div>
    </div>
    <span class="label" part="chapter-label"></span>
    <button class="icon chapters" aria-label="Chapters" aria-haspopup="true" aria-expanded="false" hidden>${ICON.chapters}</button>
    <button class="icon mute" aria-label="Mute">${ICON.sound}</button>
  </div>
  <ol class="menu" part="chapters" hidden></ol>
  <div class="error" part="error" role="alert" hidden></div>
</div>`;
    const $ = (sel: string) => this.root.querySelector(sel) as HTMLElement;
    this.els = {
      frame: $(".frame"),
      stage: $(".stage"),
      big: $(".big"),
      play: $(".play"),
      time: $(".time"),
      scrub: $(".scrub"),
      fill: $(".fill"),
      thumb: $(".thumb"),
      ticks: $(".ticks"),
      label: $(".label"),
      chaptersBtn: $(".chapters"),
      menu: $(".menu"),
      mute: $(".mute"),
      error: $(".error"),
    };
    this.wire();
  }

  // ------------------------------------------------------------------ API

  /** A project document to play live (takes precedence over `document`/`src` attributes). */
  get document(): Doc | undefined {
    return this.docValue;
  }
  set document(doc: Doc | undefined) {
    this.docValue = doc;
    void this.load();
  }

  /** Chapters in seconds. Set to override markers / the `chapters` attribute. */
  get chapters(): PlayerChapter[] {
    return [...this.chapterList];
  }
  set chapters(value: PlayerChapter[] | undefined) {
    this.explicitChapters = value ? normalizeChapters(value, this.duration) : undefined;
    this.refreshChapters();
  }

  get currentTime(): number {
    return this.engine?.state().timeS ?? 0;
  }
  set currentTime(seconds: number) {
    this.seek(seconds);
  }
  get duration(): number {
    return this.engine?.state().durationS ?? 0;
  }
  get paused(): boolean {
    return !(this.engine?.state().playing ?? false);
  }
  get currentChapterInfo(): PlayerChapter | undefined {
    return this.currentChapter;
  }

  play(): void {
    this.engine?.play();
  }
  pause(): void {
    this.engine?.pause();
  }
  toggle(): void {
    if (this.paused) this.play();
    else this.pause();
  }
  seek(seconds: number): void {
    this.engine?.seek(Math.min(Math.max(0, seconds), this.duration || seconds));
    this.render();
  }
  /** Jump to a chapter by id or index. */
  goToChapter(which: string | number): void {
    const chapter = typeof which === "number" ? this.chapterList[which] : this.chapterList.find((c) => c.id === which);
    if (chapter) this.seek(chapter.start);
  }

  // ------------------------------------------------------------------ lifecycle

  connectedCallback(): void {
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.sizeEngine());
      this.resizeObserver.observe(this.els.frame);
    }
    if (!this.engine) void this.load();
  }

  disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.engine?.destroy();
    this.engine = undefined;
  }

  attributeChangedCallback(name: string, previous: string | null, next: string | null): void {
    if (previous === next || !this.isConnected) return;
    if (name === "src" || name === "document" || name === "assets-base") void this.load();
    else if (name === "chapters") void this.loadChapterAttribute();
    else if (name === "muted") this.engine?.setMuted(next !== null);
  }

  // ------------------------------------------------------------------ loading

  private async load(): Promise<void> {
    const token = ++this.loadToken;
    this.engine?.destroy();
    this.engine = undefined;
    this.removeAttribute("data-ready");
    this.showError(null);
    this.els.stage.replaceChildren();
    const loop = this.hasAttribute("loop");
    const muted = this.hasAttribute("muted");
    try {
      let engine: PlaybackEngine | undefined;
      let doc = this.docValue;
      const docUrl = this.getAttribute("document");
      if (!doc && docUrl) {
        const response = await fetch(docUrl);
        if (!response.ok) throw new Error(`could not load ${docUrl} (HTTP ${response.status})`);
        doc = (await response.json()) as Doc;
        if (token !== this.loadToken) return;
      }
      if (doc) {
        const base = this.getAttribute("assets-base") ?? (docUrl ? new URL(docUrl, location.href).href : undefined);
        const resolved = resolveAssetSources(doc, base);
        this.style.setProperty("--mc-aspect", `${resolved.settings.width}/${resolved.settings.height}`);
        engine = await createDocumentEngine(resolved, { loop, muted, loadPlugins: this.hasAttribute("plugins") });
        this.docChapters = (durationS) => chaptersFromMarkers(resolved.markers, durationS);
      } else {
        const src = this.getAttribute("src");
        if (!src) return;
        const poster = this.getAttribute("poster");
        engine = createVideoEngine(src, { loop, muted, ...(poster ? { poster } : {}) });
        this.docChapters = undefined;
        const video = engine.element as HTMLVideoElement;
        video.addEventListener("loadedmetadata", () => {
          if (video.videoWidth && video.videoHeight) this.style.setProperty("--mc-aspect", `${video.videoWidth}/${video.videoHeight}`);
          this.refreshChapters();
        });
      }
      if (token !== this.loadToken) {
        engine.destroy();
        return;
      }
      this.engine = engine;
      this.els.stage.append(engine.element);
      let wasPlaying = false;
      engine.onChange(() => {
        const playing = engine.state().playing;
        if (playing !== wasPlaying) {
          wasPlaying = playing;
          this.toggleAttribute("data-playing", playing);
          this.dispatch(playing ? "play" : "pause");
        }
        this.render();
        this.dispatch("timeupdate");
      });
      engine.onEnded(() => this.dispatch("ended"));
      engine.onError((message) => {
        this.showError(message);
        this.dispatch("error", { message });
      });
      this.sizeEngine();
      await this.loadChapterAttribute();
      this.refreshChapters();
      this.setAttribute("data-ready", "");
      this.render();
      this.dispatch("ready");
      if (this.hasAttribute("autoplay")) engine.play();
    } catch (error) {
      if (token !== this.loadToken) return;
      const message = error instanceof Error ? error.message : String(error);
      this.showError(message);
      this.dispatch("error", { message });
    }
  }

  private docChapters: ((durationS: number) => PlayerChapter[]) | undefined;
  private attributeChapters: PlayerChapter[] | undefined;

  private async loadChapterAttribute(): Promise<void> {
    const url = this.getAttribute("chapters");
    if (!url) {
      this.attributeChapters = undefined;
      return;
    }
    try {
      const response = await fetch(url);
      const text = await response.text();
      this.attributeChapters = text.trimStart().startsWith("WEBVTT") ? parseVttChapters(text) : normalizeChapters(JSON.parse(text), this.duration);
    } catch {
      this.attributeChapters = undefined;
    }
    this.refreshChapters();
  }

  private refreshChapters(): void {
    const duration = this.duration;
    this.chapterList = this.explicitChapters ?? this.attributeChapters ?? this.docChapters?.(duration) ?? [];
    const { ticks, menu, chaptersBtn } = this.els;
    ticks.replaceChildren();
    menu.replaceChildren();
    chaptersBtn.hidden = this.chapterList.length === 0;
    for (const [i, chapter] of this.chapterList.entries()) {
      if (duration > 0 && chapter.start > 0) {
        const tick = document.createElement("div");
        tick.className = "tick";
        tick.style.left = `${(chapter.start / duration) * 100}%`;
        tick.title = chapter.label;
        ticks.append(tick);
      }
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset["index"] = String(i);
      button.innerHTML = `<span class="t"></span><span class="n"></span>`;
      (button.querySelector(".t") as HTMLElement).textContent = formatTime(chapter.start);
      (button.querySelector(".n") as HTMLElement).textContent = chapter.label;
      li.append(button);
      menu.append(li);
    }
    this.currentChapter = undefined;
    this.render();
  }

  // ------------------------------------------------------------------ UI

  private wire(): void {
    const { big, play, scrub, chaptersBtn, menu, mute, frame } = this.els;
    big.addEventListener("click", () => this.play());
    play.addEventListener("click", () => this.toggle());
    this.els.stage.addEventListener("click", () => this.toggle());
    mute.addEventListener("click", () => {
      const muted = !this.hasAttribute("muted");
      this.toggleAttribute("muted", muted);
      this.engine?.setMuted(muted);
      mute.innerHTML = muted ? ICON.muted : ICON.sound;
      mute.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    });
    chaptersBtn.addEventListener("click", () => {
      const open = menu.hidden;
      menu.hidden = !open;
      chaptersBtn.setAttribute("aria-expanded", String(open));
      if (open) (menu.querySelector<HTMLButtonElement>('button[aria-current="true"]') ?? menu.querySelector<HTMLButtonElement>("button"))?.focus();
    });
    menu.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest("button");
      if (!button) return;
      this.goToChapter(Number(button.dataset["index"]));
      menu.hidden = true;
      chaptersBtn.setAttribute("aria-expanded", "false");
    });
    const seekFromPointer = (event: PointerEvent): void => {
      const rect = scrub.getBoundingClientRect();
      if (rect.width <= 0) return;
      this.seek(((event.clientX - rect.left) / rect.width) * this.duration);
    };
    scrub.addEventListener("pointerdown", (event) => {
      this.dragging = true;
      scrub.setPointerCapture?.(event.pointerId);
      seekFromPointer(event);
    });
    scrub.addEventListener("pointermove", (event) => {
      if (this.dragging) seekFromPointer(event);
    });
    scrub.addEventListener("pointerup", () => {
      this.dragging = false;
    });
    const keys = (event: KeyboardEvent): void => {
      const step = event.shiftKey ? 10 : 5;
      if (event.key === " " || event.key === "k") this.toggle();
      else if (event.key === "ArrowRight" || event.key === "l") this.seek(this.currentTime + step);
      else if (event.key === "ArrowLeft" || event.key === "j") this.seek(this.currentTime - step);
      else if (event.key === "Home") this.seek(0);
      else if (event.key === "End") this.seek(this.duration);
      else if (event.key === "]" ) this.stepChapter(1);
      else if (event.key === "[") this.stepChapter(-1);
      else if (event.key === "Escape") menu.hidden = true;
      else return;
      event.preventDefault();
    };
    frame.addEventListener("keydown", keys);
  }

  private stepChapter(direction: 1 | -1): void {
    if (this.chapterList.length === 0) return;
    const t = this.currentTime;
    if (direction > 0) {
      const next = this.chapterList.find((c) => c.start > t + 0.25);
      if (next) this.seek(next.start);
    } else {
      const previous = [...this.chapterList].reverse().find((c) => c.start < t - 1);
      this.seek(previous?.start ?? 0);
    }
  }

  private render(): void {
    const state = this.engine?.state() ?? { playing: false, timeS: 0, durationS: 0 };
    const { time, fill, thumb, scrub, play, label, menu } = this.els;
    const fraction = state.durationS > 0 ? Math.min(1, state.timeS / state.durationS) : 0;
    time.textContent = `${formatTime(state.timeS)} / ${formatTime(state.durationS)}`;
    fill.style.width = `${fraction * 100}%`;
    thumb.style.left = `${fraction * 100}%`;
    scrub.setAttribute("aria-valuemax", String(Math.round(state.durationS)));
    scrub.setAttribute("aria-valuenow", String(Math.round(state.timeS)));
    scrub.setAttribute("aria-valuetext", time.textContent);
    const wanted = state.playing ? "Pause" : "Play";
    if (play.getAttribute("aria-label") !== wanted) {
      play.innerHTML = state.playing ? ICON.pause : ICON.play;
      play.setAttribute("aria-label", wanted);
    }
    const chapter = chapterAt(this.chapterList, state.timeS);
    label.textContent = chapter?.label ?? "";
    if (chapter?.id !== this.currentChapter?.id) {
      this.currentChapter = chapter;
      for (const button of Array.from(menu.querySelectorAll("button"))) {
        button.setAttribute("aria-current", String(this.chapterList[Number(button.dataset["index"])]?.id === chapter?.id));
      }
      this.dispatch("chapterchange", { chapter: chapter ?? null });
    }
  }

  private sizeEngine(): void {
    const rect = this.els.frame.getBoundingClientRect();
    this.engine?.resize(rect.width, rect.height);
  }

  private showError(message: string | null): void {
    this.els.error.hidden = message === null;
    this.els.error.textContent = message ?? "";
  }

  private dispatch(type: string, detail?: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: type !== "timeupdate", composed: true }));
  }
}

/** Register the element (default tag `miraiclip-player`). Safe to call twice. */
export function defineMiraiclipPlayer(tagName = "miraiclip-player"): typeof MiraiclipPlayerElement {
  if (typeof customElements === "undefined") return MiraiclipPlayerElement;
  const existing = customElements.get(tagName);
  if (existing) return existing as typeof MiraiclipPlayerElement;
  customElements.define(tagName, MiraiclipPlayerElement);
  return MiraiclipPlayerElement;
}

declare global {
  interface HTMLElementTagNameMap {
    "miraiclip-player": MiraiclipPlayerElement;
  }
}
