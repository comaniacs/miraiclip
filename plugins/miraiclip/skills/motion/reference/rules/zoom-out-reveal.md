# Zoom-out reveal

**What:** The camera starts close on a few items and pulls back hard to show they are part of something much bigger; a counter changes with it.
**When:** Scale claims: 5 → 500 templates, one store → a thousand stores, one message → a whole inbox.
**Timing:** Hold close 0.8–1.2 s, pull back 0.8–1 s (expo.inOut), counter swap at the midpoint.
**Mistake:** Zooming out to a wall of identical empty boxes: the wall needs variety (colour, content) to read as "many".

```html
<div class="world"><div class="center"><div class="wall"></div></div></div><div class="hud"><span class="chip"><span class="slot"><b>5</b><b>500</b></span> templates</span></div>
```

```css
.center{position:absolute;inset:0;display:grid;place-items:center}.wall{display:grid;grid-template-columns:repeat(9,9cqmin);gap:1.4cqmin}.wall i{height:6cqmin;border-radius:.8cqmin}.hud{position:absolute;left:0;right:0;bottom:10cqh;display:flex;justify-content:center}.chip{padding:1.4cqmin 3cqmin;border-radius:6cqmin;background:var(--ink);color:var(--bg);font-size:4cqmin;font-weight:700}.slot{display:inline-grid;overflow:hidden;vertical-align:bottom}.slot b{grid-area:1/1}
```

```js
// The wall is built here: 9 × 7 tiles in seeded colours.
const wall = document.querySelector(".wall");
const r = S.rand(11), hues = ["#ffcf5a", "#5ad1ff", "#ff5d8f", "#8f7bff", "#3ddc97"];
for (let k = 0; k < 63; k++) {
  const t = document.createElement("i");
  t.style.background = hues[Math.floor(r() * hues.length)];
  t.style.opacity = String(0.35 + r() * 0.65);
  wall.appendChild(t);
}
tl.camera({ zoom: 4.2, duration: 0.01 }, 0)
  .set(".slot b:last-child", { y: "110%" }, 0)
  .label("close", 0.02)
  .camera({ zoom: 3.8, duration: 1.1, ease: "sine.inOut" }, "close")
  .from(".chip", { scale: 0, blur: 8, duration: 0.45, ease: "back.out" }, "close+=0.3")
  .label("reveal", 1.2)
  .camera({ zoom: 1, duration: 0.9, ease: "expo.inOut" }, "reveal")
  .to(".slot b:first-child", { y: "-110%", duration: 0.4, ease: "expo.inOut" }, "reveal+=0.35")
  .to(".slot b:last-child", { y: "0%", duration: 0.4, ease: "expo.inOut" }, "reveal+=0.35")
  .camera({ zoom: 1.04, duration: 1.4, ease: "sine.inOut" }, ">");
```

The `.hud` sits outside `.world`, so the camera doesn't move it: use that for chips and captions that must stay put.
