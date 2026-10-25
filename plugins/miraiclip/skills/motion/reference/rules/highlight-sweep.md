# Highlight sweep

**What:** A marker bar sweeps behind the key word, and the word flips to the contrast colour as it is covered.
**When:** Emphasis in a sentence that is already on screen; editorial and explainer looks.
**Timing:** 0.4–0.5 s (expo.inOut) after the line has landed; the colour flip at 40% of the sweep.
**Mistake:** Sweeping several words in one sentence: emphasis on everything is emphasis on nothing.

```html
<div class="world"><div class="center"><p class="s">Make <span class="key"><i class="mark"></i><span class="kw">video</span></span> from your product</p></div></div>
```

```css
.center{position:absolute;inset:0;display:grid;place-items:center}.s{font-size:7.4cqmin;font-weight:700;white-space:nowrap}.key{position:relative;display:inline-block;isolation:isolate}.mark{position:absolute;left:-.12em;right:-.12em;top:.08em;bottom:.02em;background:var(--p);z-index:-1;transform-origin:0 50%}
```

```js
tl.label("line", 0)
  .from(".s", { opacity: 0, y: S.h(4), blur: 10, duration: 0.5, ease: "expo.out" }, "line")
  .label("mark", 0.9)
  .from(".mark", { scaleX: 0, duration: 0.45, ease: "expo.inOut" }, "mark")
  .to(".kw", { color: "#10142a", duration: 0.15 }, "mark+=0.18")
  .camera({ zoom: 1.07, duration: 2.6, ease: "sine.inOut" }, "line");
```
