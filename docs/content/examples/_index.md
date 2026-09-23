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

Keyframe any clip property — `x`, `y`, `scale`, `rotation`, `opacity`, `volume` — with easings. Times are clip-relative microseconds, and exports inherit every keyframe. And when keyframes aren't enough, a [custom clip kind](../docs/rendering/extensibility) animates itself in code, every frame.

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
{{< example-variant name="Custom (code-driven)" >}}
// When keyframes aren't enough: a custom CLIP KIND animates itself in code.
// Its node gets tick(clip, timeUs) every frame — here, typewriter text:
miraiclip.registerClipKind("typewriter",
  { propsSchema: miraiclip.z.object({ text: miraiclip.z.string(), charsPerSec: miraiclip.z.number().default(12) }),
    trackKinds: ["video"] },
  (clip, { backend }) => {
    const textOf = (n) => ({ ...clip, kind: "text", text: clip.props.text.slice(0, n), fontFamily: "sans-serif", fontSizePx: 40, color: "#ffffff" });
    const inner = backend.createText(textOf(0));
    let shown = 0;
    return {
      setPlacement: (p) => inner.setPlacement(p),
      setVisible: (v) => inner.setVisible(v),
      setZ: (z) => inner.setZ(z),
      update: () => {},
      tick: (clip, timeUs) => {
        const n = Math.floor(((timeUs - clip.startUs) / 1_000_000) * clip.props.charsPerSec);
        if (n !== shown) { shown = n; inner.update(textOf(n)); }
      },
      destroy: () => inner.destroy(),
    };
  });
project.dispatch({ type: "clip/add", payload: {
  kind: "typewriter", id: "type-1", trackId: "overlay", startUs: 0, durationUs: 6_000_000,
  props: { text: "Every frame is code…", charsPerSec: 8 },
} });
{{< /example-variant >}}
{{< /example-group >}}

</div>
</div>

<div class="mirai-band">
<div class="mirai-band-inner">

## Effects

Per-clip GPU effect stacks: `colorAdjust`, `blur`, and `chromaKey` built in — and [your own kinds](../docs/rendering/extensibility), registered through the same contract. Params are validated by schema, update in place (no shader recompiles), and length params are composition-relative — preview and export look identical.

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
{{< example-variant name="Custom kind" >}}
// Register your own effect kind — schema in core, filter in the renderer —
// then it's a first-class citizen: validated, undoable, exported.
if (!miraiclip.getEffectRenderer("sepia")) {
  miraiclip.registerEffectKind("sepia",
    miraiclip.z.object({ amount: miraiclip.z.number().min(0).max(1).default(1) }));
  miraiclip.registerEffectRenderer("sepia", (params) => {
    const filter = new miraiclip.pixi.ColorMatrixFilter();
    const apply = (p) => { filter.reset(); filter.sepia(true); filter.alpha = p.amount ?? 1; };
    apply(params);
    return { kind: "sepia", filter, update: apply }; // update mutates in place
  });
}
project.dispatch({ type: "effect/add", payload: { clipId: "main", kind: "sepia", params: { amount: 0.9 } } });
{{< /example-variant >}}
{{< /example-group >}}

</div>
</div>

<div class="mirai-band">
<div class="mirai-band-inner">

## Transitions

Bridge a cut between adjacent clips — the window is centered on the cut, draws from source headroom, and every kind applies an equal-power audio crossfade. A fresh `clip/split` always has the headroom a transition needs. [Custom kinds](../docs/rendering/extensibility) register through the same contract the built-ins use.

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
{{< example-variant name="Custom kind" >}}
// A custom transition is pure math over progress (0 → 1, the cut at 0.5).
// This "flash" burns white over the cut — an overlay kind, like the dips:
if (!miraiclip.getTransitionRenderer("flash")) {
  miraiclip.registerTransitionKind("flash", miraiclip.z.object({}));
  miraiclip.registerTransitionRenderer("flash", {
    rendersBothClips: false, // the overlay covers the hard cut
    frame: (role, progress) => role === "from"
      ? { overlay: { color: 0xffffff, alpha: 1 - Math.abs(2 * progress - 1) } }
      : null,
  });
}
project.transaction(() => {
  project.dispatch({ type: "clip/split", payload: { clipId: "main", atUs: 3_000_000, newClipId: "second" } });
  project.dispatch({ type: "transition/add", payload: { kind: "flash", fromClipId: "main", toClipId: "second", durationUs: 700_000 } });
});
{{< /example-variant >}}
{{< /example-group >}}

</div>
</div>

<div class="mirai-band">
<div class="mirai-band-inner">

## Captions

