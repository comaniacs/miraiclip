# Old Light: production script

A 30-second, one-take 3D explainer drawn in three.js and rendered frame by frame by Miraiclip.

## A. Concept

| | |
|---|---|
| **Subject** | How sunlight gets out of the Sun |
| **Audience** | Curious general viewers: no physics background, 30 seconds of attention |
| **Core message** | The light on your skin is old. It spent many thousands of years bouncing its way out of the Sun, and only the last 8 minutes and 20 seconds crossing space to you. |
| **Visual metaphor** | A pinball prisoner. One photon (a warm white spark) ricochets between plasma particles. Its path is a glowing thread that is tangled while it is trapped and pulled perfectly straight once it is free. |
| **Why it works in 3D** | The story is a change of scale (atom → star → planet) and a change of shape (tangle → straight line). Both have to be seen; they're hard to tell in words. |
| **Single subject** | The photon and its thread. The camera follows it the whole way, and nothing else is ever the focus. |

Accuracy notes: the core is about 15 million °C. Published estimates of how long energy takes to random-walk out of the Sun range from about 10,000 to 170,000 years, so the film says "~100,000 years" and shows that range as a footnote. Strictly, the light is absorbed and re-emitted many times, so the film says that rather than claiming one photon survives the whole trip. Sun→Earth: about 150 million km, 8 min 20 s.

## Art direction

- **Ground:** warm near-black `#07060a`, never pure black. A faint starfield appears only once the photon is in space.
- **Palette:** amber plasma `#ff8a2a`, hot core `#fff1c8`, deep convective red `#c2361a`. One cool accent, Earth blue `#4f9dff`, held back until the reveal. Type is warm white `#fff6ea` at 92% opacity.
- **Materials:**
  - Plasma particles are emissive, unlit spheres in amber with slight per-particle variation. A particle flashes white-gold when the photon hits it.
  - The Sun's cut face uses a procedural shader: core, radiative and convective bands with soft boundaries and a thin hot line between bands. The convective band has slowly turning cells.
  - The Sun's surface is granulated emissive noise with limb darkening.
  - Earth is lit by the Sun's direction only. Oceans are deep blue, land is muted ochre and green, and a separate cloud layer drifts. It has a fresnel atmosphere rim.
  - The thread and beam are additive, constant-pixel-width lines with soft edges, so they stay crisp at any distance.
- **Glow:** additive sprite halos, not full-screen bloom, so the highlights never blow out.
- **Type:** Avenir Next. Demi Bold for captions at 54 px; Medium, tracked +0.18em, all caps at 20 px for labels; tabular figures for counters. Captions sit in the left third on one baseline. Lines enter through a mask rising 30 px and leave by fading while drifting up 12 px.

## B. Time-coded script

Times are seconds on one shared timeline (`timeline.mjs` is the single source for picture and sound).

### 1 · Hook: 0.0 – 4.4

| Element | Direction |
|---|---|
| Narrative | Something tiny and bright is trapped and frantic. |
| Composition | The photon sits a little right of centre, frame-filling amber particles go soft into depth, and the caption is on the left. |
| Assets | 2,600 plasma particles in a 60-unit cloud; the photon spark; the trail thread. |
| Camera | 40° fov. Tracks a smoothed copy of the photon position from 22 units, with a slow orbit (−10°/s). |
| Animation | The photon flies straight segments between particles. Each arrival makes that particle flash (absorbed) and the photon leaves in a new direction (re-emitted). There are 6 collisions in 4.4 s, so the rhythm reads. |
| Motion graphics | "Every ray of sunlight" (0.5), "begins as a prisoner." (1.5); both lines leave from 3.9. |
| Transition | The collision rate starts to accelerate at 4.0 and the camera begins to back away. The pullback is already moving before the hook text leaves. |
| Audio | Low drone in D. A soft glassy tick on every collision. |
| End state | The photon is mid-flight, about 8 steps of thread visible, and the camera is moving back. |

### 2 · Setup: 4.4 – 9.0

