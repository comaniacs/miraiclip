# Depth stack

**What:** Flat cards fan out in depth (z) while the camera tilts, so a stack of things becomes a space.
**When:** Layers of a product, versions, a pile of documents, options to choose from.
**Timing:** Fan-out 0.8–1 s (expo.inOut), stagger 0.05 s. Camera tilt 8–20° over the whole beat, then untilt to resolve.
**Mistake:** Forgetting `transform-style: preserve-3d` on `.world` and the wrapper: the cards flatten into one plane.

```html
<div class="world"><div class="center"><div class="stack"><div class="card">Draft</div><div class="card">Review</div><div class="card">Approved</div><div class="card">Live</div></div></div></div>
```

```css
.center{position:absolute;inset:0;display:grid;place-items:center}.world,.center,.stack{transform-style:preserve-3d}.stack{display:grid}.card{grid-area:1/1;width:44cqmin;height:28cqmin;border-radius:2cqmin;background:var(--card);border:.3cqmin solid var(--line);display:grid;place-items:center;font-size:5cqmin;font-weight:700}.card:last-child{background:var(--p);color:var(--bg)}
```

```js
const cards = document.querySelectorAll(".card");
tl.label("stack", 0)
  .from(cards, { y: S.h(6), opacity: 0, duration: 0.5, stagger: 0.06, ease: "expo.out" }, "stack")
  .label("fan", 0.9)
  .to(cards, { z: (i) => S.min((i - 3) * 16), x: (i) => S.w((i - 1.5) * 6), y: (i) => -S.h((i - 1.5) * 5), duration: 0.9, stagger: 0.05, ease: "expo.inOut" }, "fan")
  .camera({ tiltX: 18, tiltY: -24, zoom: 0.95, duration: 1.4, ease: "power3.inOut" }, "fan")
  .camera({ tiltX: 0, tiltY: 0, zoom: 1.05, duration: 1.2, ease: "power3.inOut" }, "fan+=1.9");
```
