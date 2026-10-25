# Split and scatter

**What:** A word breaks into its letters, which fly apart (or gather from scattered positions into the word).
**When:** Breaking something apart (problems, chaos, "ten tools"), or assembling a name out of noise. Reverse it to assemble.
**Timing:** Scatter 0.6–0.9 s (expo.out) with a small stagger (0.02 s). Use S.rand(seed) for the directions so every render matches.
**Mistake:** Math.random for the directions: the frames change every render, and the lint refuses it.

```html
<div class="world"><div class="center"><p class="w">scattered</p></div></div>
```

```css
.center{position:absolute;inset:0;display:grid;place-items:center}.w{font-size:14cqmin;font-weight:900;letter-spacing:-.02em;white-space:nowrap}
```

```js
const chars = S.split(".w", "chars");
const r = S.rand(7);
const dx = chars.map(() => (r() - 0.5) * 90), dy = chars.map(() => (r() - 0.5) * 80), rot = chars.map(() => (r() - 0.5) * 160);
tl.label("whole", 0)
  .from(chars, { opacity: 0, y: S.h(6), duration: 0.5, stagger: 0.03, ease: "expo.out" }, "whole")
  .label("burst", 1.4)
  .to(chars, { x: (i) => S.w(dx[i]), y: (i) => S.h(dy[i]), rotate: (i) => rot[i], opacity: 0.5, blur: 3, duration: 0.8, stagger: 0.02, ease: "expo.out" }, "burst")
  .camera({ zoom: 0.92, duration: 2.6, ease: "sine.inOut" }, "whole");
```

To assemble instead: `tl.from(chars, { x: …, y: …, rotate: …, opacity: 0 })` with the same seeded values.
