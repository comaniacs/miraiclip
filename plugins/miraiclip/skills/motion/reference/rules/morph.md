# Morph

**What:** One shape becomes another: a dot grows into a card, a card into a window, by changing size and corner radius rather than swapping elements.
**When:** Whenever the next beat's container can grow out of something already on screen.
**Timing:** 0.5–0.8 s (power3.inOut or expo.inOut). Content inside fades or rises in during the last 40%.
**Mistake:** Cross-fading two different elements and calling it a morph: the outline must change continuously.

```html
<div class="world"><div class="center"><div class="shape"><p class="copy">Your whole funnel, in one window</p></div></div></div>
```

```css
.center{position:absolute;inset:0;display:grid;place-items:center}.shape{width:8cqmin;height:8cqmin;border-radius:50%;background:var(--p);display:grid;place-items:center;overflow:hidden}.copy{color:var(--bg);font-size:4.4cqmin;font-weight:700;text-align:center;padding:0 4cqmin;white-space:nowrap}
```

```js
tl.label("dot", 0)
  .from(".shape", { scale: 0, duration: 0.5, ease: "back.out" }, "dot")
  .label("grow", 0.9)
  .to(".shape", { width: S.min(110), height: S.min(34), borderRadius: "4cqmin", duration: 0.7, ease: "expo.inOut" }, "grow")
  .from(".copy", { opacity: 0, y: S.h(3), duration: 0.4, ease: "expo.out" }, "grow+=0.45")
  .camera({ zoom: 1.08, tiltX: 6, duration: 3, ease: "sine.inOut" }, "dot");
```

Centre with a grid wrapper, never with a CSS `transform` on the animated element: the timeline writes `transform` and would replace it.
