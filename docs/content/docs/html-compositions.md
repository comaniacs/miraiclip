---
title: HTML Compositions
weight: 12
---

`@miraiclip/html-composition` reads and writes **data-attribute HTML compositions**: a plain HTML page whose elements carry their own timing. Agents and other tools often write video this way, because a page is easy to generate. Importing one gives you a real Miraiclip document — editable with commands, undoable, previewable and exportable in the browser or on a server.

```html
<div data-composition-id="launch" data-start="0" data-duration="8" data-width="1920" data-height="1080" style="background:#0a0d18">
  <video id="shot" data-start="0" data-duration="5" data-track-index="0" data-media-start="2" src="demo.mp4" muted></video>
  <div id="title" class="title" data-start="0.5" data-duration="3" data-track-index="1">Ship faster</div>
  <div id="cta" data-start="title + 0.5" data-duration="3" data-track-index="1">Try it free</div>
  <audio id="music" data-start="0" data-duration="8" data-track-index="2" data-volume="0.4" src="music.mp3"></audio>
</div>
```

```ts
import { importHtmlComposition } from "@miraiclip/html-composition";
import { createProject } from "@miraiclip/core";

const { doc, warnings } = importHtmlComposition(html, { mediaDurationsUs: { "demo.mp4": 12_000_000 } });
const project = createProject(doc);
```

## How elements map

| Element | Becomes |
| --- | --- |
| root (`data-composition-id`, `data-width`, `data-height`, `data-duration`, `data-fps`) | the project settings; the root's own style and untimed children become one background html clip |
| `<video>` | a video asset and clip — `data-media-start` is the trim, `muted` means volume 0 (sound comes from a separate `<audio>`) |
| `<audio>` | an audio asset and clip on an audio track — `data-volume` is the volume |
| `<img>` | an image clip, or an html clip when it is styled (to keep its CSS layout) |
| anything else | an html clip: the element's markup plus the page's `<style>`, rasterized at the composition size — CSS layout, fonts and `@keyframes` carry over |

`data-start` takes seconds or `"<id>"` / `"<id> + 2"` (that many seconds after the clip with that id ends). `data-track-index` 0 is the bottom layer. Media without a `data-duration` uses `mediaDurationsUs` when given, otherwise the rest of the composition. Markup is re-serialized as well-formed XHTML for the rasterizer; images inside html clips become `asset:` references.

Not carried over, and listed in `warnings`: script-driven timelines (scripts aren't run — CSS animations are), nested compositions (`data-composition-src`: import them separately) and start times that don't resolve.

## Export

`exportHtmlComposition(doc)` writes the document back out as one HTML page in the same format: video, audio and image clips as media elements (video sound as a separate `<audio>`), html clips as their substituted markup, text clips as styled divs, track order as `data-track-index` and `z-index`. Keyframes, effects, transitions, speed and caption clips have no equivalent and are listed in `warnings`. `assetUrl(asset)` maps assets to the URLs the page should load.
