# Pop-in

**What:** A small element appears from nothing with a quick overshoot and a focus-in.
**When:** Chips, badges, labels, counters on top of a picture, notification bubbles.
**Timing:** 0.35–0.5 s (back.out), from scale 0 and blur 8 px. Pop chips 0.1–0.2 s apart.
**Mistake:** Popping big things (cards, headlines): use a rise or a morph for those.

```html
<div class="world"><div class="center"><div class="tile"><span class="chip">5 components</span></div></div></div>
```

```css
.center{position:absolute;inset:0;display:grid;place-items:center}.tile{position:relative;width:56cqmin;height:34cqmin;border-radius:2cqmin;background:linear-gradient(135deg,#5ad1ff55,#ff5d8f55)}.chip{position:absolute;right:-4cqmin;top:-3cqmin;padding:1.4cqmin 2.6cqmin;border-radius:6cqmin;background:var(--p);color:var(--bg);font-size:3.6cqmin;font-weight:700}
```

```js
tl.label("tile", 0)
  .from(".tile", { opacity: 0, y: S.h(5), blur: 10, duration: 0.6, ease: "expo.out" }, "tile")
  .from(".chip", { scale: 0, blur: 8, duration: 0.45, ease: "back.out" }, "tile+=0.5")
  .camera({ zoom: 1.08, tiltY: -6, duration: 2.6, ease: "sine.inOut" }, "tile");
```
