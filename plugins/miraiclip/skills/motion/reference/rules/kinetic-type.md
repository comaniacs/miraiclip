# Kinetic type

**What:** Words arrive one at a time, each with its own punch (scale down from big, a little rotation), and the key word lands in the accent colour.
**When:** Short claims of 3–7 words that carry the film. Type is the main actor.
**Timing:** 0.12–0.2 s between words; each word 0.35–0.5 s (expo.out). Hold the full line 0.6–1 s while the camera keeps moving.
**Mistake:** Animating every word differently. Pick one move for the line and vary only the key word.

```html
<div class="world"><p class="kt"><span class="txt">Turn your product into</span>&#160;<em>video</em></p></div>
```

```css
.kt{position:absolute;inset:0;display:flex;flex-wrap:wrap;align-items:center;align-content:center;justify-content:center;text-align:center;padding:0 10cqw;font-size:9cqmin;font-weight:800;letter-spacing:-.02em;line-height:1.1}.kt em{font-style:normal;color:var(--p)}
```

```js
const words = [...S.split(".kt .txt", "words"), document.querySelector(".kt em")];
tl.label("say", 0.2)
  .from(words, { scale: 1.8, opacity: 0, blur: 10, rotate: (i) => (i % 2 ? 4 : -4), duration: 0.45, stagger: 0.16, ease: "expo.out" }, "say")
  .from(".kt em", { y: S.h(3), duration: 0.5, ease: "back.out" }, "<")
  .camera({ zoom: 1.12, rotate: -1.5, duration: 3.2, ease: "sine.inOut" }, "say");
```

S.split keeps styled children: the key word can stay an `<em>` inside the line, and its own `.word` spans animate with the rest.
