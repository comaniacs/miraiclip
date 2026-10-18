/**
 * Drawing on the page while recording: pen, highlighter, arrow and box, in a
 * few colours, on a transparent layer over the page (so it is in the screen
 * video). Marks fade out on their own a few seconds after you draw them,
 * unless fading is off. Undo with Ctrl/Cmd+Z, leave with Esc.
 *
 * The layer and its palette live in the recorder's shadow root, so the event
 * log ignores the pointer while you draw.
 */
import { icons } from "./ui/icons.js";

export type DrawTool = "pen" | "highlighter" | "arrow" | "box";
export interface DrawPrefs {
  tool: DrawTool;
  color: string;
  fade: boolean;
}
export const DRAW_DEFAULTS: DrawPrefs = { tool: "pen", color: "#ff3d4a", fade: true };
export const COLORS = ["#ff3d4a", "#ffd23f", "#3ddc97", "#4c8dff", "#ffffff"];

/** How long a mark stays before it starts to fade, and how long the fade takes (ms). */
const HOLD = 2800;
const FADE = 700;

interface Point {
  x: number;
  y: number;
}
interface Mark {
  tool: DrawTool;
  color: string;
  points: Point[];
  /** When it was finished (it fades from then); undefined while being drawn. */
  doneAt?: number;
}

export interface DrawLayer {
  readonly open: boolean;
  /** Show the layer and its palette, next to `anchor` (the draw button). */
  show(anchor: DOMRect): void;
  /** Hide the layer and wipe it. */
  hide(): void;
  clear(): void;
  undo(): void;
  destroy(): void;
}

