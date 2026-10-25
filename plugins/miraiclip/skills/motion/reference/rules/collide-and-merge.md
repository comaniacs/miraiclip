# Collide and merge

**What:** Several elements converge on one point and become one new element.
**When:** Many-into-one ideas: tools into a platform, steps into a result, voices into one message.
**Timing:** Gather 0.6–0.8 s (expo.in, accelerating into the hit). The merged element pops 0.1 s before they arrive (back.out). A short camera kick (zoom −5%) on the hit.
**Mistake:** The parts arriving one by one and fading: the hit must be one moment.

```html
<div class="world"><i class="part"></i><i class="part"></i><i class="part"></i><i class="part"></i><i class="part"></i><div class="core">One</div></div>
```

```css
.part{position:absolute;left:50%;top:50%;width:9cqmin;height:9cqmin;margin:-4.5cqmin 0 0 -4.5cqmin;border-radius:50%;background:var(--s);box-shadow:0 0 4cqmin var(--s)}.part:nth-child(2n){background:var(--p);box-shadow:0 0 4cqmin var(--p)}.core{position:absolute;left:50%;top:50%;width:24cqmin;height:24cqmin;margin:-12cqmin 0 0 -12cqmin;border-radius:50%;background:var(--p);color:var(--bg);display:grid;place-items:center;font-size:6cqmin;font-weight:800}
```

```js
const spots = [[-32, -20], [30, -24], [-36, 18], [34, 16], [0, 30]];
tl.set(".core", { scale: 0, opacity: 0 }, 0)
  .set(".part", { x: (i) => S.w(spots[i][0]), y: (i) => S.h(spots[i][1]) }, 0)
  .label("drift", 0)
  .from(".part", { scale: 0, opacity: 0, duration: 0.6, stagger: 0.08, ease: "back.out" }, "drift")
  .to(".part", { y: (i) => S.h(spots[i][1] - 4), duration: 1.6, ease: "sine.inOut" }, "drift+=0.4")
  .label("hit", 2)
  .to(".part", { x: 0, y: 0, scale: 0.4, duration: 0.7, stagger: 0.03, ease: "expo.in" }, "hit")
  .to(".core", { scale: 1, opacity: 1, duration: 0.5, ease: "back.out" }, "hit+=0.6")
  .to(".part", { opacity: 0, duration: 0.15 }, "hit+=0.75")
  .camera({ zoom: 0.95, duration: 0.25, ease: "power2.out" }, "hit+=0.7")
  .camera({ zoom: 1.04, duration: 1.6, ease: "sine.inOut" }, ">");
```
