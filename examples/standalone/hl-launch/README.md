# One Login — HighLevel launch film (standalone, no miraiclip)

A 60 s, 1920×1080 30 fps launch film for app.gohighlevel.com. It uses real product screenshots, CSS-3D motion graphics and an original synthesized score.

**Angle:** "12 tools, 12 logins, 12 bills" → collapse → *One platform. Everything.* Each feature gets its own camera language:

| Time | Scene | Camera |
|---|---|---|
| 0–7 | Hook: 12 tool cards, "And none of them talk." | 3D card grid that drifts, splinters and is pulled into the centre |
| 7–10 | Flash, HighLevel logo, "One platform. Everything." | Zooms in and blurs into the next scene |
| 9.5–16 | Dashboard | Rises from the floor at a low angle, then glides right |
| 16–22 | Conversations | Macro pan across the inbox, pull back, channel chips |
| 22–28 | Opportunities / Calendars | Diagonal split screen with opposing motion |
| 28–34 | Workflows | Isometric plane with action nodes floating above it |
| 34–40 | Funnels / Websites / Memberships | Exploded depth stack |
| 40–46 | Social, Email, Reviews, Payments, AI Agents, Reports | Six screens, six different entrances |
| 46–52 | All screens, "All of it. One login." | 3D wall pull-back, then everything converges |
| 52–60 | Logo, "Run your entire business from one place.", URL | An orbit of screens slows to a stop; held still from 58 s |

## Pipeline
- `film.html` + `film.js` — every frame is a pure function of `window.seek(t)`. No CSS animations.
- `render.mjs` — Playwright headless Chromium screenshots each frame (6 workers), and ffmpeg encodes it with the score.
- `audio.mjs` — original 120 BPM score synthesized in plain JS and written to WAV.
- `tools/capture.mjs` — opens a visible Chromium; you log in, then it captures the product screens (and dismisses popups).
- `tools/redact.mjs` — blurs the sub-account switcher and the avatar. Originals stay in `shots/raw/`.

```sh
HL_PROFILE=/path/to/profile node tools/capture.mjs [names…]   # log in when the window opens
node tools/redact.mjs
node render.mjs --stills 3,12,20,30 # quick review → out/sheet.jpg
node render.mjs                     # ≈3.5 min → out/highlevel-one-login.mp4
```

`shots/`, `frames/` and `out/` are git-ignored: the screenshots come from a logged-in account.
