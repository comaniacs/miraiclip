# Retype in place

**What:** A typed line deletes back to the caret and a new line types on the same baseline: the same object, a new idea.
**When:** A question that turns into its answer, a before/after line, "hand-animating" → "your launch video?".
**Timing:** Delete at twice the typing speed (0.03–0.04 s per character). 0.2 s pause with the caret blinking, then type.
**Mistake:** Clearing the line with a fade or a cut: the carry-over is the caret staying put.

```html
<div class="world"><p class="line"><span class="a">Still hand-animating</span><span class="b">your launch video?</span><i class="caret"></i></p></div>
```

```css
.line{position:absolute;left:12cqw;top:44cqh;font-size:7cqmin;font-weight:600;white-space:nowrap}.b{position:absolute;left:0;top:0;color:var(--p)}.caret{position:absolute;left:0;top:.12em;width:.07em;height:1.05em;background:var(--ink)}
```

```js
const a = S.split(".a", "chars"), b = S.split(".b", "chars");
const end = (c) => c.offsetLeft + c.offsetWidth;
tl.set([...a, ...b], { opacity: 0 }, 0).label("a", 0.3).label("del", 2.2).label("b", 3.1);
a.forEach((c, i) => tl.set(c, { opacity: 1 }, "a+=" + i * 0.07).set(".caret", { x: end(c) }, "<"));
a.slice().reverse().forEach((c, i) => tl.set(c, { opacity: 0 }, "del+=" + i * 0.035).set(".caret", { x: c.offsetLeft }, "<"));
b.forEach((c, i) => tl.set(c, { opacity: 1 }, "b+=" + i * 0.07).set(".caret", { x: end(c) }, "<"));
tl.camera({ zoom: 1.06, x: -S.w(2), duration: 4.6, ease: "sine.inOut" }, 0);
```
