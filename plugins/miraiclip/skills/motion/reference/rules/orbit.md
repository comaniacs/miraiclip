# Orbit

**What:** Satellites circle a hub: the ring rotates and each satellite counter-rotates so its label stays upright.
**When:** Ecosystems, integrations, "everything connects to one place", a playful idle loop around a logo.
**Timing:** A slow turn (60–120° over 4–6 s, linear or sine.inOut) while other beats happen; satellites pop in with a stagger.
**Mistake:** Spinning fast or a full turn per second: it becomes a loading spinner.

```html
<div class="world"><div class="hub">Hub</div><div class="ring"><span>SMS</span><span>Email</span><span>Calls</span><span>Chat</span><span>Ads</span><span>Pay</span></div></div>
```

```css
.hub{position:absolute;left:50%;top:50%;width:22cqmin;height:22cqmin;margin:-11cqmin 0 0 -11cqmin;border-radius:50%;background:var(--p);color:var(--bg);display:grid;place-items:center;font-size:5cqmin;font-weight:800}.ring{position:absolute;left:50%;top:50%;width:0;height:0}.ring span{position:absolute;left:-6cqmin;top:-6cqmin;width:12cqmin;height:12cqmin;border-radius:50%;background:var(--card);border:.3cqmin solid var(--line);display:grid;place-items:center;font-size:2.8cqmin;font-weight:600}
```

```js
const sats = document.querySelectorAll(".ring span");
const R = S.min(32);
tl.set(sats, { x: (i) => R * Math.cos((i / sats.length) * 2 * Math.PI), y: (i) => R * Math.sin((i / sats.length) * 2 * Math.PI) }, 0)
  .label("in", 0)
  .from(".hub", { scale: 0, duration: 0.5, ease: "back.out" }, "in")
  .from(sats, { scale: 0, opacity: 0, duration: 0.45, stagger: 0.08, ease: "back.out" }, "in+=0.3")
  .to(".ring", { rotate: 90, duration: 5, ease: "linear" }, "in")
  .to(sats, { rotate: -90, duration: 5, ease: "linear" }, "in")
  .camera({ zoom: 1.08, tiltX: 10, duration: 5, ease: "sine.inOut" }, "in");
```

Place satellites with x/y on the satellites themselves, never with a CSS transform (the timeline owns `transform`).
