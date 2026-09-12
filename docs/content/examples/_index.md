---
title: Examples
layout: hextra-home
---

<div class="mirai-band">
<div class="mirai-band-inner">

## Live examples

Every example on this page runs **live in your browser** against the real engine — the code you see is exactly what executes. Each one starts from the scaffold the playground uses: a demo clip `main` on track `v1`, an empty `overlay` track above it, and `project`, `player`, and `miraiclip` (export helpers) in scope. Press **Run**, then flip through the variants — each switch runs live.

Requires WebCodecs (Chrome/Edge 94+, Safari 16.4+, Firefox 130+). Demo footage: [Big Buck Bunny](https://peach.blender.org/) © 2008 Blender Foundation — [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/).

</div>
</div>

<div class="mirai-band">
<div class="mirai-band-inner">

## Animation

Keyframe any clip property — `x`, `y`, `scale`, `rotation`, `opacity`, `volume` — with easings. Times are clip-relative microseconds, and exports inherit every keyframe.

{{< example-group >}}
{{< example-variant name="Fade in" >}}
project.dispatch({ type: "keyframe/set", payload: { clipId: "main", property: "opacity", timeUs: 0, value: 0, easing: "easeOut" } });
project.dispatch({ type: "keyframe/set", payload: { clipId: "main", property: "opacity", timeUs: 1_500_000, value: 1 } });
{{< /example-variant >}}
{{< example-variant name="Slow zoom" >}}
project.dispatch({ type: "keyframe/set", payload: { clipId: "main", property: "scale", timeUs: 0, value: 1 } });
project.dispatch({ type: "keyframe/set", payload: { clipId: "main", property: "scale", timeUs: 6_000_000, value: 1.25 } });
{{< /example-variant >}}
{{< example-variant name="Slide in" >}}
project.dispatch({ type: "keyframe/set", payload: { clipId: "main", property: "x", timeUs: 0, value: -0.4, easing: "easeOut" } });
project.dispatch({ type: "keyframe/set", payload: { clipId: "main", property: "x", timeUs: 1_200_000, value: 0.5 } });
{{< /example-variant >}}
{{< example-variant name="Bounce (custom bézier)" >}}
// Presets are sugar for cubic béziers — overshoot curves are first-class:
project.dispatch({ type: "keyframe/set", payload: { clipId: "main", property: "scale", timeUs: 0, value: 0.4,
  easing: { kind: "bezier", x1: 0.34, y1: 1.56, x2: 0.64, y2: 1 } } });
project.dispatch({ type: "keyframe/set", payload: { clipId: "main", property: "scale", timeUs: 1_200_000, value: 1 } });
{{< /example-variant >}}
{{< /example-group >}}

</div>
</div>

<div class="mirai-band">
<div class="mirai-band-inner">

## Effects

Per-clip GPU effect stacks: `colorAdjust`, `blur`, and `chromaKey` built in. Params are validated by schema, update in place (no shader recompiles), and length params are composition-relative — preview and export look identical.

{{< example-group >}}
{{< example-variant name="Grayscale" >}}
project.dispatch({ type: "effect/add", payload: { clipId: "main", kind: "colorAdjust", params: { saturation: -1 } } });
{{< /example-variant >}}
{{< example-variant name="Punchy" >}}
project.dispatch({ type: "effect/add", payload: { clipId: "main", kind: "colorAdjust", params: { contrast: 0.3, saturation: 0.4 } } });
{{< /example-variant >}}
{{< example-variant name="Warm shift" >}}
project.dispatch({ type: "effect/add", payload: { clipId: "main", kind: "colorAdjust", params: { hue: -20, brightness: 0.08 } } });
{{< /example-variant >}}
{{< example-variant name="Blur" >}}
// amount is a fraction of composition height — resolution-independent:
project.dispatch({ type: "effect/add", payload: { clipId: "main", kind: "blur", params: { amount: 0.03 } } });
{{< /example-variant >}}
{{< example-variant name="Chroma key" media="green" >}}
// Defaults key #00ff00 — the green screen becomes transparent:
project.dispatch({ type: "effect/add", payload: { clipId: "main", kind: "chromaKey" } });
{{< /example-variant >}}
{{< /example-group >}}

</div>
</div>

<div class="mirai-band">
<div class="mirai-band-inner">

## Transitions

Bridge a cut between adjacent clips — the window is centered on the cut, draws from source headroom, and every kind applies an equal-power audio crossfade. A fresh `clip/split` always has the headroom a transition needs.

{{< example-group >}}
{{< example-variant name="Cross dissolve" >}}
project.transaction(() => {
  project.dispatch({ type: "clip/split", payload: { clipId: "main", atUs: 3_000_000, newClipId: "second" } });
  // Jump the incoming side 1.5s ahead so there's a visible cut to bridge:
  project.dispatch({ type: "clip/trim", payload: { clipId: "second", trimStartUs: 4_500_000, durationUs: 1_500_000 } });
  project.dispatch({ type: "transition/add", payload: { kind: "crossDissolve", fromClipId: "main", toClipId: "second", durationUs: 800_000 } });
});
{{< /example-variant >}}
{{< example-variant name="Dip to black" >}}
project.transaction(() => {
  project.dispatch({ type: "clip/split", payload: { clipId: "main", atUs: 3_000_000, newClipId: "second" } });
  project.dispatch({ type: "transition/add", payload: { kind: "dipToBlack", fromClipId: "main", toClipId: "second", durationUs: 900_000 } });
});
{{< /example-variant >}}
{{< example-variant name="Dip to white" >}}
project.transaction(() => {
  project.dispatch({ type: "clip/split", payload: { clipId: "main", atUs: 3_000_000, newClipId: "second" } });
  project.dispatch({ type: "transition/add", payload: { kind: "dipToWhite", fromClipId: "main", toClipId: "second", durationUs: 900_000 } });
});
{{< /example-variant >}}
{{< example-variant name="Wipe" >}}
project.transaction(() => {
  project.dispatch({ type: "clip/split", payload: { clipId: "main", atUs: 3_000_000, newClipId: "second" } });
  project.dispatch({ type: "clip/trim", payload: { clipId: "second", trimStartUs: 4_500_000, durationUs: 1_500_000 } });
  project.dispatch({ type: "transition/add", payload: { kind: "wipe", fromClipId: "main", toClipId: "second", durationUs: 800_000, params: { direction: "right" } } });
});
{{< /example-variant >}}
{{< example-variant name="Slide" >}}
project.transaction(() => {
  project.dispatch({ type: "clip/split", payload: { clipId: "main", atUs: 3_000_000, newClipId: "second" } });
  project.dispatch({ type: "clip/trim", payload: { clipId: "second", trimStartUs: 4_500_000, durationUs: 1_500_000 } });
  project.dispatch({ type: "transition/add", payload: { kind: "slide", fromClipId: "main", toClipId: "second", durationUs: 800_000, params: { direction: "left" } } });
});
{{< /example-variant >}}
{{< /example-group >}}

</div>
</div>

<div class="mirai-band">
<div class="mirai-band-inner">

## Captions

Reels-style karaoke text with word-level timing. Four presets drive how the current word is emphasized — or import an SRT/VTT file or ASR word timestamps and get these clips generated for you.

{{< example-group >}}
{{< example-variant name="Karaoke" >}}
project.dispatch({
  type: "clip/add",
  payload: {
    kind: "caption", id: "cap-1", trackId: "overlay", startUs: 0, durationUs: 6_000_000,
    words: ["made", "with", "miraiclip", "in", "the", "browser"].map((text, i) => ({
      text, startUs: i * 1_000_000, durationUs: 1_000_000,
    })),
    style: { preset: "karaoke", fontSizeFrac: 0.09, highlightColor: "#ffd400" },
    transform: { y: 0.78 },
  },
});
{{< /example-variant >}}
{{< example-variant name="Highlight" >}}
project.dispatch({
  type: "clip/add",
  payload: {
    kind: "caption", id: "cap-1", trackId: "overlay", startUs: 0, durationUs: 6_000_000,
    words: ["only", "the", "current", "word", "lights", "up"].map((text, i) => ({
      text, startUs: i * 1_000_000, durationUs: 1_000_000,
    })),
    style: { preset: "highlight", fontSizeFrac: 0.09, highlightColor: "#7ad7ff" },
    transform: { y: 0.78 },
  },
});
{{< /example-variant >}}
{{< example-variant name="Pop" >}}
project.dispatch({
  type: "clip/add",
  payload: {
    kind: "caption", id: "cap-1", trackId: "overlay", startUs: 0, durationUs: 6_000_000,
    words: ["the", "active", "word", "grows", "and", "lights"].map((text, i) => ({
      text, startUs: i * 1_000_000, durationUs: 1_000_000,
    })),
    style: { preset: "pop", fontSizeFrac: 0.09, highlightColor: "#ff9d5c" },
    transform: { y: 0.78 },
  },
});
{{< /example-variant >}}
{{< example-variant name="Boxed" >}}
project.dispatch({
  type: "clip/add",
  payload: {
    kind: "caption", id: "cap-1", trackId: "overlay", startUs: 0, durationUs: 6_000_000,
    words: ["a", "rounded", "box", "behind", "the", "block"].map((text, i) => ({
      text, startUs: i * 1_000_000, durationUs: 1_000_000,
    })),
    style: { preset: "karaoke", fontSizeFrac: 0.07, backgroundColor: "#000000b0" },
    transform: { y: 0.8 },
  },
});
{{< /example-variant >}}
{{< /example-group >}}

</div>
</div>

<div class="mirai-band">
<div class="mirai-band-inner">

## Export to a file

The same composition rendered offline — encoded by your browser, faster than realtime. Grade it, export three seconds, and the download lands with the effect baked in.

{{% example %}}
project.dispatch({ type: "effect/add", payload: { clipId: "main", kind: "colorAdjust", params: { saturation: -1 } } });

const bytes = await miraiclip.exportProject(project, {
  format: "mp4", quality: "standard",
  range: { startUs: 0, endUs: 3_000_000 },
  onProgress: ({ framesDone, totalFrames }) => miraiclip.status(`exporting ${framesDone}/${totalFrames}`),
});
miraiclip.status(`exported ${(bytes.byteLength / 1024).toFixed(0)} KB`);
miraiclip.download(bytes, "miraiclip-example.mp4");
{{% /example %}}

</div>
</div>

<div class="mirai-band">
<div class="mirai-band-inner">

## Where to next

These commands are the whole API. The [Rendering guide](../docs/rendering) covers each feature in depth — including [bringing your own clip kind](../docs/rendering#bring-your-own-clip-kind) — and the [command catalog](../docs/command-catalog) lists every payload schema. The repo's [playground](https://github.com/comaniacs/miraiclip/tree/main/apps/playground) is the same thing at full size.

</div>
</div>

{{< example-runtime >}}
