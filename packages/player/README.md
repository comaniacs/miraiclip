# @miraiclip/player

`<miraiclip-player>`: a framework-free web component that plays a rendered video file or a live [Miraiclip](https://docs.miraiclip.com/) project, with a scrubber, chapters and keyboard control.

```html
<script type="module">import "@miraiclip/player/define";</script>

<!-- a rendered file, chapters from a WebVTT (or JSON) file -->
<miraiclip-player src="launch.mp4" chapters="launch.chapters.vtt" controls></miraiclip-player>

<!-- a live document: chapters come from its markers -->
<miraiclip-player document="video.miraiclip.json" controls></miraiclip-player>
```

Live documents need `@miraiclip/core` and `@miraiclip/renderer` installed (loaded on demand; file playback needs neither). Docs: https://docs.miraiclip.com/
