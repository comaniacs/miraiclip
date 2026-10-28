# Resolution: one phone is one pixel (25.6 s)

An original film built from a short brief: no voice-over, only animation, sound hits and music beats. One phone tips over and lights a single blue pixel. A 3×3 of phones resolves a picture, then a 10×10, then a 32×32 that stays dark until the drop, then a 100×100 (12,346 phones in all). The picture is the same every time, a smiling classic computer drawn in code. The film ends on one phone showing the whole picture, which winks and goes dark on the last hit.

The phones are plain rounded tiles with no marks, and the picture is drawn here, so nothing is copied from another film.

```
node build.mjs     # writes sequence.html and video.miraiclip.json from film.js
```

## Beat sheet (140 BPM, `beat(n) = 0.029 + n·60/140`)

| t (s) | What happens |
|---|---|
| 0–2.6 | Low camera on one phone. It tips in slow motion and lights one pixel |
| 2.60 | It lands on the 3×3, which spreads diagonally (small shake) |
| 3.46 (beat 8) | The 10×10 is run as one serpentine line |
| 6.89 (beat 16) | The 10×10 completes; the camera cranes up |
| 7.8–10.3 | The camera rides the front of the first line, banking at each split |
| 8.60–12.03 | The line splits into 2, 4, 8, 16 and 32 lines, one generation per 0.69 s |
| 10.3–12.2 | Stepped pull-back |
| 13.74 (beat 32) | **Drop**: all 1,024 screens light at once (flash, shake) |
| 13.6–16.7 | Chase: one line of the 100×100 outruns a low camera |
| 16.74 | The field is struck, a circular front through 10,000 phones |
| 16.7–21.4 | Surf the front, climb to a wide reveal; the picture winks on beats 50 and 58 |
| 22.31 | Dive to the one phone left standing |
| 23.6 / 24.89 | It winks, then its screen goes dark on the last hit |

## How it is built

- One `<canvas>` painted by `tl.frame(draw)`, a new kit verb that calls `draw(t)` on every seek. Each frame is a pure function of the time: the fall of each phone is `fall(generation, row, column, t)`, so seeking anywhere gives the same picture.
- Each generation is sampled from the picture at its own resolution (4×4 supersampling per phone), so every grid shows the true picture at that size.
- The camera is a keyed table (centre, zoom, tilt, roll) in `film.js`, with a decaying shake at each hit.
- Hits (`tip`, `land`, `launch`, `struck`, `drop`, `front`, `dive`, `wink`, `dark`, plus clicks along the splits, chase and front) are on the stage root as `data-stage-events`, so a score can be cut to them.

## Notes

- **Shot check.** `check_sequence` reports every beat as bare, because it looks for DOM elements that survive a beat and the film is one canvas. Read it as expected for a canvas film, not as a fault.
- **Flat phones.** The phones are drawn as tiles that fall toward the camera (thin edge to screen face), not as lit 3D models, so there are no real reflections or cast shadows.
- **Motion blur.** Export with motion blur on: the fast fronts (the chase and the surf) are where it matters.
- **Cost.** The 100×100 passes draw up to 10,000 tiles per frame, so stills are slower than in the DOM examples.
- **Sound.** The film has no audio of its own beyond the hit events. Cut your own music to the 140 BPM grid.
