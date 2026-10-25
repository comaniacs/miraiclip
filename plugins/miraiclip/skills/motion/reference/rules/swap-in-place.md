# Swap in place

**What:** One word in a fixed sentence changes: the old word slides up and out, the new one slides up into the same slot.
**When:** Lists of benefits, audiences or use cases ("Make it faster / simpler / yours"). The sentence is the carry-over.
**Timing:** Each swap 0.45 s (expo.inOut); hold each word 0.6–0.9 s.
**Mistake:** Re-typing or re-animating the whole sentence for each word.

```html
<div class="world"><div class="center"><p class="line">Make it <span class="slot"><b>faster</b><b>simpler</b><b>yours</b></span></p></div></div>
```

```css
.center{position:absolute;inset:0;display:grid;place-items:center}.line{font-size:9cqmin;font-weight:800;white-space:nowrap}.slot{display:inline-grid;overflow:hidden;vertical-align:bottom;color:var(--p);padding-bottom:.1em}.slot b{grid-area:1/1}
```

```js
const words = document.querySelectorAll(".slot b");
tl.set([...words].slice(1), { y: "110%" }, 0)
  .from(".line", { opacity: 0, blur: 10, duration: 0.5, ease: "expo.out" }, 0);
for (let i = 1; i < words.length; i++) {
  const at = "swap" + i;
  tl.label(at, 0.4 + i * 1.1)
    .to(words[i - 1], { y: "-110%", duration: 0.45, ease: "expo.inOut" }, at)
    .to(words[i], { y: "0%", duration: 0.45, ease: "expo.inOut" }, at);
}
tl.camera({ zoom: 1.06, duration: 3.4, ease: "sine.inOut" }, 0);
```

The slot is as wide as the widest word (all words share one grid cell).
