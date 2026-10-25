# Path follow

**What:** An element travels along a curve: separate eases on x and y give an arc without any path data.
**When:** Anything that goes from A to B with intent: a message flying to a phone, a lead travelling to a calendar, a cursor.
**Timing:** 1–1.6 s. x with power2.inOut; y up with sine.out for the first half, down with sine.in for the second.
**Mistake:** Straight-line travel at constant speed: it reads as mechanical. Arc it and ease it.

```html
<div class="world"><div class="a">Lead</div><div class="b">Booked</div><i class="ball"></i></div>
```

```css
.a,.b{position:absolute;top:66cqh;padding:1.6cqmin 3cqmin;border-radius:1.4cqmin;background:var(--card);font-size:4cqmin;font-weight:600}.a{left:8cqw}.b{left:76cqw}.ball{position:absolute;left:16cqw;top:60cqh;width:4cqmin;height:4cqmin;border-radius:50%;background:var(--p);box-shadow:0 0 3cqmin var(--p)}
```

```js
tl.label("go", 0.4)
  .from(".a,.b", { opacity: 0, y: S.h(4), duration: 0.5, stagger: 0.15, ease: "expo.out" }, 0)
  .to(".ball", { x: S.w(64), duration: 1.4, ease: "power2.inOut" }, "go")
  .to(".ball", { y: -S.h(40), duration: 0.7, ease: "sine.out" }, "go")
  .to(".ball", { y: 0, duration: 0.7, ease: "sine.in" }, "go+=0.7")
  .to(".b", { scale: 1.12, backgroundColor: "#ffcf5a", color: "#10142a", duration: 0.35, ease: "back.out" }, "go+=1.35")
  .camera({ x: -S.w(4), duration: 2.6, ease: "sine.inOut" }, "go");
```

For more than one bump, use keyframes: `y: [0, -S.h(30), -S.h(10), 0]` (the duration is shared evenly).
