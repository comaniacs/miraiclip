# STILL: production script

A 30-second launch film for an invented product, built from HTML and CSS 3D only (no three.js, no WebGL) and rendered frame by frame by Miraiclip. It is one unbroken camera move with no cuts.

## A. Creative treatment

| | |
|---|---|
| **Product** | **STILL, the focus dial.** An invented desk object: a weighted puck about the size of a coaster. A knurled aluminium crown sits on a walnut base, and a frosted glass face carries a ring of 60 light segments, one per minute. Turn the crown to set a focus session. The ring lights one segment per detent click, then quietly counts the time down. |
| **Audience** | People who do deep work at a desk and are tired of their attention being sliced up: writers, engineers, designers, students. |
| **Value** | Setting focus time with a physical gesture instead of an app on the device that distracts you. |
| **Emotion** | Curiosity → desire → relief. |
| **Art direction** | Premium product photography translated into 3D: one warm key light, a cool rim, deep warm black, and amber light as the only saturated colour. Cool blue appears only in the payoff, as the colour of the distractions. |
| **Visual device** | **The ring of light.** It opens the film by drawing itself in the dark. It is the reveal's light source and the feature being shown. Then it grows into the wave that clears the noise, and it is still glowing in the final shot. |
| **Hook** | The first frame is already a designed image: amber segments drawing a circle in darkness, ticking. You don't yet know it's an object. |
| **What to remember** | "One turn to deep work." The gesture is the product. |
| **Call to action** | "Reserve yours · Coming soon". The product is invented, so there is no URL, price or date. |

No narration. The story is carried by short type and a score built around the dial's own sounds: ticks, detent clicks, a glass chime.

Claims: the product and every feature are fictional and invented for this brief. There are no performance numbers, battery life, prices or superlatives. The on-screen copy describes only what the film shows the object doing.

## B. Production script (time-coded)

Coordinates: CSS pixels in world space, y down (up is −y). The dial sits on the floor at the origin. The camera is a pose `{yaw, elev, dist, target, screen offset}`, keyed in `film/60-camera.js` and joined by a monotone cubic, so its velocity is continuous at every key.

| Time | Beat | Product state | Camera | Graphics / type | Sound | Carry into next |
|---|---|---|---|---|---|---|
| 0.00–3.65 | **Hook** | Dial is dark (key light 5 %). Segments draw clockwise from 12 o'clock on an ease-out, with a hot leading edge. The first 3 are lit on frame 0. | Top-down (elev 89°) and close (dist 470), dial offset right. Yaw drifts −24° → 8° and pulls back slightly. | "Some minutes / deserve all of you." rises through a mask on the left third. | A low A drone. A wooden tick for every five segments. | The ring closes. |
| 3.65–5.4 | **Ring closes → light** | All 60 segments flash, then settle to an idle glow by 6.2. The band under the crown blooms. The key light sweeps in from behind and lands front-left at 5.4. | The tilt from top-down to a 30° hero angle (dist 560 → 1020) while yaw continues. The move never stops. | The caption drifts out as the light arrives. | Glass chime and a sub bloom at the ring close. A whoosh under the light sweep. The Fmaj7 pad enters. | The light sweep reveals the object; the camera is already orbiting. |
| 5.0–8.5 | **Reveal** | Full object: walnut base, glowing slit, knurled crown, glass face. | Slow hero orbit, yaw 32° → 16°, elev 30° → 19°, slowly pushing in. | "INTRODUCING" eyebrow. "STILL" settles from wide tracking with a blur-in. "The focus dial." | A pulse of muted plucks at 100 BPM begins. | The push continues into the edge. |
| 8.7–10.6 | **Macro** | At rest. | Down to elev 9°, dist 580. The knurled edge fills the frame, then the camera tracks along it (yaw −2° → −20°). | None: the material speaks. | A whoosh into the edge. Dm9. | The camera pulls back as the layers lift. |
| 10.4–13.75 | **Exploded view** | The glass lifts 168 px, the crown 78, the light slit 34; the walnut base stays put. They reseat 13.1–13.75 with an accelerating ease. | Pull back to dist 1380, elev 18°, dial on the right. | Three callouts with elbow leaders drawn from each layer's visible edge: *Frosted glass · Soft light, no glare*; *Knurled aluminium · Turns in 60 firm clicks*; *Solid walnut · Weighted to stay put*. | Airy rise. A tiny glass blip per callout. A machined clack at the reseat. | The reseat click "arms" the dial; the camera rises over the face. |
| 14.1–17.35 | **Feature: turn to set** | A small grip twist, then the crown turns 150° (25 detents, eased). Each detent lights one more segment. The index mark rotates and the knurl texture slides round. | Up and over: elev 48° → 58°, pushing in. | "Turn to set." Timer counts 00:00 → 25:00 in step with the segments. "ONE SEGMENT, ONE MINUTE". | 25 crisp detent clicks, each on the frame its segment lights. A soft chime on "set". | The hand lets go; the timer starts. |
| 17.0–19.6 | **The light keeps time** | 25 segments lit; the newest breathes as it counts down. | A slow drift; the frame starts to open. | Timer 25:00 → 24:58 in real time. "The light keeps time." | The pulse continues. | The camera rises and pulls wide. |
| 20.2–22.55 | **The noise** | Unchanged. The dial picks up a cool blue spill from the cards. | Wide overhead: elev 63°, dist 2080. | Eight generic notification cards pop in around the dial, faster and faster (Mail, Team chat, Calendar, Shop, Social, News, Updates, Reminder). | Two-note pings slightly off-key against the music. The pad turns to a tense cluster. | The ring flashes. |
| 22.55–25.55 | **Payoff: the wave** | The ring flashes, and a ring of amber light (with an echo) expands along the desk from the dial. Each card flashes amber, tips back and falls away as the wave reaches it. The warm pool spreads, the blue drains. | A slow orbit (yaw 8° → 22°), then descending. | "Everything else can wait." | A deep swell, then near silence: one wide, quiet C add9. | Clean, warm desk; the camera descends. |
| 25.6–28.6 | **Hero and lockup** | 25 segments lit, the newest breathing. Halo on the desk. | Down to the final hero angle (elev 18°, dist 1110), dial above centre. | "STILL", "One turn to deep work.", and a "Reserve yours · Coming soon" pill. | Bells on the name and the tagline. Fmaj9. | |
| 28.7–30.0 | **Held final frame** | Only the counting segment breathes. | Declared rest (checked to hold still). | Complete lockup. | The music fades and ends exactly at 30.000 s. | |

