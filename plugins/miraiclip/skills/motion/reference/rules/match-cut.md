# Match cut

**What:** A hard cut between two framings of the same element: the wide shot of a wordmark cuts to an extreme close-up of its last letter.
**When:** Endings, reveals, and any change you want to feel decisive. The cut is hidden because the eye stays on the same thing.
**Timing:** Hold the wide 0.6–1 s, cut on a frame (tl.set), then drift the close-up slowly (scale +3–6% over 1–1.5 s).
**Mistake:** Cutting to a different element: without the shared shape it's just a jump.

```html
<div class="world"><div class="center"><p class="mark">orbit<i class="dot"></i></p></div></div>
```

```css
.center{position:absolute;inset:0;display:grid;place-items:center}.mark{font-size:20cqmin;font-weight:800;letter-spacing:-.04em;line-height:1}.mark .dot{display:inline-block;width:.16em;height:.16em;border-radius:50%;background:var(--p);margin-left:.04em}
```

```js
// Centre the camera on the detail we cut to: the world's transform-origin goes on the dot.
const d = document.querySelector(".dot").getBoundingClientRect();
const ox = ((d.left + d.width / 2) / S.width) * 100, oy = ((d.top + d.height / 2) / S.height) * 100;
tl.set(".world", { transformOrigin: ox + "% " + oy + "%" }, 0)
  .label("wide", 0)
  .from(".mark", { opacity: 0, blur: 12, duration: 0.5, ease: "expo.out" }, "wide")
  .camera({ zoom: 1.05, duration: 1.4, ease: "sine.out" }, "wide")
  .label("cut", 1.5)
  .camera({ zoom: 4, duration: 0.01 }, "cut")
  .camera({ zoom: 4.3, duration: 1.4, ease: "sine.inOut" }, ">");
```

The camera zooms about the `.world` transform-origin: measure the detail (getBoundingClientRect, before any camera move) and put the origin on it.
