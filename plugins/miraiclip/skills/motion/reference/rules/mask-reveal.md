# Mask reveal

**What:** Each line rises into view from behind an invisible edge: the line sits in an `overflow: hidden` slot and moves up from below it.
**When:** Headlines and statements. It feels precise and editorial, and it never shows half-faded text.
**Timing:** 0.6–0.8 s per line (expo.out), lines 0.1–0.15 s apart. Exit the same way, upwards, 0.4 s (power3.in).
**Mistake:** Forgetting the slot: without `overflow: hidden` on the wrapper the text just slides in from below.

```html
<div class="world"><h1 class="head"><span class="slot"><span class="ln">Every lead.</span></span><span class="slot"><span class="ln">One <em>inbox</em>.</span></span></h1></div>
```

```css
.head{position:absolute;left:14cqw;top:30cqh;font-size:11cqmin;line-height:1.05;font-weight:800;letter-spacing:-.02em}.slot{display:block;overflow:hidden;padding-bottom:.08em}.ln{display:block}.head em{font-style:normal;color:var(--p)}
```

```js
tl.label("in", 0.2)
  .from(".ln", { y: "110%", duration: 0.75, stagger: 0.12, ease: "expo.out" }, "in")
  .camera({ zoom: 1.08, duration: 3, ease: "sine.inOut" }, "in")
  .label("out", 2.4)
  .to(".ln", { y: "-110%", duration: 0.4, stagger: 0.06, ease: "power3.in" }, "out");
```

A wipe variant without the slot: animate `clipPath` from `"inset(0 0 100% 0)"` to `"inset(0 0 0% 0)"`.