### Transitions

| Boundary | Source end state | Trigger | Camera | Destination |
|---|---|---|---|---|
| Hook → reveal | Full ring, top-down, dark body | The ring closes (flash) | A continuous tilt from 89° to 30°, yaw never stops | 3/4 hero with light swept on |
| Reveal → macro | Hero orbit | Scale transition | A push from dist 900 to 580 and down to 9° | The knurled edge fills the frame |
| Macro → exploded | Tracking along the edge | Assembly (reverse) | A pull back as the layers lift | Exploded stack with callouts |
| Exploded → turn | Layers reseat with a click | Assembly | Rising over the face | The face seen from above, ready to turn |
| Turn → noise | Timer running | Camera-driven | A pull back to the wide | The dial among the cards |
| Noise → calm | Cards around the dial | Light-driven: the ring becomes a wave | A slow orbit | Empty warm desk |
| Calm → lockup | Descending | Camera-driven | Lands on the hero angle | Final composition |

Measured: the largest frame-to-frame scene score in the draft is 0.071 (ffmpeg `scene`), where a hard cut scores 0.3 or more.

## C. Storyboard

Frames from the real render, every 0.5 s: `stills/draft-1.png` (0–14.5 s) and `stills/draft-2.png` (15–29.5 s), regenerated by the commands in the README.

## D. Product and asset specification

**The dial** (`film/10-dial.js`). Four stacked cylinders. Each side is made of DOM strips (`rotateY(θ) translateZ(R)`, backface hidden), and each top is a disc `rotateX(90deg)`.

| Layer | Radius | Height (y) | Strips | Material |
|---|---|---|---|---|
| Walnut base | 214 | 0 → −30 | 72 | `rgb(74,45,28)`, two crossing grain gradients, broad soft specular (p 10, ks 0.16), lit from above by the slit's glow |
| Light slit | 200 | −30 → −40 | 48 | Emissive amber `#ffa848` → hot `#ffecc8` centre line; the top is an annulus |
| Knurled crown | 210 | −40 → −104 | 84 | Graphite anodised `rgb(62,64,69)`, knurl as fine vertical lines, an inset chamfer highlight and shadow, a sharp specular (p 46) plus a broad sheen (p 5); the top is brushed (fine circular lines and a conic highlight aligned to the half vector), with an index mark |
| Glass face | 188 | −104 → −110 | 72 | Dark frosted `#17181b`, a sharp specular (p 70) and a sliding sheen; 60 segments at r 168 (6 × 24 px, rounded), an amber glow under the glass |

**Shading.** Each strip is shaded every frame from its world normal (Lambert key, Blinn-Phong specular for the key and the rim, a rim term, and the blue card spill in the payoff). Lights are fixed in the world, so highlights travel across the metal correctly as the camera orbits:

- Key: front-left, 42° up.
- Rim: cool, from behind right.
- Light sweep: the key's azimuth travels −205° → −48° during 3.7–5.4 s.

**World** (`film/20-world.js`):

- The desk is a 9000 px plane in its own 3D context, so it can't sort over the dial. It carries a light pool, a cool pool, the amber halo, a contact shadow and the two wave rings as flat children.
- The cards are 540 × 132 px glass slabs that face the camera with a slight tilt.

**Type.** Avenir Next (Helvetica Neue / Arial fallback):

- Captions: 66 px Demi Bold, on the left third from x 160, rising through masks.
- Eyebrows and labels: 20 px tracked caps in warm sand.
- The name: 156 px at +0.34 em tracking.
- The timer: 168 px with tabular figures.

**Palette.** Ground `#0b0a09` → `#16130f`, ink `#f6efe6`, amber `#ffa848` / hot `#ffecc8`, sand `rgba(255,214,170,.82)`, distraction blue `rgba(90,140,255,…)`.

## E. Sound

`audio.mjs` synthesizes everything (original, nothing licensed):

- A detuned-sine pad through seven chords: A5 → Fmaj7 → Dm9 → Fmaj9 → E(b9, #11) cluster → C add9 → Fmaj9.
- A pluck pulse at 100 BPM (5.0–20.2 s).
- Wooden ticks (hook), glass bells (ring, callouts, set, wave, name), band-pass whooshes (light sweep, macro, explode, the inhale and passing of the wave), sub thuds (bloom, reseat, wave), 25 machined detent clicks timed to `detentTimes()`, and 8 notification pings.
- Schroeder reverb on a send bus, a soft clip, and a fade to 0 that ends at exactly 30.000 s. `render.mjs` normalizes to −16 LUFS for the web.
