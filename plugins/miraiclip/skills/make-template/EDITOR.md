---
name: make-template
description: Design a reusable video template in the editor from a description - a short multi-scene video whose every visible word, colour and media slot becomes an editable field - for launches, product tours, agent demos, metrics reels, testimonials and similar. Use for "Create with AI" in the templates panel and whenever the user wants a template rather than one video.
---

# Make a template

Load `edit-video` first if you haven't. A template is a short, finished-looking video built so the editor can turn its texts, colours and media into a form: people fill the form and get their own video. Build it in the project as normal clips; the editor makes the fields afterwards.

## 1. Brief → beat sheet

Settle in two lines: what it's for (launch, walkthrough, results, proof…), who watches, the one thing they remember. Then write the beats before building:

```
#  Len   Beat           On screen                              Motion
1  2.6s  Hook           eyebrow + two-line claim               track-in, line 2 wipes on
2  4.2s  Line chart     title, panel, 6-point line, tooltip     line draws, dots pop
…
6  2.8s  End card       wordmark, line, button                  glow blooms, button pings
```

- 4–7 scenes, 2.6–4.4 s each (5–25 s in total; shorter when the request asks for one scene). Hook ≤ 2.8 s and says what it is. End card about 2.8 s.
- One idea per scene, at most about 7 words of headline.
- **Every scene keeps moving after it lands**: a loop, a count, a draw, a drift, a ping. A scene that animates in and then holds looks like a slide.

## 2. Build for editability

- **Text**: every visible word is either a text-style clip (`add_text_style`, if the editor has it) or a `{{placeholder}}` in an HTML clip's `params` (e.g. `{{headline}}`, `{{stat1}}`), with short placeholder copy as the value. Name params by role in reading order (`hook_line1`, `bar3_value`). Each one becomes a field.
- **Colour**: HTML clips take their colours from params named by role, as `#RRGGBB` values: `primary` and `secondary` for the two brand colours, `accent`, `bg`, `ink` (text). Brand kits match these names, so one brand change recolours the whole video. Never hard-code white text on a background that might change.
- **Data is params too**: counts, chart points, percentages; keep the HTML working for any reasonable value (a counter from 0 to `{{value}}`).
- **Media**: use the project's sample media as placeholders (each becomes a media slot). Never invent media URLs. Images inside HTML are `src="asset:<id>"`.
- **Defaults are samples**: invented names and companies, never real ones, and never present placeholder numbers or quotes as real.
- **Look**: apply the user's direction (colours, theme, style, mood) as asked. When they ask for a template for their own brand, take its colours, fonts and voice from `get_brand` (`edit-video` → Brand and direction) as the defaults of the colour params and copy.

## 3. Scenes

One animated full-frame HTML clip per scene, back to back on one track, over a background (`set_background`, or a static full-frame HTML background clip with `animate_clip` loop kenburns). Build each from `reference/html-recipes.md` in the `edit-video` skill (base kit, `--d` staggers in reading order, XML-strict markup). `reference/patterns.md` in this skill has the patterns that worked for the library's templates (counters, typing, spinner to check, spotlight, hotspots, charts, rings, avatars, star fills, walls, marquees, stamps): its classes (`.r`, `.disp`, `--spring`…) come from a build kit you don't have here, so copy the idea and the `@keyframes`, and define the classes in the scene's own `<style>`.

Between scenes: `add_transition` crossDissolve about 0.3 s. Music, if the request implies it: a sample track at volume 0.5 with a 2 s fade-out.

Pitfalls (from the template library): one start time per element (nest elements for different times); inline `<svg>` needs `xmlns="http://www.w3.org/2000/svg"`; write `<` and `>` in CSS as `&lt;` `&gt;` and `&#160;` instead of `&nbsp;`; no `transform-style:preserve-3d`; springs overshoot, so anything clipped by an edge eases out instead.

## 4. Check

`reference/scorecard.md` has the rubric. From the state: scenes back to back, every scene's entrances settled at least 1 s before its end, every visible word reachable as a field (text clip or `{{param}}`), `primary`/`secondary` used, nothing hard-coded that a theme or brand change would break.

## 5. Reply

First line: a short template name (2–4 words). Then one sentence: what it is, how many scenes, and which fields matter most.
