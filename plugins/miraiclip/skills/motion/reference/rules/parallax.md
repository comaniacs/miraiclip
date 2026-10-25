# Parallax

**What:** Layers at different depths move at different speeds: far things move little, near things move a lot.
**When:** Any pan or drift over a scene with depth (backgrounds, blooms, UI panels as texture, foreground particles).
**Timing:** The whole beat (2–4 s), sine.inOut. Rough ratio far : mid : near = 1 : 2.5 : 5.
**Mistake:** Every layer at the same speed (that's a pan), or near layers so fast they pull focus from the subject.

```html
<div class="world"><div class="far"></div><div class="mid"><i></i><i></i><i></i></div><p class="title">One platform</p><div class="near"><i></i><i></i></div></div>
```

```css
.far{position:absolute;inset:-10cqh -10cqw;background:radial-gradient(circle at 30% 40%,#5ad1ff33,transparent 40%),radial-gradient(circle at 75% 60%,#ff5d8f33,transparent 45%)}.mid i{position:absolute;width:22cqmin;height:14cqmin;border-radius:1.6cqmin;background:var(--card);opacity:.7}.mid i:nth-child(1){left:8cqw;top:14cqh}.mid i:nth-child(2){left:66cqw;top:10cqh}.mid i:nth-child(3){left:58cqw;top:64cqh}.title{position:absolute;inset:0;display:grid;place-items:center;font-size:10cqmin;font-weight:800}.near i{position:absolute;width:4cqmin;height:4cqmin;border-radius:50%;background:var(--p);filter:blur(.6cqmin)}.near i:nth-child(1){left:20cqw;top:76cqh}.near i:nth-child(2){left:84cqw;top:30cqh}
```

```js
tl.label("drift", 0)
  .to(".far", { x: -S.w(3), duration: 4, ease: "sine.inOut" }, "drift")
  .to(".mid", { x: -S.w(8), duration: 4, ease: "sine.inOut" }, "drift")
  .to(".title", { x: -S.w(4), duration: 4, ease: "sine.inOut" }, "drift")
  .to(".near", { x: -S.w(18), duration: 4, ease: "sine.inOut" }, "drift");
```
