# Typewriter

**What:** Characters appear one by one with a caret that follows the last typed character.
**When:** Prompts, questions, a search box, an opening line. It makes the viewer read at the typing speed.
**Timing:** About 10–14 characters per second (0.07–0.1 s each). Caret blink 0.4 s on, 0.4 s off while holding.
**Mistake:** Typing long sentences (over about 30 characters): the viewer waits. Type the first half and reveal the rest.

```html
<div class="world"><p class="line"><span class="txt">What are we shipping today?</span><i class="caret"></i></p></div>
```

```css
.line{position:absolute;left:12cqw;top:44cqh;font-size:7cqmin;font-weight:600;white-space:nowrap}.caret{position:absolute;left:0;top:.12em;width:.07em;height:1.05em;background:var(--p)}
```

```js
const chars = S.split(".txt", "chars");
const each = 0.08;
tl.label("type", 0.4).set(chars, { opacity: 0 }, 0);
// Each character and the caret change on the same frame; the caret sits at the end of the
// last typed character (measured after fonts have loaded, so the widths are the real ones).
chars.forEach((c, i) => tl.set(c, { opacity: 1 }, "type+=" + i * each).set(".caret", { x: c.offsetLeft + c.offsetWidth }, "<"));
tl.to(".caret", { opacity: 0, duration: 0.01 }, ">+=0.4")
  .to(".caret", { opacity: 1, duration: 0.01 }, "+=0.4")
  .camera({ x: -S.w(3), zoom: 1.04, duration: 3.6, ease: "sine.inOut" }, "type");
```

Typing is opacity, not `display`: S.split gives each character an inline display of its own.
