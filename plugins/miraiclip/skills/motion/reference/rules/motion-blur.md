# Motion blur

**What:** Fast moves carry blur, peaking where the speed peaks. With expo.out, blur from the from-value to 0 does this on its own.
**When:** Every fly-in, fly-out, whip and fast scale. Also the blur-in on new elements (a soft 8–14 px focus-in).
**Timing:** Blur 10–20 px on the fast part. Entrances: from blur, 0.4–0.6 s expo.out. Exits: to blur, 0.3–0.4 s expo.in.
**Mistake:** Blur on slow moves (it looks out of focus, not fast), or blur that stays after the element has stopped.

```html
<div class="world"><div class="center"><div class="card">Fast</div></div></div>
```

```css
.center{position:absolute;inset:0;display:grid;place-items:center}.card{padding:4cqmin 8cqmin;border-radius:2cqmin;background:var(--p);color:var(--bg);font-size:9cqmin;font-weight:900}
```

```js
tl.label("in", 0.2)
  .fromTo(".card", { x: -S.w(70), blur: 18 }, { x: 0, blur: 0, duration: 0.55, ease: "expo.out" }, "in")
  .label("out", 2)
  .to(".card", { x: S.w(70), blur: 18, duration: 0.4, ease: "expo.in" }, "out")
  .camera({ zoom: 1.05, duration: 2.6, ease: "sine.inOut" }, "in");
```
