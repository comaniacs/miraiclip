# Line draw

**What:** A line grows across the frame at a steady rate and each node pops as the line reaches it.
**When:** Timelines, steps, journeys, connections between two things, charts that build.
**Timing:** The line linear at 30–50% of the frame per second; each node pops (back.out, 0.35 s) exactly when the line reaches it.
**Mistake:** Nodes popping on their own schedule: the line must be the cause.

```html
<div class="world"><div class="track"><i class="line"></i><span class="node" style="left:0%"><b>Sign up</b></span><span class="node" style="left:33%"><b>Onboard</b></span><span class="node" style="left:66%"><b>Launch</b></span><span class="node" style="left:100%"><b>Grow</b></span></div></div>
```

```css
.track{position:absolute;left:14cqw;right:14cqw;top:48cqh;height:.8cqmin}.line{position:absolute;inset:0;background:var(--p);transform-origin:0 50%;border-radius:1cqmin}.node{position:absolute;top:-1.6cqmin;width:4cqmin;height:4cqmin;margin-left:-2cqmin;border-radius:50%;background:var(--ink)}.node b{position:absolute;top:6cqmin;left:-10cqmin;width:24cqmin;text-align:center;font-size:3.6cqmin;font-weight:600;white-space:nowrap}
```

```js
const fracs = [0, 0.33, 0.66, 1], drawS = 2;
tl.label("draw", 0.3)
  .from(".line", { scaleX: 0, duration: drawS, ease: "linear" }, "draw");
document.querySelectorAll(".node").forEach((n, i) => tl.from(n, { scale: 0, duration: 0.35, ease: "back.out" }, "draw+=" + fracs[i] * drawS));
tl.camera({ x: -S.w(3), zoom: 1.06, duration: 2.8, ease: "sine.inOut" }, "draw");
```
