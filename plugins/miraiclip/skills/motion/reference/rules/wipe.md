# Wipe

**What:** A panel is revealed by a moving edge (clip-path inset), with an accent bar riding the edge.
**When:** Before/after, revealing a screenshot or picture, replacing one colour field with another.
**Timing:** 0.6–0.9 s (power3.inOut). The bar moves with exactly the same timing and ease as the clip.
**Mistake:** A wipe with no visible edge: it looks like a rendering glitch. Give it a bar or a hard colour edge.

```html
<div class="world"><div class="panel"><p>After</p></div><i class="edge"></i></div>
```

```css
.panel{position:absolute;left:15cqw;top:20cqh;width:70cqw;height:60cqh;border-radius:2cqmin;background:var(--p);color:var(--bg);display:grid;place-items:center;font-size:12cqmin;font-weight:900}.edge{position:absolute;left:15cqw;top:16cqh;width:1cqmin;height:68cqh;background:var(--ink)}
```

```js
tl.label("wipe", 0.4)
  .fromTo(".panel", { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.8, ease: "power3.inOut" }, "wipe")
  .fromTo(".edge", { x: 0 }, { x: S.w(70), duration: 0.8, ease: "power3.inOut" }, "wipe")
  .to(".edge", { opacity: 0, duration: 0.2 }, ">")
  .camera({ zoom: 1.05, duration: 2.6, ease: "sine.inOut" }, 0);
```
