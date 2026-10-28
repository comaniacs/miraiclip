# Holds

**What:** A hold is a moment for reading, not a frozen frame: the main element stays put while something small keeps moving (a slow push, a drift, a blinking caret, a breathing glow).
**When:** Every time the viewer has to read: questions, stats, the end card.
**Timing:** Reading time: about 0.3 s per word plus 0.5 s. Nothing fully still for more than 0.8 s; the end card may hold up to 1.5 s with a slow drift. The exception is a stretch declared with `tl.rest(from, to)` (stage version 2), which is dead still on purpose and exempt from the motion metrics; the build fails if anything moves inside it.
**Mistake:** An undeclared hold where nothing moves at all: the motion metrics flag it, and it reads as the film stalling.

```html
<div class="world"><div class="bloom"></div><div class="center"><div class="stat"><p class="big">3×</p><p class="cap">more booked calls</p><i class="bar"></i></div></div></div>
```

```css
.center{position:absolute;inset:0;display:grid;place-items:center}.bloom{position:absolute;inset:-20cqh -20cqw;background:radial-gradient(circle at 40% 45%,#ffcf5a2e,transparent 35%)}.stat{text-align:center}.big{font-size:24cqmin;font-weight:900;line-height:1}.cap{font-size:5cqmin;color:var(--mut)}.bar{display:block;margin:2cqmin auto 0;width:20cqmin;height:.8cqmin;border-radius:1cqmin;background:var(--p);transform-origin:50% 50%}
```

```js
tl.label("in", 0)
  .from(".stat", { opacity: 0, blur: 12, scale: 0.92, duration: 0.6, ease: "expo.out" }, "in")
  .label("hold", 0.6)
  // While the viewer reads: a slow push, a drifting bloom, a breathing accent.
  .camera({ zoom: 1.06, duration: 2.6, ease: "sine.inOut" }, "hold")
  .to(".bloom", { x: S.w(6), y: -S.h(4), duration: 2.6, ease: "sine.inOut" }, "hold")
  .to(".bar", { scaleX: 1.4, duration: 1.3, ease: "sine.inOut" }, "hold")
  .to(".bar", { scaleX: 1, duration: 1.3, ease: "sine.inOut" }, ">");
```
