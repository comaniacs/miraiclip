# Overshoot

**What:** The element passes its resting value and settles back (back.out), or springs (elastic.out) for a playful brief.
**When:** Anything that lands: chips, badges, icons, a logo arriving. Use back.out by default; elastic only when the brief is playful.
**Timing:** 0.45–0.7 s. Stagger 0.06–0.1 s between siblings so they land one after another.
**Mistake:** Overshoot on text paragraphs or on every element at once: it wobbles the whole frame.

```html
<div class="world"><div class="row"><span class="chip">Leads</span><span class="chip">Calls</span><span class="chip">Reviews</span></div></div>
```

```css
.row{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:3cqmin}.chip{padding:2cqmin 4cqmin;border-radius:10cqmin;background:var(--card);border:.3cqmin solid var(--p);font-size:4.4cqmin;font-weight:600}
```

```js
tl.label("land", 0.3)
  .from(".chip", { scale: 0, opacity: 0, duration: 0.6, stagger: 0.09, ease: "back.out" }, "land")
  .to(".chip", { y: -S.h(3), duration: 0.5, stagger: 0.09, ease: "elastic.out" }, "land+=1.1")
  .camera({ zoom: 1.06, duration: 2.4, ease: "sine.inOut" }, "land");
```
