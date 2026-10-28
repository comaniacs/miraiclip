# Carry-over

**What:** Something from the last beat becomes part of the next: a title becomes the label of the window that appears around it.
**When:** Every change of beat inside an act. It is the main thing that makes a film one continuous move instead of slides.
**Timing:** The hand-off move 0.5–0.8 s (expo.inOut); the new container arrives during it, never after.
**Mistake:** Fading the old element out and a new copy in: the viewer must see the same object travel.

```html
<div class="world"><div class="win"><div class="bar"><i></i><i></i><i></i></div><div class="body"><p>Hello, Sam.</p><p class="q">What are we shipping today?</p></div></div><div class="center"><p class="name">Orbit Studio</p></div></div>
```

```css
.center{position:absolute;inset:0;display:grid;place-items:center}.name{font-size:10cqmin;font-weight:800;white-space:nowrap}.win{position:absolute;left:14cqw;top:14cqh;width:72cqw;height:72cqh;border-radius:2cqmin;background:var(--card);border:.3cqmin solid var(--line);overflow:hidden}.bar{height:8cqh;display:flex;gap:1cqmin;align-items:center;padding-left:2cqmin;border-bottom:.3cqmin solid var(--line)}.bar i{width:1.4cqmin;height:1.4cqmin;border-radius:50%;background:var(--line)}.body{padding:6cqmin;font-size:5cqmin;font-weight:600}.q{color:var(--mut)}
```

```js
tl.label("name", 0)
  .from(".name", { opacity: 0, blur: 12, scale: 1.2, duration: 0.6, ease: "expo.out" }, "name")
  .label("hand", 1.3)
  // The name travels into the window's title bar; the window grows around it at the same time.
  .to(".name", { x: -S.w(22), y: -S.h(32), scale: 0.32, duration: 0.7, ease: "expo.inOut" }, "hand")
  .from(".win", { scale: 0.7, opacity: 0, blur: 10, duration: 0.7, ease: "expo.inOut" }, "hand")
  .from(".body p", { y: S.h(3), opacity: 0, duration: 0.5, stagger: 0.15, ease: "expo.out" }, "hand+=0.6")
  .camera({ zoom: 1.1, tiltY: -8, duration: 3.4, ease: "sine.inOut" }, "name");
```

## With `tl.hop`, `tl.gather` and `tl.morph` (version 2)

The hand-off can be a verb: `tl.hop` carries an element to its next slot on an arc and lands with a squash, `tl.gather` flies many elements into one container, and `tl.morph` turns one box into another. Each one records the carry, so the shot check counts it. A character can hop slot to slot: call `tl.hop` again on the same element and it leaves from where it landed. Add `shadow: true` for a contact shadow that thins out in the air, and mark layers with `data-dof` and call `tl.focus` when the shot should rack focus.

```html v2
<div class="world"><div class="dot"></div><div class="slot"><p class="label">Ready</p></div></div>
```

```css v2
.dot{position:absolute;left:12cqw;top:60cqh;width:7cqmin;height:7cqmin;border-radius:50%;background:var(--p)}.slot{position:absolute;left:62cqw;top:56cqh;width:26cqw;height:16cqh;border-radius:2cqmin;background:var(--card);border:.3cqmin solid var(--line);display:grid;place-items:center}.label{margin:0;font-size:4.4cqmin;font-weight:700}
```

```js v2
tl.label("dot", 0)
  .from(".dot", { scale: 0, duration: 0.4, ease: "back.out" }, "dot")
  .from(".slot", { opacity: 0, duration: 0.4, ease: "expo.out" }, "dot+=0.2")
  .hop(".dot", { to: ".slot", height: S.h(14), duration: 0.7 }, 0.9)
  .impact(".slot", 1.55, { squash: 0.06 })
  .from(".label", { y: S.h(2), opacity: 0, duration: 0.4, ease: "expo.out" }, 1.6)
  .camera({ zoom: 1.08, duration: 3, ease: "sine.inOut" }, "dot");
```