| Element | Direction |
|---|---|
| Narrative | It happens over and over, and the zoom shows where we are: inside the Sun's core. |
| Camera | A log-linear pullback from 0.018 to 48 world units (×2,700). The ease is smoothstep in log space, so the zoom speed feels constant. The look target slides from the photon to the Sun's centre, and the view settles into the cutaway angle. |
| Animation | Collisions accelerate exponentially (6 → about 60 per second) and the thread becomes a dense tangle. As the cloud shrinks to a point, the core glow blooms around it. Then the half-cut Sun (front hemisphere removed, one layered cut face) fades up from the ground colour (opaque, so there's no sorting). |
| Motion graphics | Caption "Absorbed. Re-emitted. Over and over." (4.8–8.4). A leader label "THE CORE · 15 MILLION °C" (8.0). |
| Transition | The tangle shrinks to a glowing point at the centre, and that point is the start of the Sun-scale thread. This is the same subject at a new scale. |
| Audio | A rising airy whoosh rides the zoom; the ticks blur into a shimmer. |
| End state | The Sun cross-section is right of frame, the core point glows, and the thread starts. |

### 3 · Mechanism: 9.0 – 15.0

| Element | Direction |
|---|---|
| Narrative | Every bounce is random, so getting out takes an extraordinarily long time. Near the surface, convection carries it up. |
| Camera | A slow orbit (−6°) and a push-in from 48 to 42 units; the target drifts toward the thread's head. |
| Animation | A 2D biased random walk (900 steps) draws itself across the cut face from the core to the edge of the radiative zone (9.0–13.2). It then rides one convection roll (a smooth arc) to the surface (13.2–14.1). A declared rest from 14.1 to 14.9: the head waits at the surface and pulses. |
| Motion graphics | Labels "RADIATIVE ZONE" (9.6) and "CONVECTIVE ZONE" (13.0). The counter "YEARS TO ESCAPE" rolls 0 → 100,000 and is tied to thread progress, with the footnote "estimates range 10,000 – 170,000". Captions: "Each bounce sends it somewhere random." (9.4–12.8), then "Then rising plasma carries it up." (13.0–14.9). |
| Transition | The thread reaches the surface and stops. In the rest the camera holds and the labels clear: anticipation. |
| Audio | Ticks continue under a held Bb chord. Silence thins out during the rest. |
| End state | The thread's head is a bright point on the Sun's rim, and the camera is nearly still. |

### 4 · Transformation: 15.0 – 21.0

| Element | Direction |
|---|---|
| Narrative | It breaks free, and now it travels in a straight line at the speed of light. |
| Camera | 15.0–16.4: the aim locks onto the escaping photon while the camera moves to it. 15.4–17.6: the camera orbits the flying photon, always looking at it. It starts ahead with the Sun straight behind the spark, swings round its side, and ends 4.5 units behind it, where the aim leads off down the beam. Speed rises then eases into the approach. The fov widens 38 → 50 at peak speed. |
| Animation | At 15.0 there's a flash at the rim. The tangled thread dims to 30%, and the same thread colour shoots out as a straight beam. Space dust streaks past. The Sun recedes behind. Earth grows from a dot at 18.5 to filling a third of the frame by 21. |
| Motion graphics | Caption "Then it breaks free." (15.8–18.6). The counter changes to "TO EARTH" and a clock runs 0:00 → 8:20 with "150 MILLION KM". |
| Transition | The beam lands on Earth. The ride's forward momentum carries into a curve around Earth instead of stopping. |
| Audio | A low impact at 15.0, a bright swell, a long whoosh, and the chord lifts to F. |
| End state | The photon touches Earth's dayside at 21.0. |

### 5 · Reveal: 21.0 – 26.0

| Element | Direction |
|---|---|
| Narrative | The insight: the part of the journey we think of as "sunlight travelling" is a sliver of the whole. |
| Camera | Decelerates into a slow orbit around Earth at 3.6 radii; the gibbous dayside and terminator are in view. |
| Animation | A ring of light spreads from the landing point. Clouds drift. |
| Motion graphics | A comparison bar in the lower third. The amber bar fills across: "INSIDE THE SUN · ~100,000 YEARS". A blue hairline tick sits at its end: "TO YOU · 8 MINUTES". A small note: "(the last 8 minutes are too thin to draw)". Caption "You only see the last eight minutes." (22.0–25.6). |
| Audio | Soft impact at 21.0, then a sustained C. A gentle chime as the blue tick lands. |
| End state | The bar clears and the orbit is still moving. |

### 6 · Resolution: 26.0 – 30.0

| Element | Direction |
|---|---|
| Narrative | The idea lands in one line. |
| Camera | Pulls back and rises until Earth sits right of frame and the Sun is a small glowing point upper left. That point echoes the opening frame's photon. The move eases to a near-still drift and never fully stops. |
| Motion graphics | Lockup: "Sunlight is old light." (26.4) and, beneath it, "It left the Sun's core before the first cities were built." (27.1). The straight beam between the Sun and Earth underlines the composition. |
| Audio | A D major resolution chord with a bell, decaying to silence exactly at 30.0. |
| End state | Frame 899: the lockup is fully readable and the drift is almost stopped. |

## C. Storyboard

| # | Time | Frame |
|---|---|---|
| 1 | 0.0 | A spark between soft amber spheres; a curved dark gap in the cloud. |
| 2 | 2.5 | A particle flashes and the spark turns; the caption is on the left. |
| 3 | 6.0 | Pulled back: a tangle of glowing thread inside a fading cloud. |
| 4 | 8.5 | The Sun cutaway on the right (three bands); a leader line to "THE CORE". |
| 5 | 12.0 | The thread snakes through the radiative band; the counter is at 60,000. |
| 6 | 14.5 | Rest: the head pulses at the rim and the camera is still. |
| 7 | 16.2 | Breakout: the spark blazing toward the camera, the beam behind it, the Sun's limb filling the left. |
| 8 | 18.5 | The ride: dust streaks, a small blue dot ahead, the clock at 4:10. |
| 9 | 21.2 | Landing: a ring of light on Earth's dayside. |
| 10 | 24.0 | Orbit and the comparison bar, with the blue tick at the bar's end. |
| 11 | 29.0 | The lockup: the Sun a point upper left, Earth right, the beam between them, the title. |

## Continuity (every boundary)

| Boundary | Carry | Inherits |
|---|---|---|
| Hook → Setup (4.4) | The camera is already pulling back and the photon is still flying. | The same subject and the same motion; only the scale changes. |
| Setup → Mechanism (9.0) | The micro tangle shrinks to the core point, which starts the Sun-scale thread. | The thread is the anchor; the zoom decelerates into the orbit. |
| Mechanism → Transformation (15.0) | The thread's head at the rim becomes the beam's origin. | The same colour and line, now straight. A declared rest precedes it. |
| Transformation → Reveal (21.0) | The beam lands on Earth. | The ride's forward momentum bends into an orbit. |
| Reveal → Resolution (26.0) | The orbit continues into a pullback. | Earth stays in frame and the Sun re-enters as a point. |

## Sound design (all synthesized in `audio.mjs`, original, no samples)

| Time | Event |
|---|---|
| 0.0 | A drone in D (detuned sines, slow filter swell), already present at frame 0. |
| Each collision | A glassy tick: a short sine ping at 2–3 kHz plus a noise click. Volume falls as the rate rises. |
| 4.4 – 9.0 | An airy whoosh (band-passed noise sweeping up) under the zoom. |
| 9.0 | The chord moves to Bb. |
| 14.1 – 14.9 | The rest: the drone drops 6 dB and the ticks stop. |
| 15.0 | A low impact (a 45 Hz sine thump) and a bright swell to F. |
| 15.2 – 20.8 | A long whoosh. |
| 21.0 | A soft impact and a C chord. |
| 23.4 | A chime when the blue tick lands. |
| 26.4 | A D major chord with a bell partial. It decays to −60 dB by 30.0. |
