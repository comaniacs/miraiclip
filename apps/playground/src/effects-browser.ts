/**
 * Effects tab: the full built-in library, driven by core's EFFECT_CATALOG
 * (categories, labels, param ranges) with real thumbnails from the renderer's
 * renderEffectThumbnails. Tiles toggle an effect on the video clip ("main");
 * applied effects get live sliders. Everything is plain `effect/*` commands —
 * undoable, and state is read back from the document (so undo stays in sync).
 */
import {
  EFFECT_CATALOG,
  EFFECT_CATEGORIES,
  getEffectInfo,
  type EffectCategory,
  type EffectInstance,
  type EffectParamInfo,
  type Project,
} from "@miraiclip/core";
import { renderEffectThumbnails } from "@miraiclip/renderer";

const CLIP = "main";
const idFor = (kind: string) => `panel-fx-${kind}`;

// Thumbnails: rendered once per page on the renderer's own offscreen canvas.
const thumbs = new Map<string, string>();
const thumbListeners = new Set<(kind: string, url: string) => void>();
let thumbsStarted = false;
function startThumbnails(): void {
  if (thumbsStarted) return;
  thumbsStarted = true;
  void renderEffectThumbnails({
    size: 120,
    onThumbnail: (kind, url) => {
      thumbs.set(kind, url);
      thumbListeners.forEach((l) => l(kind, url));
    },
  }).catch((error) => console.warn("[effects] thumbnails failed", error));
}

function formatValue(p: Extract<EffectParamInfo, { type: "number" }>, v: number): string {
  switch (p.format) {
    case "int":
      return String(Math.round(v));
    case "deg":
      return `${Math.round(v)}°`;
    case "stops":
      return `${v > 0 ? "+" : ""}${v.toFixed(1)} EV`;
    case "decimal":
      return v.toFixed(2);
    case "percent":
      return `${+(v * 100).toFixed(Math.abs(v) < 0.1 ? 1 : 0)}%`;
    default:
      return String(v);
  }
}

