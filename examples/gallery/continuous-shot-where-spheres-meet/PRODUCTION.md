# Where the Spheres Meet: production script

A 30-second, one-take 3D explainer drawn in three.js (with ThreeKit) and rendered frame by frame by Miraiclip.

## A. Concept

| | |
|---|---|
| **Subject** | How GPS finds your phone |
| **Audience** | Anyone who uses a map app; no maths needed |
| **Core message** | Your phone never transmits to the satellites. It listens to them broadcasting the time, turns each signal's delay into a distance, and finds the one place where those distance spheres meet. |
| **Visual metaphor** | Each delay becomes a glowing sphere around its satellite. Two spheres meet in a circle, three meet in two points, and only one of those points is on Earth: the blue dot. |
| **Single subject** | The blue "you are here" dot. The film leaves it to find out where it came from, then comes back to it. |
| **Surprise** | People assume the phone "pings" the satellite. It doesn't: GPS is receive-only. |

Accuracy notes:
- GPS orbits are about 20,200 km up. Signals travel at the speed of light, so delays are about 67–90 ms.
- The film shows each delay and distance computed from its own geometry, at 637 km per scene unit.
- A real receiver needs a fourth satellite to correct its own clock. The film says so in a footnote rather than hiding it.

## Art direction

- **Ground:** deep midnight navy `#05070d`.
- **Night Earth:** dark land and ocean, warm city lights `#ffb35a`, a thin blue atmosphere rim.
- **Signals:** each satellite has its own colour, used for its pulses, thread and sphere: cyan `#3fd8ff`, coral `#ff6f8e`, gold `#ffc35a`. "You" is a white-blue dot `#9fd0ff`.
- **Materials:**
  - Satellite bodies are gold foil (metal 0.9, roughness 0.35) with deep-blue solar cells, lit by RoomEnvironment reflections and one cool key light.
  - City blocks are dark glass with emissive window dots.
  - Signal shells and spheres are additive fresnel rims with a fine latitude grid, so they never sort.
- **Type:** Avenir Next, as in the house style. Captions at 54 px Demi Bold on the left third; labels at 19 px tracked caps; tabular figures for numbers. Lines rise through a mask and drift up as they leave. Type is a held painter, so motion blur never ghosts it.

## B. Time-coded script

| Time | Narrative | Composition and camera | Animation | Type | Sound |
|---|---|---|---|---|---|
| **0.0–4.0 Hook** | The blue dot is getting signals; nothing goes back. | Close on a night city map, 42° from vertical, slow orbit. The dot sits right of centre. | Three coloured pulses slide down thin threads into the dot; the dot breathes. | "Your phone never tells space where it is." (0.4) "It only listens." (1.6) | Low pad in F♯ minor; a soft ping as each pulse lands. |
| **4.0–9.4 Setup** | Where the signals come from. | One log-scale pull-back (×70,000) along the threads. The city becomes a cluster of lights on the night Earth, and the three satellites appear. The camera ends side-on with Earth low and the satellites high. | Each satellite broadcasts expanding shells; background satellites drift. | "GPS satellites broadcast one thing: the exact time." Label: "20,200 km up". | An airy rising whoosh. |
| **9.4–15.0 Mechanism** | Delay → distance → a sphere. | Pull back to 125 units; the aim leans toward satellite 1. | One stamped pulse travels from satellite 1 to the dot, then its sphere grows to pass exactly through the dot. | "The delay says how far away it is." Counter: "0.07 s × speed of light = 21,000 km". "So you're somewhere on this sphere." | A tick at send and receive; a swell as the sphere forms. |
| **15.0–21.0 Transformation** | Narrowing down. | A 40° orbit around the cluster, so the circle and points read in 3D. | Sphere 2 grows; their intersection circle draws itself. Sphere 3 grows; the circle is pierced at two points. The point in space dims. **Rest 20.2–20.9:** the camera holds. | "Two spheres meet in a circle." "A third leaves two points. Only one is on Earth." | A chime for the circle, two bell taps for the points, then silence for the rest. |
| **21.0–26.2 Reveal** | The answer is you. | The reverse of the setup: a log-scale dive down the line through the surviving point, back into the city. | The spheres fade out by distance; the dot lands where the three threads meet. | "Three distances. One place: you." Footnote: "A fourth satellite keeps the phone's clock exact." | A descending whoosh, then an arrival thump. |
| **26.2–30.0 Resolution** | Lockup. | Near-still drift over the map, close to the opening framing (a bookend). | Three rings converge into the dot's pulse. | "Where the spheres meet." "GPS finds you without ever hearing from you." | Resolution chord with a bell; silent at 30.0. |

## C. Storyboard

| # | Time | Frame |
|---|---|---|
| 1 | 0.5 | A glowing street grid, dark glass blocks, the blue dot with three coloured threads falling into it. |
| 2 | 6.5 | Pulling back: the city is a cluster of lights on the curve of the night Earth. |
| 3 | 9.0 | Side-on: Earth low, three gold satellites high, each ringed by broadcast shells; the label "20,200 km up". |
| 4 | 13.0 | Satellite 1's cyan sphere passes through the dot; the counter shows the maths. |
| 5 | 17.0 | Orbiting: cyan and coral spheres, and the bright white circle where they meet. |
| 6 | 20.5 | Rest: two points glow on the circle; the one in space has dimmed. |
| 7 | 23.5 | The dive: the spheres sweep past, the city rushes up. |
| 8 | 29.0 | The map, the dot, three converged rings, and the title. |

## Continuity

| Boundary | Carry |
|---|---|
| Hook → Setup | The three threads are the path the camera rises along; the dot stays the anchor. |
| Setup → Mechanism | The pull-back decelerates into the satellite view, so the camera never stops. |
| Mechanism → Transformation | Sphere 1 stays; sphere 2 grows into it. |
| Transformation → Reveal | The surviving point becomes the target of the dive. |
| Reveal → Resolution | The dive lands on the dot and eases into the closing drift. |