Reels-style karaoke text with word-level timing. Four presets drive how the current word is emphasized — or import an SRT/VTT file or ASR word timestamps and get these clips generated for you. Want a style the presets don't cover? Build it as a [custom clip kind](../docs/rendering/extensibility).

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
{{< example-variant name="Custom (word pop)" >}}
// A caption style the presets don't have — ONE word at a time, popping in —
// built as a custom clip kind: word timing in props, animation in tick().
miraiclip.registerClipKind("wordPop",
  { propsSchema: miraiclip.z.object({
      words: miraiclip.z.array(miraiclip.z.object({
        text: miraiclip.z.string(), startUs: miraiclip.z.number().int(), durationUs: miraiclip.z.number().int(),
      })),
      color: miraiclip.z.string().default("#ffd400"),
    }),
    trackKinds: ["video"] },
  (clip, { backend }) => {
    const textOf = (t) => ({ ...clip, kind: "text", text: t, fontFamily: "sans-serif", fontSizePx: 72, color: clip.props.color });
    const inner = backend.createText(textOf(""));
    let placement = { xPx: 0, yPx: 0, scale: 1, rotationRad: 0, opacity: 1 };
    let current = "";
    return {
      setPlacement: (p) => { placement = { ...p }; }, // copy — the caller reuses it
      setVisible: (v) => inner.setVisible(v),
      setZ: (z) => inner.setZ(z),
      update: () => {},
      tick: (clip, timeUs) => {
        const t = timeUs - clip.startUs;
        const word = clip.props.words.find((w) => t >= w.startUs && t < w.startUs + w.durationUs);
        if ((word?.text ?? "") !== current) { current = word?.text ?? ""; inner.update(textOf(current)); }
        const age = word ? t - word.startUs : 0;
        const pop = word ? 1 + 0.35 * Math.max(0, 1 - age / 150_000) : 1; // 150ms overshoot
        inner.setPlacement({ ...placement, scale: placement.scale * pop });
      },
      destroy: () => inner.destroy(),
    };
  });
project.dispatch({ type: "clip/add", payload: {
  kind: "wordPop", id: "wp-1", trackId: "overlay", startUs: 0, durationUs: 6_000_000,
  props: { words: ["ONE", "WORD", "AT", "A", "TIME"].map((text, i) => ({
    text, startUs: i * 1_200_000, durationUs: 1_200_000,
  })) },
} });
{{< /example-variant >}}
{{< /example-group >}}

</div>
</div>

<div class="mirai-band">
<div class="mirai-band-inner">

## HTML Clips

Author overlays as HTML/CSS — an `html` clip rasterizes a template into the composition and behaves like any other clip: keyframes, effects, and transitions apply, and exports bake it in. `{{param}}` placeholders make it a template; updating params re-rasters in place.

