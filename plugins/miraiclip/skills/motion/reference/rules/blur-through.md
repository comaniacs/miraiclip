# Blur-through

**What:** A hidden cut: the whole beat blurs out and the next one blurs in, overlapping by a few frames, so no layout ever dissolves into another.
**When:** A hard change of idea inside an act when nothing can carry over (and at most once or twice per act).
**Timing:** Out 0.25–0.3 s (power2.in, blur to 16–24 px, slight scale up). In 0.4 s (expo.out) starting halfway through the out.
**Mistake:** A slow cross-dissolve between two full layouts: both are half-visible and the frame turns to mush.

```html
<div class="world"><div class="center"><p class="a">Too many tools.</p></div><div class="center"><p class="b">One platform.</p></div></div>
```

```css
.center{position:absolute;inset:0;display:grid;place-items:center}.a,.b{font-size:10cqmin;font-weight:800}.b{color:var(--p)}
```

```js
tl.set(".b", { opacity: 0 }, 0)
  .label("a", 0)
  .from(".a", { opacity: 0, blur: 12, duration: 0.5, ease: "expo.out" }, "a")
  .label("cut", 1.6)
  .to(".a", { opacity: 0, blur: 22, scale: 1.08, duration: 0.28, ease: "power2.in" }, "cut")
  .fromTo(".b", { opacity: 0, blur: 22, scale: 0.94 }, { opacity: 1, blur: 0, scale: 1, duration: 0.4, ease: "expo.out" }, "cut+=0.14")
  .camera({ zoom: 1.08, duration: 3.4, ease: "sine.inOut" }, "a");
```
