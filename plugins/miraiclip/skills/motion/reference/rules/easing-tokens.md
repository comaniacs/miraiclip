# Easing tokens

**What:** A small set of eases, each with one job, used consistently across the film.
**When:** Always: pick from these before trying anything else.
**Timing:** expo.out for entrances (0.4–0.7 s); expo.in for exits (0.3–0.4 s); power3.inOut / expo.inOut for moves between places and the camera (0.6–1.2 s); back.out for pops; sine.inOut for drift and holds (2–4 s); linear only for lines drawing at a steady rate.
**Mistake:** Linear moves for objects (mechanical), or a different ease on every element (no house style).

```html
<div class="world"><div class="rows"><p><span>expo.out</span><i></i></p><p><span>expo.in</span><i></i></p><p><span>power3.inOut</span><i></i></p><p><span>back.out</span><i></i></p><p><span>sine.inOut</span><i></i></p></div></div>
```

```css
.rows{position:absolute;left:8cqw;top:14cqh;display:flex;flex-direction:column;gap:6cqh;font:500 3.6cqmin ui-monospace,monospace;color:var(--mut)}.rows p{position:relative;display:flex;align-items:center;width:84cqw;height:5cqmin}.rows span{width:22cqw}.rows i{position:absolute;left:22cqw;width:5cqmin;height:5cqmin;border-radius:50%;background:var(--p)}
```

```js
const eases = ["expo.out", "expo.in", "power3.inOut", "back.out", "sine.inOut"];
tl.label("go", 0.3);
document.querySelectorAll(".rows i").forEach((dot, i) => tl.to(dot, { x: S.w(52), duration: 1.2, ease: eases[i] }, "go"));
tl.camera({ zoom: 1.03, duration: 2.4, ease: "sine.inOut" }, 0);
```