{{< example-group >}}
{{< example-variant name="Lower third" >}}
project.dispatch({ type: "clip/add", payload: {
  kind: "html", id: "lt-1", trackId: "overlay", startUs: 0, durationUs: 6_000_000,
  template: `
    <div style="display:flex;align-items:center;gap:14px;height:100%;
                background:linear-gradient(90deg,#e91e63cc,#9c27b0cc);
                border-radius:14px;color:#fff;font:700 30px sans-serif;padding:0 22px">
      {{name}} <span style="font:400 20px sans-serif;opacity:.85">{{role}}</span>
    </div>`,
  params: { name: "Big Buck Bunny", role: "Lead Actor" },
  widthPx: 460, heightPx: 72,
  transform: { x: 0.4, y: 0.85 },
} });
{{< /example-variant >}}
{{< example-variant name="Live params (countdown)" >}}
project.dispatch({ type: "clip/add", payload: {
  kind: "html", id: "count-1", trackId: "overlay", startUs: 0, durationUs: 6_000_000,
  template: `<div style="display:flex;align-items:center;justify-content:center;height:100%;
    background:#000c;border-radius:16px;color:#ffd400;font:800 64px sans-serif">{{n}}</div>`,
  params: { n: 5 }, widthPx: 160, heightPx: 120, transform: { x: 0.85, y: 0.2 },
} });
// A param change re-rasters the template in place (~2ms):
let n = 5;
const timer = setInterval(() => {
  n = n > 0 ? n - 1 : 5;
  project.dispatch({ type: "clip/set-property", payload: { clipId: "count-1", params: { n } } });
}, 1_000);
setTimeout(() => clearInterval(timer), 30_000);
{{< /example-variant >}}
{{< example-variant name="Banner ad" >}}
// A full banner ad — layout, gradients, inline SVG artwork — is still just
// one html clip. Copy is parameterized, so the same template ships any campaign.
project.dispatch({ type: "clip/add", payload: {
  kind: "html", id: "ad-1", trackId: "overlay", startUs: 0, durationUs: 6_000_000,
  widthPx: 600, heightPx: 330,
  params: { eyebrow: "NEW · SPARKLING ORANGE", headline: "Less heat. More heck yes.", cta: "Take a sip" },
  template: `
<style>
  .zest{position:relative;width:100%;height:100%;overflow:hidden;border-radius:18px;
    background:radial-gradient(120% 110% at 82% 8%, #ffe9b8 0%, #fff7d9 52%, #fff2c8 100%);
    font-family:Arial,Helvetica,sans-serif;color:#143f2d}
  .brand{position:absolute;top:20px;left:28px;font-weight:900;font-size:30px;letter-spacing:-1.5px}
  .brand i{color:#ff8c32;font-style:normal}
  .copy{position:absolute;top:72px;left:28px;width:310px}
  .eyebrow{font-size:12px;font-weight:800;letter-spacing:3px;color:#ff8c32}
  .zest h1{margin:8px 0 10px;font-size:42px;line-height:.95;font-weight:900;letter-spacing:-2px}
  .sub{font-size:14px;line-height:1.45;opacity:.82;width:280px}
  .sip{display:inline-block;margin-top:14px;background:#ff8c32;color:#143f2d;font-weight:800;
    font-size:14px;padding:10px 20px;border-radius:999px}
  .micro{margin-top:9px;font-size:10px;letter-spacing:.5px;opacity:.55}
  .ticker{position:absolute;left:0;right:0;bottom:0;background:#143f2d;color:#fff7d9;
    font-size:11px;font-weight:700;letter-spacing:3px;padding:7px 0;text-align:center;white-space:nowrap}
</style>
<div class="zest">
  <div class="brand">zest<i>!</i></div>
  <div class="copy">
    <div class="eyebrow">{{eyebrow}}</div>
    <h1>{{headline}}</h1>
    <div class="sub">Real orange zip, zero sugar crash. Cracked cold, gone in seconds.</div>
    <span class="sip">{{cta}}</span>
    <div class="micro">CHILL HARD · SIP OFTEN · RECYCLE ALWAYS</div>
  </div>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 270"
       style="position:absolute;right:14px;top:14px;width:210px;height:258px">
    <defs>
      <linearGradient id="can" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#0e2f22"/><stop offset=".35" stop-color="#1d5c41"/>
        <stop offset=".55" stop-color="#2e8f63"/><stop offset=".82" stop-color="#17492f"/>
      </linearGradient>
      <linearGradient id="lid" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#9fb0a6"/><stop offset=".5" stop-color="#e6ece8"/>
        <stop offset="1" stop-color="#8fa096"/>
      </linearGradient>
    </defs>
    <ellipse cx="110" cy="252" rx="76" ry="11" fill="#143f2d" opacity=".14"/>
    <rect x="52" y="34" width="116" height="212" rx="24" fill="url(#can)"/>
    <ellipse cx="110" cy="38" rx="58" ry="11" fill="url(#lid)"/>
    <ellipse cx="110" cy="38" rx="46" ry="7.5" fill="#7c8d83"/>
    <text x="110" y="128" text-anchor="middle" font-family="Arial" font-weight="900"
          font-size="38" fill="#fff7d9" letter-spacing="-2">zest!</text>
    <text x="110" y="150" text-anchor="middle" font-family="Arial" font-weight="700"
          font-size="11" fill="#ffb46e" letter-spacing="2">SPARKLING ORANGE</text>
    <g transform="translate(110 200)">
      <circle r="30" fill="#ff8c32"/><circle r="24" fill="#ffcf9e"/>
      <g stroke="#ff8c32" stroke-width="3">
        <line x1="0" y1="-24" x2="0" y2="24"/><line x1="-24" y1="0" x2="24" y2="0"/>
        <line x1="-17" y1="-17" x2="17" y2="17"/><line x1="-17" y1="17" x2="17" y2="-17"/>
      </g>
      <circle r="6" fill="#ff8c32"/>
    </g>
    <circle cx="70" cy="90" r="4" fill="#fff7d9" opacity=".5"/>
    <circle cx="80" cy="170" r="3" fill="#fff7d9" opacity=".4"/>
    <circle cx="150" cy="120" r="3.5" fill="#fff7d9" opacity=".45"/>
    <circle cx="142" cy="70" r="2.5" fill="#fff7d9" opacity=".5"/>
  </svg>
  <div class="ticker">NEW · SPARKLING ORANGE · ZERO SUGAR · NEW · SPARKLING ORANGE · ZERO SUGAR · NEW</div>
</div>`,
} });
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

These commands are the whole API. The [Rendering guide](../docs/rendering) covers each feature in depth, [Custom Effects & Transitions](../docs/rendering/extensibility) shows the full extensibility contract (custom clip kinds included), and the [command catalog](../docs/command-catalog) lists every payload schema. The repo's [playground](https://github.com/comaniacs/miraiclip/tree/main/apps/playground) is the same thing at full size.

</div>
</div>

{{< example-runtime >}}