export function createDrawLayer(parent: HTMLElement, prefs: DrawPrefs, onPrefs: (p: DrawPrefs) => void, onClose: () => void): DrawLayer {
  const canvas = document.createElement("canvas");
  canvas.className = "draw-layer";
  canvas.hidden = true;
  const palette = document.createElement("div");
  palette.className = "draw-palette";
  palette.hidden = true;
  palette.setAttribute("role", "toolbar");
  palette.setAttribute("aria-label", "Drawing tools");
  const tool = (t: DrawTool, label: string) => `<button data-tool="${t}" aria-label="${label}" data-tip="${label}">${icons[t]}</button>`;
  palette.innerHTML = `
    ${tool("pen", "Pen")}${tool("highlighter", "Highlighter")}${tool("arrow", "Arrow")}${tool("box", "Box")}
    <span class="dsep"></span>
    ${COLORS.map((c) => `<button class="swatch" data-color="${c}" aria-label="Colour ${c}" style="--c:${c}"></button>`).join("")}
    <span class="dsep"></span>
    <button data-act="fade" aria-label="Fade marks" data-tip="Fade marks after a few seconds">${icons.fade}</button>
    <button data-act="undo" aria-label="Undo" data-tip="Undo (Ctrl+Z)">${icons.undo}</button>
    <button data-act="clear" aria-label="Clear" data-tip="Clear all">${icons.eraser}</button>
    <button data-act="close" aria-label="Stop drawing" data-tip="Stop drawing (Esc)">${icons.close}</button>`;
  parent.append(canvas, palette);
  const ctx = canvas.getContext("2d")!;

  let marks: Mark[] = [];
  let current: Mark | undefined;
  let raf = 0;
  let open = false;

  const sync = () => {
    palette.querySelectorAll<HTMLElement>("[data-tool]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === prefs.tool)));
    palette.querySelectorAll<HTMLElement>("[data-color]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.color === prefs.color)));
    palette.querySelector<HTMLElement>('[data-act="fade"]')!.setAttribute("aria-pressed", String(prefs.fade));
    canvas.style.cursor = prefs.tool === "highlighter" ? "cell" : "crosshair";
  };
  const set = (patch: Partial<DrawPrefs>) => {
    prefs = { ...prefs, ...patch };
    sync();
    onPrefs(prefs);
  };

  function size() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  }

  // ── Painting ──────────────────────────────────────────────────
  function strokePath(points: Point[]) {
    ctx.beginPath();
    const [first] = points;
    if (!first) return;
    ctx.moveTo(first.x, first.y);
    if (points.length === 1) ctx.lineTo(first.x + 0.1, first.y);
    // Smooth: curves through the midpoints between samples.
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i]!;
      const n = points[i + 1]!;
      ctx.quadraticCurveTo(p.x, p.y, (p.x + n.x) / 2, (p.y + n.y) / 2);
    }
    const last = points[points.length - 1]!;
    if (points.length > 1) ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  function drawMark(m: Mark, alpha: number) {
    const a = m.points[0];
    const b = m.points[m.points.length - 1];
    if (!a || !b) return;
    ctx.save();
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.strokeStyle = m.color;
    // A dark halo keeps light colours readable on light pages (and the reverse).
    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.shadowBlur = m.tool === "highlighter" ? 0 : 3;
    ctx.globalAlpha = alpha * (m.tool === "highlighter" ? 0.35 : 1);
    ctx.lineWidth = m.tool === "highlighter" ? 22 : 4.5;
    if (m.tool === "pen" || m.tool === "highlighter") strokePath(m.points);
    else if (m.tool === "box") {
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      ctx.beginPath();
      ctx.roundRect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y), 10);
      ctx.stroke();
    } else {
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const head = Math.min(22, Math.hypot(b.x - a.x, b.y - a.y) * 0.45);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.moveTo(b.x - head * Math.cos(angle - 0.5), b.y - head * Math.sin(angle - 0.5));
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(b.x - head * Math.cos(angle + 0.5), b.y - head * Math.sin(angle + 0.5));
      ctx.stroke();
    }
    ctx.restore();
  }

  function paint() {
    cancelAnimationFrame(raf);
    raf = 0;
    const now = performance.now();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let fading = false;
    marks = marks.filter((m) => !prefs.fade || m.doneAt === undefined || now - m.doneAt < HOLD + FADE);
    for (const m of [...marks, ...(current ? [current] : [])]) {
      let alpha = 1;
      if (prefs.fade && m.doneAt !== undefined) {
        const age = now - m.doneAt;
        if (age > HOLD) alpha = 1 - (age - HOLD) / FADE;
        fading = true;
      }
      drawMark(m, Math.max(0, alpha));
    }
    // Keep animating while anything is fading out.
    if (fading) raf = requestAnimationFrame(paint);
  }

  // ── Pointer ───────────────────────────────────────────────────
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    current = { tool: prefs.tool, color: prefs.color, points: [{ x: e.clientX, y: e.clientY }] };
    paint();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!current) return;
    const p = { x: e.clientX, y: e.clientY };
    // Shapes keep their start and the latest point; free strokes keep every sample.
    if (current.tool === "arrow" || current.tool === "box") current.points = [current.points[0]!, p];
    else current.points.push(p);
    paint();
  });
  const end = () => {
    if (!current) return;
    current.doneAt = performance.now();
    marks.push(current);
    current = undefined;
    paint();
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  palette.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("button");
    if (!b) return;
    if (b.dataset.tool) set({ tool: b.dataset.tool as DrawTool });
    else if (b.dataset.color) set({ color: b.dataset.color });
    else if (b.dataset.act === "fade") {
      // Turning fading on starts the clock for marks already there.
      const now = performance.now();
      if (!prefs.fade) marks.forEach((m) => (m.doneAt = now));
      set({ fade: !prefs.fade });
      paint();
    } else if (b.dataset.act === "undo") layer.undo();
    else if (b.dataset.act === "clear") layer.clear();
    else if (b.dataset.act === "close") onClose();
  });

  const onKey = (e: KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.stopPropagation();
      layer.undo();
    }
  };

  const layer: DrawLayer = {
    get open() {
      return open;
    },
    show(anchor) {
      if (open) return;
      open = true;
      sync();
      size();
      canvas.hidden = false;
      palette.hidden = false;
      // Beside the draw button, kept on screen.
      const h = palette.offsetHeight || 44;
      palette.style.left = `${anchor.right + 10}px`;
      palette.style.top = `${Math.max(8, Math.min(window.innerHeight - h - 8, anchor.top + anchor.height / 2 - h / 2))}px`;
      window.addEventListener("resize", size);
      window.addEventListener("keydown", onKey, true);
    },
    hide() {
      if (!open) return;
      open = false;
      layer.clear();
      canvas.hidden = true;
      palette.hidden = true;
      window.removeEventListener("resize", size);
      window.removeEventListener("keydown", onKey, true);
    },
    clear() {
      marks = [];
      current = undefined;
      paint();
    },
    undo() {
      marks.pop();
      paint();
    },
    destroy() {
      layer.hide();
      cancelAnimationFrame(raf);
      canvas.remove();
      palette.remove();
    },
  };
  return layer;
}