export function renderEffectsBrowser(body: HTMLElement, getProject: () => Project | undefined): () => void {
  // Thumbnails render on first interaction with the panel, not at page load:
  // ~80 filter renders compete with the first seconds of playback otherwise
  // (visible on software GL — and in the timing-sensitive e2e suite).
  if (thumbsStarted) startThumbnails();
  else {
    const start = (): void => startThumbnails();
    body.addEventListener("pointerenter", start, { once: true });
    body.addEventListener("focusin", start, { once: true });
  }
  let category: EffectCategory | "all" = "all";
  let query = "";

  const stackOf = (): readonly EffectInstance[] => getProject()?.getState().doc.clips[CLIP]?.effects ?? [];

  const controls = document.createElement("div");
  controls.className = "fx-controls";
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = `Search ${EFFECT_CATALOG.length} effects`;
  const select = document.createElement("select");
  select.innerHTML =
    `<option value="all">All categories</option>` +
    EFFECT_CATEGORIES.map((c) => `<option value="${c.id}">${c.label}</option>`).join("");
  controls.append(search, select);

  const grid = document.createElement("div");
  grid.className = "fx-grid";
  const applied = document.createElement("div");
  applied.className = "fx-applied";
  body.append(controls, grid, applied);

  const tiles = new Map<string, { el: HTMLButtonElement; img: HTMLImageElement }>();
  for (const info of EFFECT_CATALOG) {
    const el = document.createElement("button");
    el.className = "fx-tile";
    el.dataset["kind"] = info.kind;
    el.title = `${info.label} — ${info.kind}`;
    const img = document.createElement("img");
    img.alt = "";
    const url = thumbs.get(info.kind);
    if (url) img.src = url;
    const label = document.createElement("span");
    label.textContent = info.label;
    el.append(img, label);
    el.addEventListener("click", () => {
      const project = getProject();
      if (!project?.getState().doc.clips[CLIP]) return;
      const existing = stackOf().find((e) => e.kind === info.kind);
      project.dispatch(
        existing
          ? { type: "effect/remove", payload: { clipId: CLIP, effectId: existing.id } }
          : { type: "effect/add", payload: { clipId: CLIP, kind: info.kind, effectId: idFor(info.kind) } },
      );
    });
    tiles.set(info.kind, { el, img });
    grid.append(el);
  }

  const onThumb = (kind: string, url: string): void => {
    const tile = tiles.get(kind);
    if (tile) tile.img.src = url;
  };
  thumbListeners.add(onThumb);

  const filter = (): void => {
    const q = query.trim().toLowerCase();
    for (const info of EFFECT_CATALOG) {
      const show =
        (category === "all" || info.category === category) &&
        (!q || info.label.toLowerCase().includes(q) || info.kind.toLowerCase().includes(q));
      tiles.get(info.kind)!.el.hidden = !show;
    }
  };
  search.addEventListener("input", () => {
    query = search.value;
    filter();
  });
  select.addEventListener("change", () => {
    category = select.value as EffectCategory | "all";
    filter();
  });

  // Applied stack: rebuilt from the document on every change (undo-safe).
  let lastSignature = "";
  const sync = (): void => {
    const stack = stackOf();
    const kinds = new Set(stack.map((e) => e.kind));
    for (const [kind, tile] of tiles) tile.el.classList.toggle("active", kinds.has(kind));
    const signature = stack.map((e) => `${e.id}:${e.enabled}`).join("|");
    if (signature === lastSignature) {
      // Same stack: refresh slider values in place (keeps focus while dragging).
      for (const input of applied.querySelectorAll<HTMLInputElement>("input[data-effect]")) {
        const effect = stack.find((e) => e.id === input.dataset["effect"]);
        const v = effect?.params[input.dataset["key"]!];
        if (v !== undefined && document.activeElement !== input) input.value = String(v);
      }
      return;
    }
    lastSignature = signature;
    applied.innerHTML = "";
    if (stack.length === 0) {
      applied.innerHTML = `<p class="panel-note">Tap a tile to apply it to the video. Effects stack in the order added.</p>`;
      return;
    }
    for (const effect of stack) applied.append(appliedRow(effect));
  };

  const appliedRow = (effect: EffectInstance): HTMLElement => {
    const info = getEffectInfo(effect.kind);
    const row = document.createElement("div");
    row.className = "fx-row";
    const head = document.createElement("div");
    head.className = "fx-row-head";
    const name = document.createElement("strong");
    name.textContent = info?.label ?? effect.kind;
    const toggle = document.createElement("button");
    toggle.textContent = effect.enabled ? "On" : "Off";
    toggle.title = "Enable / disable";
    toggle.addEventListener("click", () =>
      getProject()?.dispatch({ type: "effect/update", payload: { clipId: CLIP, effectId: effect.id, enabled: !effect.enabled } }),
    );
    const remove = document.createElement("button");
    remove.textContent = "✕";
    remove.title = "Remove";
    remove.addEventListener("click", () =>
      getProject()?.dispatch({ type: "effect/remove", payload: { clipId: CLIP, effectId: effect.id } }),
    );
    head.append(name, toggle, remove);
    row.append(head);
    if (!effect.enabled) row.classList.add("off");

    for (const p of info?.params ?? []) {
      const line = document.createElement("label");
      line.className = "fx-param";
      const caption = document.createElement("span");
      const input = document.createElement("input");
      input.dataset["effect"] = effect.id;
      input.dataset["key"] = p.key;
      const commit = (value: number | string): void =>
        getProject()?.dispatch({ type: "effect/update", payload: { clipId: CLIP, effectId: effect.id, params: { [p.key]: value } } });
      if (p.type === "color") {
        input.type = "color";
        input.value = String(effect.params[p.key] ?? p.default);
        caption.textContent = p.label;
        input.addEventListener("change", () => commit(input.value));
      } else {
        input.type = "range";
        input.min = String(p.min);
        input.max = String(p.max);
        input.step = String(p.step);
        const value = Number(effect.params[p.key] ?? p.default);
        input.value = String(value);
        const show = (v: number) => (caption.textContent = `${p.label} · ${formatValue(p, v)}`);
        show(value);
        input.addEventListener("input", () => show(Number(input.value)));
        // "change" fires on release: one undo step per drag.
        input.addEventListener("change", () => commit(Number(input.value)));
      }
      line.append(caption, input);
      row.append(line);
    }
    return row;
  };

  const project = getProject();
  const unsubscribe = project?.store.subscribe(sync);
  sync();
  return () => {
    unsubscribe?.();
    thumbListeners.delete(onThumb);
  };
}
