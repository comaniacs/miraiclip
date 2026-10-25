# Video craft

Concrete defaults for videos people watch to the end. Break them when the brief says to, not by accident.

## Formats

| Target | Settings (`project/set-settings`) | Notes |
| --- | --- | --- |
| YouTube, website, landing page, slides | 1920×1080, 30 fps | Default. 60 fps only for screen recordings with fast scrolling |
| Reels, TikTok, Shorts, Stories | 1080×1920, 30 fps | Design for sound off and a thumb over the bottom |
| Instagram/LinkedIn feed | 1080×1350 (4:5) or 1080×1080 | 4:5 takes more of the feed |
| Footage shot at 24/25/29.97 | Match the footage's fps | `fps: 29.97` is stored exactly |

Set the format before adding clips. Changing it later means repositioning everything (the `reformat` skill does that).

## Safe zones

Keep text and faces inside these margins (fractions of the frame):

| Shape | Keep clear |
| --- | --- |
| 16:9 | 5% on every side (title safe). Lower thirds sit at `y ≈ 0.82–0.86` |
| 9:16 | Top 12% (status bar, account name), bottom 22% (caption, buttons), right 15% (like/share column). Captions at `y ≈ 0.68–0.72`, titles at `y ≈ 0.25–0.4` |
| 1:1, 4:5 | 6% on every side |

## Type

- One font family per video, two weights (e.g. 800 for headlines, 500 for body). With no brand font, use **Inter** (OFL): download `InterVariable.woff2` from https://github.com/rsms/inter/releases into the folder and register it once: `{ "type": "asset/add", "payload": { "id": "inter", "kind": "font", "src": "InterVariable.woff2", "family": "Inter", "weightRange": [100, 900] } }`. System fonts differ between the machine you preview on and the one that exports, so a registered font also keeps the look stable. In an editor, register the font by URL (`src` an https URL) or use one the project already has.
- Sizes for a 1920×1080 frame (scale by frame width for other shapes; on 1080×1920 use roughly the same pixel sizes, since the width is about the same):

| Role | Size | Weight | Letter spacing |
| --- | --- | --- | --- |
| Hero headline (≤ 6 words) | 110–160 px | 800 | −0.02 to −0.04 em |
| Headline | 80–96 px | 800 | −0.02 em |
| Body / supporting line | 34–44 px | 500 | 0 |
| Eyebrow / label | 24–28 px | 600, uppercase | 0.2–0.32 em |
| Captions | `fontSizeFrac` 0.045–0.06 (16:9), 0.035–0.045 (9:16) | 700–800 | 0 |

- Max ~7 words on screen at once for a headline, ~12 for a supporting line. If it needs more, it needs another scene.
- Reading time: on screen for at least `0.3 s × words + 1 s`. A 5-word title needs ≥ 2.5 s settled (after its entrance finishes).
- Contrast: white or near-white text on dark, or dark on light. Over footage, add a scrim (a gradient behind the text) or a text shadow, never bare text on a busy shot.
- Left-align multi-line text. Centre only short single lines and end cards.

## Colour

- Pick a palette before building: background, ink (text), muted text, one accent, optionally a second accent. Write them as CSS variables in every HTML clip so scenes match.
- Dark, slightly coloured backgrounds (#0a0d18 rather than #000) look finished. Pure black and pure white backgrounds look like placeholders.
- Accents go on one thing per scene: the key word, the number, the button.
- Effects as a look: one per video, low intensity (`grain` 0.1–0.15, `vignette` 0.2–0.3, `warm`/`cool` 0.2–0.4). Never stack several looks.

## Pacing

| Content | Shot or scene length |
| --- | --- |
| Social promo, hook | First 1.5–2 s must say what this is. No logo intro first |
| Motion-graphics scene | 2.5–4 s each, including the entrance |
| Talking head | Cut every pause > 0.4 s. Punch in (scale 1.1–1.2) on every other segment, or every 5–8 s, to hide jump cuts |
| B-roll over voice | 2–4 s per shot |
| End card | 2.5–3.5 s, holds still long enough to read the URL |

- Total length: social 15–45 s, product launch 30–75 s, explainer 60–120 s. Shorter is almost always better.
- Structure for promos: hook → problem or promise → 2–4 proof points (one per scene) → call to action.
- Enter elements in reading order with 80–150 ms between them (stagger). Everything arriving at once reads as a slide, not a video.

## Motion

- Entrances: 400–700 ms, ease-out (`cubic-bezier(.2,.8,.2,1)` in CSS, `smooth` or `snappy` presets). Exits: 250–400 ms, ease-in, or let a transition carry them.
- Distances: slide 40–80 px (or `OFFSET` 0.12 for presets), scale from 0.9–0.95 (subtle) or 0.6 with overshoot (pop) for one hero element per scene.
- One continuous motion per scene keeps it alive: a slow Ken Burns on the background (`--loop kenburns`), a playhead sweep, a counter.
- Between scenes: `crossDissolve` 400–600 ms by default. `slide` or `wipe` only when there's a reason (a list advancing, before/after). `dipToBlack` for a change of chapter.
- No spins, bounces or glitches unless the brief is playful.

## Audio

| Situation | Volume |
| --- | --- |
| Music alone | 0.8–1.0 |
| Music under a voice | 0.15–0.3, or duck: keyframe `volume` down 300 ms before speech, back up after |
| Voice | 1.0 (raise up to 1.5 if quiet) |
| Sound effects (whoosh on transitions, click on CTA) | 0.4–0.7, sparingly |

- Music: fade in 0.5–1 s (`fadeInUs`), fade out 1.5–3 s ending with the video. Trim the clip to end exactly at the video's end.
- Cut on the beat when you can: line scene starts up with strong beats (ask the user for the BPM, or listen for where the track changes).
- If there's no music file, say so. Don't invent one; offer to make the video without music or ask the user to add a licensed track to the folder.

## Honest content

- Numbers, claims, customer names and quotes on screen must come from the user's material. If you're not sure a claim is true, ask or leave it out.
- Don't put logos or brand names of other companies on screen unless the user supplied them.

## Review checklist

Go through it on the contact sheet and on full-size `preview_frame`s (in an editor without previews: against the project state, in numbers):

1. **First frame and first 2 s**: is there something to look at immediately, and does it say what the video is?
2. **Legibility**: every piece of text readable at phone size, on screen long enough (reading-time rule above), contrast OK over its background.
3. **Overflow and clipping**: nothing runs off the frame or out of its HTML raster (`widthPx` × `heightPx` cuts content off), no text wraps into an orphan word.
4. **Safe zones** for the target platform.
5. **Black or empty frames**: gaps between clips, a scene ending before the next starts, an animation starting from `opacity: 0` and never arriving.
6. **Consistency**: same fonts, sizes, colours and positions for the same roles across scenes.
7. **Pacing**: no scene that just sits there; nothing too fast to read.
8. **Audio**: music level under voice, fades at the ends, no audio running past the last frame.
9. **Ending**: CTA or end card holds still, then the video ends (no trailing black).
