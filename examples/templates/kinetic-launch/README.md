# Kinetic launch

A 22 s keynote-style launch in **one continuous shot**, in 16:9 and 9:16 and four themes (paper is its own):

1. **Headline (0–2.4 s):** the first word slams in from 2.4× with blur. The accent word widens in beside it and pushes it over, and the eyebrow tracks in.
2. **Version (2.4–5 s):** the camera tilts down to the product name. Its version number rolls into place like an odometer: two digit fields, three runs of 0–9 each.
3. **Assembly (5–8.6 s):** the camera drops into the dashboard as it assembles. The sidebar flies from the left, the top bar from above, the KPI cards from below and the panels from the right. Each piece flashes as it locks, then the counters count, the chart draws and the activity slides in.
4. **Callouts (9–12.9 s):** the camera visits three areas. At each one a ring pulses on the anchor, a leader line draws, and a pill pops with the feature.
5. **Reveal (12.9–19 s):** the camera pulls back with motion blur to show the UI inside a laptop, and a phone slides up beside it with the same numbers. "Available today on" and the platform chips land. In 9:16 the reveal settles on the phone.
6. End card with the product name and version.

36 fields: every word and number, both version digits, both colours and the theme.

| Where | File | What it is |
| --- | --- | --- |
| here | `build.mjs` | World layout, camera plans, scenes |
| here | `kinetic-launch*.miraiclip.json` | Plain projects with the default copy |
| here | `notes.md`, `template.json`, `contact-sheet*.png` | Notes and scores, metadata, frames |
| `miraiclip-react-template/public/templates/` | `kinetic-launch.miraiclip-template.json` (paper), `-midnight`, `-terminal`, `-pop`, each with `-vertical` | The templates |

```bash
node examples/templates/kinetic-launch/build.mjs
```

## Tricks worth reusing

- **Odometer digit:** a column of 0–9 repeated three times, moved with `translateY(calc((20 + var(--n)) * -1em))`, where `--n` is the digit field.
- **Assembly:** each piece has one fly-in keyframe from its own side, with a slight rotation, on the spring. A child `.lk` flashes an outline 0.55 s later, when the piece lands.
- **Leader lines:** the length and angle are computed in JS from the pill and the anchor (`Math.hypot`, `Math.atan2`) and drawn on with a `clip-path` wipe.
