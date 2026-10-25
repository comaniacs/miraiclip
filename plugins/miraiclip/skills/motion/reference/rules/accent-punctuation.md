# Accent punctuation

**What:** A small accent shape (a square, a dot) moves with the words like punctuation, jumping to the end of each word as it lands.
**When:** Kinetic lines of short words ("Plan. Build. Ship."); it carries the accent colour and gives the eye a guide.
**Timing:** Each jump 0.25–0.3 s (expo.out), timed with the word it follows.
**Mistake:** More than one accent object per line, or an accent that wanders without following anything.

```html
<div class="world"><p class="line"><span class="txt">Plan. Build. Ship.</span><i class="sq"></i></p></div>
```

```css
.line{position:absolute;left:14cqw;top:42cqh;font-size:11cqmin;font-weight:900;white-space:nowrap}.sq{position:absolute;left:0;top:.62em;width:.22em;height:.22em;background:var(--p)}
```

```js
const words = S.split(".line .txt", "words");
tl.label("say", 0.2).set(".sq", { x: 0, scale: 0 }, 0);
words.forEach((w, i) => {
  const at = "say+=" + i * 0.45;
  tl.from(w, { y: S.h(5), opacity: 0, blur: 8, duration: 0.4, ease: "expo.out" }, at)
    .to(".sq", { x: w.offsetLeft + w.offsetWidth + S.min(1), scale: 1, rotate: 90 * (i + 1), duration: 0.3, ease: "expo.out" }, at);
});
tl.camera({ x: -S.w(3), zoom: 1.05, duration: 3, ease: "sine.inOut" }, 0);
```
