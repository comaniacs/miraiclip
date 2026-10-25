# Grid assemble

**What:** Tiles fly in from scattered, seeded positions and lock into a grid; then the grid stays alive (a wave of highlight passes through it).
**When:** Libraries, catalogues, "all your templates", any many-of-a-kind moment. The grid can later collapse or zoom out into a bigger wall.
**Timing:** Fly-in 0.6–0.8 s (expo.out), stagger 0.03–0.05 s. A highlight wave 0.3 s per tile, from the centre.
**Mistake:** Tiles that land and freeze: once assembled, something in the grid must keep changing.

```html
<div class="world"><div class="center"><div class="grid"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div></div>
```

```css
.center{position:absolute;inset:0;display:grid;place-items:center}.grid{display:grid;grid-template-columns:repeat(4,14cqmin);gap:2cqmin}.grid i{height:10cqmin;border-radius:1.4cqmin;background:var(--card);border:.3cqmin solid var(--line)}
```

```js
const r = S.rand(3);
const tiles = document.querySelectorAll(".grid i");
const off = [...tiles].map(() => [(r() - 0.5) * 120, (r() - 0.5) * 100, (r() - 0.5) * 90]);
tl.label("fly", 0)
  .from(tiles, { x: (i) => S.w(off[i][0]), y: (i) => S.h(off[i][1]), rotate: (i) => off[i][2], opacity: 0, blur: 10, duration: 0.7, stagger: 0.04, ease: "expo.out" }, "fly")
  .label("wave", 1.5)
  .to(tiles, { backgroundColor: "#ffcf5a", duration: 0.25, stagger: { each: 0.05, from: "center" }, ease: "power2.out" }, "wave")
  .to(tiles, { backgroundColor: "#1c2140", duration: 0.4, stagger: { each: 0.05, from: "center" }, ease: "power2.in" }, "wave+=0.3")
  .camera({ zoom: 1.08, tiltX: 8, duration: 3.4, ease: "sine.inOut" }, "fly");
```

Tween colours to real colour values (hex, rgb), not `var(--…)`: the timeline interpolates numbers.
