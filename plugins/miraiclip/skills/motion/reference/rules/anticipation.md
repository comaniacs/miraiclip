# Anticipation

**What:** A small move the opposite way just before the main move: a card pulls back and dips before it launches.
**When:** Before any big, fast move (a launch, a throw, a whip). It tells the eye where to look a fraction before things happen.
**Timing:** Wind-up 0.12–0.2 s (power2.out), then the main move 0.4–0.6 s (expo.out). The wind-up is 2–5% of the main move's distance.
**Mistake:** A wind-up as big or as slow as the move itself: it reads as hesitation, not energy.

```html
<div class="world"><div class="card">Ship it</div></div>
```

```css
.card{position:absolute;left:30cqw;top:42cqh;padding:3cqmin 5cqmin;border-radius:2cqmin;background:var(--p);color:var(--bg);font-size:6cqmin;font-weight:700}
```

```js
tl.label("wind", 0.4)
  .to(".card", { x: -S.w(2), scale: 0.94, duration: 0.18, ease: "power2.out" }, "wind")
  .to(".card", { x: S.w(30), scale: 1, duration: 0.55, ease: "expo.out" }, ">")
  .camera({ x: -S.w(4), duration: 1.6, ease: "sine.inOut" }, "wind");
```
