# Staggered entrance

**What:** Siblings enter one after another with the same move, so a list reads in order.
**When:** Lists, option cards, feature rows, grids. Stagger from "first" for reading order, from "center" for symmetric groups.
**Timing:** Each item 0.4–0.6 s (expo.out). Stagger 0.06–0.12 s. The whole group in under 1 s.
**Mistake:** Stagger so long the last item arrives after the viewer has stopped reading, or no stagger at all (the group lands as a block).

```html
<div class="world"><ul class="list"><li>Capture every lead</li><li>Reply in seconds</li><li>Book the call</li><li>Get the review</li></ul></div>
```

```css
.list{position:absolute;left:24cqw;top:24cqh;list-style:none;padding:0;display:flex;flex-direction:column;gap:2.6cqmin;font-size:5.4cqmin;font-weight:600}.list li{padding:1.6cqmin 3cqmin;border-left:.8cqmin solid var(--p);background:var(--card)}
```

```js
tl.label("list", 0.2)
  .from(".list li", { x: -S.w(4), opacity: 0, blur: 8, duration: 0.5, stagger: 0.08, ease: "expo.out" }, "list")
  .camera({ y: -S.h(3), zoom: 1.05, duration: 2.6, ease: "sine.inOut" }, "list");
```

From the centre: `stagger: { each: 0.06, from: "center" }`.
