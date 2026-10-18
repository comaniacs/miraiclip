---
title: Player
weight: 11
---

`@miraiclip/player` is a web component for showing finished videos on any page — help centres, landing pages, docs — with **chapters**. It plays either a rendered file or a live project document, and needs no framework.

```html
<script type="module">import "@miraiclip/player/define";</script>

<miraiclip-player src="launch.mp4" chapters="launch.chapters.vtt" controls></miraiclip-player>
<miraiclip-player document="video.miraiclip.json" controls></miraiclip-player>
```

## Sources

- **`src`** — an MP4/WebM URL, played by the browser's own video element.
- **`document`** — a project JSON URL, played live by the Miraiclip renderer (WebCodecs + WebGL). Relative asset paths resolve against the document's URL, or `assets-base`. Set the `.document` property to pass a document object instead. Add the `plugins` attribute to load the document's [plugins](../rendering/extensibility#plugins-custom-kinds-everywhere). Live playback loads `@miraiclip/core` and `@miraiclip/renderer` on demand, so a page that only plays files never downloads them.

## Chapters

With a live document, the chapters are the document's [markers](../core-concepts/markers): each runs for its `durationUs`, or until the next marker. For a file, point `chapters` at a WebVTT chapters file or a JSON list (`[{ "label": "Intro", "start": 0 }, …]`, seconds), or set the `.chapters` property. Chapters show as ticks on the scrubber, the current chapter's name beside it, and a chapter menu.

## Attributes, properties, events

| Attribute | |
| --- | --- |
| `controls` | show the control bar |
| `autoplay`, `loop`, `muted` | as on `<video>` |
| `poster` | file mode: image shown before playback |
| `assets-base` | live mode: base URL for relative asset paths |
| `plugins` | live mode: load the document's plugins |

Properties and methods: `play()`, `pause()`, `toggle()`, `seek(seconds)`, `currentTime`, `duration`, `paused`, `chapters`, `goToChapter(idOrIndex)`, `document`.

Events: `ready`, `play`, `pause`, `timeupdate`, `chapterchange` (`detail.chapter`), `ended`, `error` (`detail.message`).

Keyboard (when focused): Space/K play and pause, ←/→ (J/L) seek 5 s (Shift: 10 s), Home/End, `[` / `]` previous/next chapter.

Theme it with CSS custom properties on the element — `--mc-accent`, `--mc-bg`, `--mc-fg`, `--mc-radius`, `--mc-font` — or style its parts: `::part(frame)`, `::part(controls)`, `::part(scrubber)`, `::part(chapters)`, `::part(media)`.
