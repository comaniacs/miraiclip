# Whip pan

**What:** A very fast camera move sideways with heavy blur, from one panel to the next.
**When:** Lists of equals (feature after feature), energetic promos, a hard change of subject that should still feel like one move.
**Timing:** 0.3–0.4 s (power4.inOut). Blur peaks at the middle: 12–20 px up in half the time, down in the other half.
**Mistake:** A whip at normal speed: without the speed and blur it is just a slow slide.

```html
<div class="world"><div class="strip"><section class="p1">Capture</section><section class="p2">Convert</section></div></div>
```

```css
.strip{position:absolute;inset:0}.strip section{position:absolute;top:0;width:100cqw;height:100cqh;display:grid;place-items:center;font-size:14cqmin;font-weight:800}.p1{left:0}.p2{left:100cqw;color:var(--p)}
```

```js
tl.label("hold", 0)
  .camera({ zoom: 1.04, duration: 1.2, ease: "sine.out" }, "hold")
  .label("whip", 1.3)
  .camera({ x: -S.w(100), zoom: 1, duration: 0.36, ease: "power4.inOut" }, "whip")
  .to(".world", { blur: 18, duration: 0.18, ease: "power2.in" }, "whip")
  .to(".world", { blur: 0, duration: 0.18, ease: "power2.out" }, ">")
  .camera({ x: -S.w(101), zoom: 1.05, duration: 1.6, ease: "sine.inOut" }, "whip+=0.36");
```

Add an SFX whoosh centred on the whip (see the media-sound skill).
