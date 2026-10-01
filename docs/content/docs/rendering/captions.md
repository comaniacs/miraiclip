---
title: Captions
weight: 4
---

Reels-style karaoke captions: a `caption` clip carries word-level timing, renders as a word-wrapped centered block, and the style preset drives how the current word is emphasized.

## Add a caption

Word times are relative to the clip's start:

```ts
project.dispatch({
  type: "clip/add",
  payload: {
    kind: "caption", id: "cap-1", trackId: "overlay",
    startUs: 2_000_000, durationUs: 1_800_000,
    words: [
      { text: "made", startUs: 0, durationUs: 600_000 },
      { text: "with", startUs: 600_000, durationUs: 600_000 },
      { text: "miraiclip", startUs: 1_200_000, durationUs: 600_000 },
    ],
    style: { preset: "karaoke", highlightColor: "#ffd400" },
    transform: { y: 0.8 }, // captions usually sit low in the frame
  },
});
```

## Import subtitles or a transcript

The importers return ordinary `clip/add` commands — an import is just a transaction:

```ts
import { captionClipsFromSubtitles, captionClipsFromAsrWords } from "@miraiclip/core";

// SRT or VTT text (words get an even split across each cue):
const commands = captionClipsFromSubtitles(srtText, { trackId: "overlay", style: { preset: "karaoke" } });

// Whisper-style word timestamps (true karaoke timing, grouped on silence gaps):
// const commands = captionClipsFromAsrWords(asrWords, { trackId: "overlay" });

project.transaction(() => commands.forEach((command) => project.dispatch(command)));
```

## Presets

| Preset | Look |
| --- | --- |
| `plain` | No emphasis |
| `highlight` | Only the current word takes `highlightColor` |
| `karaoke` | Words stay lit once passed — the reels look (default) |
| `pop` | The current word lights **and** enlarges in place |
| `reveal` | Words appear as they are spoken; the newest takes `highlightColor` |

Set `display: "word"` with any preset for **word-by-word** captions: only the current word shows, centered, and it holds through pauses.

## Edit and export a transcript

```ts
import { captionsToSrt, captionsToVtt, captionsToText, retimeWords } from "@miraiclip/core";

// Fix a caption's text: same word count keeps each word's timing; otherwise the words split the span evenly.
const words = retimeWords(clip.words, "the corrected sentence", clip.durationUs);
project.dispatch({ type: "clip/set-property", payload: { clipId: clip.id, words } });

// Export every caption clip (one cue per clip, timeline order).
const srt = captionsToSrt(captionClips); // also captionsToVtt, captionsToText
```

## Use your own font

Register a font asset; caption and text clips reference its `family`. It loads as a real FontFace before anything renders — including the first frame of a server export:

```ts
project.dispatch({
  type: "asset/add",
  payload: { id: "brand-font", kind: "font", src: "/fonts/Inter-Bold.woff2", family: "Inter" },
});
// then: style: { preset: "pop", fontFamily: "Inter" }
```

For a **variable** font, declare its weight axis with `weightRange: [100, 900]` instead of `weight`: every `fontWeight` then renders from the font's own axis rather than a synthesized bold.

## Style reference

| Field | Meaning | Default |
| --- | --- | --- |
| `preset` | Emphasis behavior (table above) | `highlight` |
| `fontFamily` | CSS family (a font asset's `family`, or a system font) | `sans-serif` |
| `fontSizeFrac` | Font size as a fraction of composition height | 0.06 |
| `color` | Base word color | `#ffffff` |
| `highlightColor` | Emphasized word color | `#ffd400` |
| `backgroundColor` | Optional rounded box behind the block (or the word, with `display: "word"`) | — |
| `display` | `block` (whole clip) or `word` (current word only) | `block` |
| `textTransform` | `uppercase` / `lowercase` when drawing (the words keep their text) | — |
| `strokeColor` / `strokeWidthFrac` | Outline; width as a fraction of font size | — / 0.08 |
| `shadowColor` / `shadowBlurFrac` / `shadowOffsetFrac` | Drop shadow; offset 0 makes a glow. Fractions of font size | — / 0.15 / 0.06 |
| `activeBackgroundColor` | Rounded box behind each emphasized word (`highlightColor` is then the text color on it) | — |
| `fontWeight` / `fontStyle` / `letterSpacing` / `lineHeight` | Typography | font defaults |

Every optional field accepts `null` in `clip/set-property` to clear it — switching from a boxed style to an outlined one never leaves a stale box.

## Customizing the look

The preset set is fixed (`plain`/`highlight`/`karaoke`/`pop`/`reveal`), but everything around it is yours: colors, outline, shadow, case, word-by-word display, background and active-word boxes, `fontSizeFrac`, any loaded `fontFamily`, the block position via `transform`, and the word timing itself (hand-written, SRT/VTT, or real ASR timestamps). For a look the presets can't produce, caption words are ordinary data — an app can also build its own treatment as a [custom clip kind](../#bring-your-own-clip-kind).

## Good to know

- `fontSizeFrac` keeps captions identical between a scaled preview and a full-resolution export.
- Update a caption's style later with `clip/set-property` (`style` merges partially).
- Full payload schemas: [command catalog](../../command-catalog).
