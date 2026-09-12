/**
 * Caption layout + karaoke timing — pure math, headless-testable. The Pixi
 * caption node is a thin shell over these functions (same pattern as
 * effects/params.ts): measurement comes in as a function, positions go out
 * as data.
 */
import type { CaptionWord, Us } from "@miraiclip/core";

export interface CaptionProgress {
  /** Index of the word containing `t`, or -1 (gaps, before/after the words). */
  activeIndex: number;
  /** How many words have STARTED by `t` — karaoke's progressive fill. */
  startedCount: number;
}

/** Word timing at a clip-relative time. Words are sorted by startUs (core sorts on add). */
export function captionProgress(words: readonly CaptionWord[], clipTimeUs: Us): CaptionProgress {
  let activeIndex = -1;
  let startedCount = 0;
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    if (word.startUs > clipTimeUs) break;
    startedCount = i + 1;
    if (clipTimeUs < word.startUs + word.durationUs) activeIndex = i;
  }
  return { activeIndex, startedCount };
}

export interface WordAppearance {
  highlighted: boolean;
  /** Render scale of the word (pop enlarges the active word in place). */
  scale: number;
}

/** How the pop preset enlarges the active word. */
export const POP_SCALE = 1.18;

/** What a word looks like under a style preset, given the current progress. */
export function wordAppearance(
  preset: "plain" | "highlight" | "karaoke" | "pop",
  wordIndex: number,
  progress: CaptionProgress,
): WordAppearance {
  switch (preset) {
    case "plain":
      return { highlighted: false, scale: 1 };
    case "highlight":
      return { highlighted: wordIndex === progress.activeIndex, scale: 1 };
    case "karaoke":
      // Progressive: every word that has started stays lit.
      return { highlighted: wordIndex < progress.startedCount, scale: 1 };
    case "pop": {
      const active = wordIndex === progress.activeIndex;
      return { highlighted: active, scale: active ? POP_SCALE : 1 };
    }
  }
}

export interface CaptionLayoutOptions {
  /** Wrap width: words flow into lines no wider than this. */
  maxWidthPx: number;
  lineHeightPx: number;
  spaceWidthPx: number;
  /** Measured width of one word at the render font size. */
  measure: (wordIndex: number) => number;
}

export interface CaptionLayout {
  /** Per-word CENTER positions, relative to the block's center (anchor 0.5). */
  positions: { xPx: number; yPx: number }[];
  widthPx: number;
  heightPx: number;
}

/**
 * Greedy word wrap with per-line centering. Positions are word centers
 * relative to the BLOCK center, so a node anchored at 0.5 places the whole
 * block on the clip's transform position.
 */
export function layoutCaption(
  words: readonly CaptionWord[],
  options: CaptionLayoutOptions,
): CaptionLayout {
  interface Line {
    indices: number[];
    widthPx: number;
  }
  const lines: Line[] = [];
  let current: Line = { indices: [], widthPx: 0 };
  for (let i = 0; i < words.length; i++) {
    const wordWidth = options.measure(i);
    const extra = current.indices.length === 0 ? wordWidth : options.spaceWidthPx + wordWidth;
    if (current.indices.length > 0 && current.widthPx + extra > options.maxWidthPx) {
      lines.push(current);
      current = { indices: [i], widthPx: wordWidth };
    } else {
      current.indices.push(i);
      current.widthPx += extra;
    }
  }
  if (current.indices.length > 0) lines.push(current);

  const widthPx = Math.max(0, ...lines.map((line) => line.widthPx));
  const heightPx = lines.length * options.lineHeightPx;
  const positions: { xPx: number; yPx: number }[] = words.map(() => ({ xPx: 0, yPx: 0 }));
  lines.forEach((line, lineIndex) => {
    // Line centered in the block; word centers accumulate left → right.
    let x = -line.widthPx / 2;
    const y = (lineIndex + 0.5) * options.lineHeightPx - heightPx / 2;
    for (const wordIndex of line.indices) {
      const wordWidth = options.measure(wordIndex);
      positions[wordIndex] = { xPx: x + wordWidth / 2, yPx: y };
      x += wordWidth + options.spaceWidthPx;
    }
  });
  return { positions, widthPx, heightPx };
}
