# Scale to fill

**What:** A word or wordmark grows until it bleeds past both edges of the frame, often with a colour sweep.
**When:** The brand moment near the end, or the single word that sums up the film.
**Timing:** 0.8–1.2 s (expo.inOut), then a slow drift. Aim for about 1.2–1.4× the frame width.
**Mistake:** Scaling the whole world with the camera: the background grows too and nothing feels big.

```html
<div class="world"><div class="center"><p class="big">launch</p></div></div>
```

```css
.center{position:absolute;inset:0;display:grid;place-items:center}.big{font-size:12cqmin;font-weight:900;letter-spacing:-.04em;white-space:nowrap;color:var(--mut)}
```

```js
tl.label("set", 0)
  .from(".big", { opacity: 0, blur: 10, duration: 0.5, ease: "expo.out" }, "set")
  .label("fill", 1)
  // Measure the word so the scale fits any frame size.
  .to(".big", { scale: (i, el) => (S.width * 1.3) / el.offsetWidth, color: "#ffcf5a", duration: 1.1, ease: "expo.inOut" }, "fill")
  .camera({ x: -S.w(2), duration: 3, ease: "sine.inOut" }, "set");
```
