/**
 * Quick-test side panel: tabbed preset cards that drive the SAME public
 * command surface an app (or an AI agent) would — every card is just
 * `project.dispatch(...)`, so everything here is undoable and appears in
 * the document like any other edit.
 */
import type { Project } from "@miraiclip/core";

export interface PanelContext {
  project: Project;
  playheadUs: () => number;
  durationUs: number;
}

interface Card {
  id: string;
  label: string;
  hint: string;
  /** Toggle cards stay highlighted while active. */
  toggle?: boolean;
  run(context: PanelContext, active: boolean): void;
  disabled?: boolean;
}

interface Tab {
  id: string;
  label: string;
  note?: string;
  cards: Card[];
}

const fx = (id: string) => `panel-${id}`;

const TABS: Tab[] = [
  {
    id: "effects",
    label: "Effects",
    cards: [
      {
        id: "gray", label: "Grayscale", hint: "colorAdjust · saturation −1", toggle: true,
        run: ({ project }, active) =>
          project.dispatch(active
            ? { type: "effect/remove", payload: { clipId: "main", effectId: fx("gray") } }
            : { type: "effect/add", payload: { clipId: "main", kind: "colorAdjust", effectId: fx("gray"), params: { saturation: -1 } } }),
      },
      {
        id: "punch", label: "Punchy", hint: "contrast +0.25 · saturation +0.3", toggle: true,
        run: ({ project }, active) =>
          project.dispatch(active
            ? { type: "effect/remove", payload: { clipId: "main", effectId: fx("punch") } }
            : { type: "effect/add", payload: { clipId: "main", kind: "colorAdjust", effectId: fx("punch"), params: { contrast: 0.25, saturation: 0.3 } } }),
      },
      {
        id: "warm", label: "Warm shift", hint: "hue −20° · brightness +0.08", toggle: true,
        run: ({ project }, active) =>
          project.dispatch(active
            ? { type: "effect/remove", payload: { clipId: "main", effectId: fx("warm") } }
            : { type: "effect/add", payload: { clipId: "main", kind: "colorAdjust", effectId: fx("warm"), params: { hue: -20, brightness: 0.08 } } }),
      },
      {
        id: "blur", label: "Blur", hint: "amount 0.04 (of frame height)", toggle: true,
        run: ({ project }, active) =>
          project.dispatch(active
            ? { type: "effect/remove", payload: { clipId: "main", effectId: fx("blur") } }
            : { type: "effect/add", payload: { clipId: "main", kind: "blur", effectId: fx("blur"), params: { amount: 0.04 } } }),
      },
      {
        id: "key", label: "Chroma key", hint: "keys #00ff00 (green screens)", toggle: true,
        run: ({ project }, active) =>
          project.dispatch(active
            ? { type: "effect/remove", payload: { clipId: "main", effectId: fx("key") } }
            : { type: "effect/add", payload: { clipId: "main", kind: "chromaKey", effectId: fx("key") } }),
      },
    ],
  },
  {
    id: "text",
    label: "Text",
    cards: [
      {
        id: "title", label: "Title", hint: "big, centered, 3s at playhead",
        run: ({ project, playheadUs, durationUs }) =>
          project.dispatch({
            type: "clip/add",
            payload: {
              kind: "text", id: `title-${Date.now()}`, trackId: "overlay",
              startUs: Math.min(playheadUs(), Math.max(0, durationUs - 3_000_000)),
              durationUs: 3_000_000, text: "Big Title", fontSizePx: 72,
              color: "#ffffff", transform: { y: 0.45 },
            },
          }),
      },
      {
        id: "lower", label: "Lower third", hint: "small, bottom-left, 4s",
        run: ({ project, playheadUs, durationUs }) =>
          project.dispatch({
            type: "clip/add",
            payload: {
              kind: "text", id: `lower-${Date.now()}`, trackId: "overlay",
              startUs: Math.min(playheadUs(), Math.max(0, durationUs - 4_000_000)),
              durationUs: 4_000_000, text: "Vinamra Sareen — Miraiclip", fontSizePx: 28,
              color: "#ffd400", transform: { x: 0.22, y: 0.88 },
            },
          }),
      },
      {
        id: "stamp", label: "Timestamp", hint: "shows where you dropped it",
        run: ({ project, playheadUs, durationUs }) => {
          const at = playheadUs();
          project.dispatch({
            type: "clip/add",
            payload: {
              kind: "text", id: `stamp-${Date.now()}`, trackId: "overlay",
              startUs: Math.min(at, Math.max(0, durationUs - 2_000_000)),
              durationUs: 2_000_000, text: `t = ${(at / 1_000_000).toFixed(2)}s`,
              fontSizePx: 36, color: "#8fd18f", transform: { y: 0.12 },
            },
          });
        },
      },
    ],
  },
  {
    id: "animate",
    label: "Animate",
    cards: [
      {
        id: "fadein", label: "Fade in", hint: "opacity 0→1 over 2s, easeInOut",
        run: ({ project }) => {
          project.dispatch({ type: "keyframe/set", payload: { clipId: "main", property: "opacity", timeUs: 0, value: 0, easing: "easeInOut" } });
          project.dispatch({ type: "keyframe/set", payload: { clipId: "main", property: "opacity", timeUs: 2_000_000, value: 1 } });
        },
      },
      {
        id: "zoom", label: "Slow zoom", hint: "scale 1→1.15 across the clip",
        run: ({ project, durationUs }) => {
          project.dispatch({ type: "keyframe/set", payload: { clipId: "main", property: "scale", timeUs: 0, value: 1 } });
          project.dispatch({ type: "keyframe/set", payload: { clipId: "main", property: "scale", timeUs: durationUs, value: 1.15 } });
        },
      },
      {
        id: "slide", label: "Slide in", hint: "x −0.2→0.5 over 1.5s, easeOut",
        run: ({ project }) => {
          project.dispatch({ type: "keyframe/set", payload: { clipId: "main", property: "x", timeUs: 0, value: -0.2, easing: "easeOut" } });
          project.dispatch({ type: "keyframe/set", payload: { clipId: "main", property: "x", timeUs: 1_500_000, value: 0.5 } });
        },
      },
      {
        id: "fadeout", label: "Fade out at end", hint: "last 2s → opacity 0",
        run: ({ project, durationUs }) => {
          project.dispatch({ type: "keyframe/set", payload: { clipId: "main", property: "opacity", timeUs: Math.max(0, durationUs - 2_000_000), value: 1 } });
          project.dispatch({ type: "keyframe/set", payload: { clipId: "main", property: "opacity", timeUs: durationUs, value: 0, easing: "easeIn" } });
        },
      },
      {
        id: "clearkf", label: "Clear animation", hint: "keyframe/clear on the video",
        run: ({ project }) => project.dispatch({ type: "keyframe/clear", payload: { clipId: "main" } }),
      },
    ],
  },
  {
    id: "transitions",
    label: "Transitions",
    note: "Lands with v4 step 4 — cross-dissolve, dips, wipe, slide between adjacent clips.",
    cards: [
      { id: "dissolve", label: "Cross dissolve", hint: "coming in step 4", disabled: true, run: () => undefined },
      { id: "dip", label: "Dip to black", hint: "coming in step 4", disabled: true, run: () => undefined },
      { id: "wipe", label: "Wipe / slide", hint: "coming in step 4", disabled: true, run: () => undefined },
    ],
  },
];

