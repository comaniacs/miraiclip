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

## Use your own font

Register a font asset; caption and text clips reference its `family`. It loads as a real FontFace before anything renders — including the first frame of a server export:

```ts
project.dispatch({
  type: "asset/add",
  payload: { id: "brand-font", kind: "font", src: "/fonts/Inter-Bold.woff2", family: "Inter" },
});
// then: style: { preset: "pop", fontFamily: "Inter" }
```

## Style reference

| Field | Meaning | Default |
| --- | --- | --- |
| `preset` | Emphasis behavior (table above) | `highlight` |
| `fontFamily` | CSS family (a font asset's `family`, or a system font) | `sans-serif` |
| `fontSizeFrac` | Font size as a fraction of composition height | 0.06 |
| `color` | Base word color | `#ffffff` |
| `highlightColor` | Emphasized word color | `#ffd400` |
| `backgroundColor` | Optional rounded box behind the block | — |

## Good to know

- `fontSizeFrac` keeps captions identical between a scaled preview and a full-resolution export.
- Update a caption's style later with `clip/set-property` (`style` merges partially).
- Full payload schemas: [command catalog](../../command-catalog).
