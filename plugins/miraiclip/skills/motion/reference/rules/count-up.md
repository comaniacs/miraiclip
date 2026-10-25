# Count-up

**What:** A number rolls up to its value on digit reels (each digit is a column of 0–9 that slides), like an odometer.
**When:** Stats and counters: "500 templates", "3× more calls". Rolling digits read as growth; a static number reads as a slide.
**Timing:** 1.2–1.6 s (expo.out), reels staggered 0.1 s from the last digit. Hold the result 0.6–1 s with a slow push.
**Mistake:** Inventing numbers: only count to a real figure from the brief or the user. The value is a `{{param}}`-friendly attribute.

```html
<div class="world"><div class="center"><div class="stat"><p><span class="num" data-to="500"></span><span class="plus">+</span></p><p class="cap">templates</p></div></div></div>
```

```css
.center{position:absolute;inset:0;display:grid;place-items:center}.stat{text-align:center}.stat p:first-child{font-size:22cqmin;font-weight:900;line-height:1;letter-spacing:-.03em}.slot{display:inline-block;height:1em;overflow:hidden;vertical-align:top}.reel{display:flex;flex-direction:column}.reel span{height:1em;line-height:1}.plus{color:var(--p)}.cap{font-size:5cqmin;color:var(--mut);margin-top:1.6cqmin}
```

```js
// Build one reel per digit of data-to: 0–9 twice, so each reel spins at least once.
const host = document.querySelector(".num");
const reels = [], stops = [];
for (const ch of host.getAttribute("data-to")) {
  const slot = document.createElement("span");
  slot.className = "slot";
  if (/[0-9]/.test(ch)) {
    const reel = document.createElement("span");
    reel.className = "reel";
    for (let k = 0; k < 20; k++) {
      const d = document.createElement("span");
      d.textContent = String(k % 10);
      reel.appendChild(d);
    }
    slot.appendChild(reel);
    reels.push(reel);
    stops.push(10 + Number(ch));
  } else slot.textContent = ch;
  host.appendChild(slot);
}
tl.label("count", 0.3)
  .from(".stat", { opacity: 0, blur: 10, scale: 0.9, duration: 0.5, ease: "expo.out" }, 0)
  .to(reels, { y: (i) => -stops[i] * 5 + "%", duration: 1.4, stagger: { each: 0.1, from: "last" }, ease: "expo.out" }, "count")
  .from(".plus", { scale: 0, duration: 0.4, ease: "back.out" }, ">-=0.3")
  .camera({ zoom: 1.1, duration: 3.2, ease: "sine.inOut" }, 0);
```

Each reel holds 20 digits, so stopping on digit d means moving it up by (10 + d) × 5% of its height.
