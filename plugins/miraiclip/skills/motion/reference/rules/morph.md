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

## With `tl.morph` (version 2)

On a `data-stage-version="2"` sequence, `tl.morph(from, to, …)` does the whole move for you: the source's box, corner radius and colour become the target's, the target's content rises in over the last 40 %, and the two hand over on the last frame with no swap. Write the target where it should end up, and morph the source into it.

```html v2
<div class="world"><div class="shape"></div><div class="win"><p class="copy">Your whole funnel, in one window</p></div></div>
```

```css v2
.shape{position:absolute;left:46cqw;top:44cqh;width:8cqmin;height:8cqmin;border-radius:50%;background:var(--p)}.win{position:absolute;left:14cqw;top:36cqh;width:72cqw;height:28cqh;border-radius:4cqmin;background:var(--p);display:grid;place-items:center}.copy{margin:0;color:var(--bg);font-size:4.4cqmin;font-weight:700;text-align:center}
```

```js v2
tl.label("dot", 0)
  .from(".shape", { scale: 0, duration: 0.5, ease: "back.out" }, "dot")
  .morph(".shape", ".win", { duration: 0.8, ease: "expo.inOut" }, 0.9)
  .camera({ zoom: 1.08, tiltX: 6, duration: 3, ease: "sine.inOut" }, "dot");
```

The source must be `position: absolute` or `relative`, and the target stays hidden until the hand-over, so don't animate its opacity. Chain morphs (a dot into a card, the card into a pill) and each one is a carried subject.