export function initPanel(root: HTMLElement, getContext: () => PanelContext | undefined): void {
  const tabBar = document.createElement("div");
  tabBar.className = "panel-tabs";
  const body = document.createElement("div");
  body.className = "panel-body";
  root.append(tabBar, body);

  const activeToggles = new Set<string>();

  function renderTab(tab: Tab): void {
    body.innerHTML = "";
    for (const button of tabBar.children) {
      button.classList.toggle("active", (button as HTMLElement).dataset["tab"] === tab.id);
    }
    if (tab.note) {
      const note = document.createElement("p");
      note.className = "panel-note";
      note.textContent = tab.note;
      body.append(note);
    }
    for (const card of tab.cards) {
      const el = document.createElement("button");
      el.className = "card";
      el.disabled = !!card.disabled;
      el.innerHTML = `<strong>${card.label}</strong><span>${card.hint}</span>`;
      const key = `${tab.id}:${card.id}`;
      el.classList.toggle("active", activeToggles.has(key));
      el.addEventListener("click", () => {
        const context = getContext();
        if (!context) return;
        const wasActive = activeToggles.has(key);
        try {
          card.run(context, wasActive);
        } catch (error) {
          console.error("[panel]", error);
          return;
        }
        if (card.toggle) {
          if (wasActive) activeToggles.delete(key);
          else activeToggles.add(key);
          el.classList.toggle("active", !wasActive);
        }
      });
      body.append(el);
    }
    // Undo/redo footer: everything the cards do is plain commands.
    const footer = document.createElement("div");
    footer.className = "panel-footer";
    const undo = document.createElement("button");
    undo.textContent = "Undo";
    undo.addEventListener("click", () => getContext()?.project.undo());
    const redo = document.createElement("button");
    redo.textContent = "Redo";
    redo.addEventListener("click", () => getContext()?.project.redo());
    footer.append(undo, redo);
    body.append(footer);
  }

  for (const tab of TABS) {
    const button = document.createElement("button");
    button.textContent = tab.label;
    button.dataset["tab"] = tab.id;
    button.addEventListener("click", () => renderTab(tab));
    tabBar.append(button);
  }
  renderTab(TABS[0]!);
}

/** Reset toggle highlights when a new file loads (fresh project, fresh stacks). */
export function resetPanel(root: HTMLElement, getContext: () => PanelContext | undefined): void {
  root.innerHTML = "";
  initPanel(root, getContext);
}
