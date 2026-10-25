# Zoom-through

**What:** The camera pushes into an element until it fills the frame, and the next beat is already inside it.
**When:** Going deeper: from a product window into a feature, from a map into a city, from a card into its story.
**Timing:** Push 0.5–0.7 s with expo.in (it accelerates into the cut). The reset happens on a frame where only the element's colour fills the screen.
**Mistake:** Zooming into an element whose colour differs from the next beat's background: the reset flashes.

```html
<div class="world"><div class="card"><span>Automations</span></div><div class="next"><p>Every reply, <em>on time</em></p></div></div>
```

```css
.card{position:absolute;left:50%;top:50%;width:30cqmin;height:18cqmin;margin:-9cqmin 0 0 -15cqmin;border-radius:2cqmin;background:var(--card);display:grid;place-items:center;font-size:3.6cqmin;font-weight:600}.next{position:absolute;inset:0;display:grid;place-items:center;background:var(--card);opacity:0}.next p{font-size:9cqmin;font-weight:800}.next em{font-style:normal;color:var(--p)}
```

```js
tl.label("show", 0)
  .from(".card", { scale: 0.6, opacity: 0, blur: 10, duration: 0.5, ease: "expo.out" }, "show")
  .label("push", 1.2)
  .camera({ zoom: 7, duration: 0.6, ease: "expo.in" }, "push")
  .label("inside", 1.8)
  .set(".next", { opacity: 1 }, "inside")
  .camera({ zoom: 1, duration: 0.01 }, "inside")
  .from(".next p", { scale: 1.3, blur: 14, opacity: 0, duration: 0.6, ease: "expo.out" }, "inside")
  .camera({ zoom: 1.06, duration: 2, ease: "sine.inOut" }, "inside+=0.05");
```
