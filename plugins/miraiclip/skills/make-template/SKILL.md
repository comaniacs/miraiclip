---
name: make-template
description: Make a reusable, editable Miraiclip video template (a .miraiclip-template.json with a form of fields) from a brief - launch film, product tour, agent demo, metrics reel, testimonials and similar - in four themes and both 16:9 and 9:16, then check it in the React studio. Use when the user wants a template, a template variant, or a new example for the template library, not a one-off edit of one video.
---

# Make a template

A template is one `build.mjs` that turns a list of **scenes** (HTML motion graphics) and **fields** (the form people fill in) into eight template files: four themes × 16:9 and 9:16. Every visible word, both brand colours, any image and the theme are fields, so one template becomes many videos without code.

This is a different job from editing one video. The `edit-video` skill and its `reference/html-recipes.md` still apply to the HTML itself: XML-strict markup, `--d` timing, fonts as assets. This skill adds the template layer and the shared kit, and the patterns that held up across the first five examples.

## What you work with

```
<templates-root>/
  _kit.mjs                 the shared kit: motion, themes, formats, the build step
  <id>/build.mjs           one template: fields + scenes (start from kit/starter.mjs)
  <id>/assets/             images it ships with (uploaded to the asset host, loaded by URL)
  <id>/README.md, notes.md, template.json, contact-sheet*.png
```

- **In the Miraiclip repo**, the templates root is `examples/templates/`, and its `_kit.mjs` is the source of truth. Use it as is.
- **Anywhere else**, copy `kit/_kit.mjs` from this skill into the templates root and `npm i @miraiclip/core @miraiclip/templates`.
- **To check your work**, you need the Miraiclip React studio running (`npm run dev` in `miraiclip-react-template`, http://127.0.0.1:5173) and `npm i playwright` in the folder you run `scripts/frames.mjs` from.

Paths below: `SKILL_DIR` is this skill's folder (`${CLAUDE_PLUGIN_ROOT}/skills/make-template`).

## 1. Brief → beat sheet

Settle in two lines: what it's for (launch, walkthrough, results, proof…), who watches, the one thing they remember. Then write the beat sheet before any code:

```
#  Len   Beat                      On screen                               Motion
1  2.6s  Hook                      eyebrow + two-line claim                track-in, line 2 wipes on
2  4.2s  Line chart               title, panel, 6-point line, tooltip      line draws behind a scan line, dots pop
…
7  2.8s  End card                  wordmark, line, button                  glow blooms, dot drops, button pings
```

- 6–7 scenes, 2.6–4.4 s each, 20–25 s in total. Hook ≤ 2.8 s and says what it is (no logo sting). End card 2.8 s.
- One idea per scene, at most about 7 words of headline.
- **Every scene must keep moving after it lands**: a loop, a count, a draw, a drift, a ping. A scene that only animates in and then holds looks like a slide; that was the main weakness of the studio's built-in templates.
- Pick the template's **own theme** (its default look) and make it differ from neighbouring templates. Themes: `midnight` (dark, Inter, springs), `paper` (serif, ink, ruled paper, slides in from the left), `terminal` (mono, scanlines, stepped flicker, hard cuts), `pop` (chunky type, outlines, halftone, bounces).

## 2. Plan the fields

- Every visible word is a text field with a `maxLength`, labelled `Scene · role` ("Hook · line 1", "Bar 3 · value"), in reading order.
- `primary` and `secondary` colour fields, named exactly that, so the studio's Brand kit recolours the video too.
- `themeField("<own theme>")` first.
- **Data is fields too**: counts, chart points, bar values, ratings, percentages. Give them a `pattern` and a description that says the range ("0–100").
- Images are `asset` fields with `assetId` and a **default URL** (hydrate fails without one) and a description of the shape that works.
- Defaults are samples. Never present invented numbers or quotes as real: they are placeholders the user replaces. Use invented names and companies, never real ones.

## 3. Build from the starter

```bash
mkdir <templates-root>/<id> && cp "$SKILL_DIR/kit/starter.mjs" <templates-root>/<id>/build.mjs
```

A scene is `{ seconds, uses, css, body, vertical, last? }`:

- `uses` lists every field the scene's HTML reads as `{{name}}`. The build fails if one is missing, and also if a field is used by no scene.
- `css` is written for 16:9 (1920×1080, content between x 160 and 1760). `vertical` is the 9:16 overrides (1080×1920, an 80 px gutter, about 920 px of width, headlines near y 300–720). It is the same markup and timing, re-laid-out.
- `body` is the markup. Start times are `style="--d:.4s"` on each element, in reading order. **One element has one start time**: to fade something in at 1 s and out at 3 s, nest two elements.
- `last: true` on the end card (no exit).

Each scene is wrapped by the kit: `.cam` (a slow push or pan for the whole scene) and `.x` (the exit in the last 0.5 s, per theme). Between scenes there is a 0.3 s dissolve. A grain-textured background clip drifts underneath.

**Kit vocabulary** (all in `_kit.mjs`):

| Use | For |
| --- | --- |
| `.disp` | Display type (the theme's display font, weight, tracking) |
| `.r` `.f` `.p` | Rise in (themed direction), fade, pop |
| `.ty` `.tx` `.r3` | 3D swing on Y, tip up on X, rise out of the floor |
| `.w` | Wipe on (left to right) |
| `.typed` + `.caret` | Typing with `steps()`; set `animation-duration` per line |
| `.grad` | Accent text: gradient (midnight), italic colour (paper), glow with a `> ` prompt (terminal), highlighter block (pop) |
| `.eyebrow`, `.mono` | Small tracked label, monospace |
| `var(--spring)` `var(--bounce)` `var(--out)` `var(--move)` | Easings. `--move` is the theme's own: spring, ease, steps or bounce |
| `--ink --muted --dim` | Text colours |
| `--surface --surface2 --border --r --rs --shadow --glow` | Cards |
| `--solid --on-solid --on-p --shade` | Buttons, chips, scrims |
| `calc(<px> * var(--ds))` | Display sizes (serif and mono run larger or smaller) |
| keyframes `lift clear fadein fadeout grow growY reveal shimmer popIn slideIn spin gone blink dots type` | Use them by name in your own rules |

**Theme-safe styling**: only ever colour with these variables or `{{primary}}` / `{{secondary}}`. White text disappears on paper and pop, and dark cards look wrong there, so never hard-code `#fff` for text or a dark colour for surfaces. For a theme-specific fix, write `.t-pop .x{…}` etc.

The patterns that worked (counters, typing, spinner to check, spotlight, hotspots, data-driven charts, rings, avatars, star fills, walls, marquees, stamps…) with their code are in `reference/patterns.md`. Read it before writing scenes: most beats are a pattern plus copy.

## 4. Build the files

```bash
node <templates-root>/<id>/build.mjs
```

It writes `<id>[-<theme>][-vertical].miraiclip-template.json` to `OUT_DIR` (in the repo, the React studio's `public/templates`), and a plain project with the default copy for each next to `build.mjs`. The first theme in `themes` gets no suffix.

Assets load by URL. `paths(here, id).asset(file)` gives `${ASSET_BASE}/templates/<id>/<file>`, with `ASSET_BASE` defaulting to `https://assets.miraiclip.com`. Theme fonts are shared under `templates/_shared/`. In the repo, `node examples/templates/upload-assets.mjs <id>` uploads `<id>/assets/`. To check before uploading, serve the files locally: copy them under the studio's `public/assets-test/templates/…` and build with `ASSET_BASE=http://127.0.0.1:5173/assets-test`. Remove that folder afterwards.

## 5. Check it in the studio

Never call a template done without looking at its frames.

```bash
node "$SKILL_DIR/scripts/frames.mjs" <id>/<id>.miraiclip.json /tmp/<id>/a 2.0,5.6,10.2 --cols 4
```

This opens the project in the running studio, seeks to each time, waits for the preview to settle, saves one PNG per time and writes `…-sheet.png`. Look at the sheet with the Read tool.

1. **Settled frames**: one per scene at start + about 0.75 × its length, in all four themes (the themed projects sit next to `build.mjs`). Then the same for 9:16 in at least two themes, one dark and one light.
2. **Motion beats**: two or three times inside the busiest scenes, to see that things arrive in order.
3. Look for:
   - text overflowing its card or the frame;
   - collisions between elements;
   - anything invisible in one theme (white on paper, a colour on pop's circles);
   - a counter or chart that never finished;
   - empty halves of the frame in 9:16;
   - a scene that stops moving.
4. Fix, rebuild, and capture the scenes you changed again.

If one frame is blank or clearly from another moment, capture that time again before you believe it. The preview can show a stale raster.

## 6. Score and write it up

Score it against the rubric in `reference/scorecard.md`, side by side with the closest reference in its category if there is one. It passes when look and motion are equal or better, and editability and formats are better. Then write:

- `notes.md`: checks done, fixes made while checking, the score table, craft notes (new patterns or pitfalls you hit).
- `README.md`: what it is, the scenes in one line each, the files table, the build command, any trick worth reusing.
- `template.json`: catalog metadata (shape in `reference/scorecard.md`).
- Contact sheets: `contact-sheet.png` (motion beats), `contact-sheet-themes.png`, `contact-sheet-vertical.png`.

Add any new pattern or pitfall to `reference/patterns.md` so the next template starts from it.

## 7. Hand over

Tell the user:
- the template name, its length and the number of fields;
- the eight files and where they went;
- the scenes in one line;
- the score;
- what is left for them, usually the browser export and the speed-1.00 playback check on their machine.

Leave exporting to the user unless they ask you to export. Don't name the reference products you compared against in anything public: README, docs, commit messages or changelogs.

## Pitfalls that cost the most time

- **One start time per element.** All of an element's animations share its `--d`. Nest elements for different times.
- **Inline `<svg>` needs `xmlns="http://www.w3.org/2000/svg"`**, or it silently draws nothing. Use `style="fill:color-mix(…)"`, not `fill="color-mix(…)"`.
- **Write `<` and `>` in CSS as `&lt;` and `&gt;`**, e.g. `@property --n{syntax:'&lt;integer&gt;'…}`. Write `&#160;`, not `&nbsp;`.
- **No `transform-style:preserve-3d`.** It leaves ghost layers. One element with `perspective(…) rotateX(…)` in its own transform is fine.
- **A `filter` on a child of a `background-clip:text` element makes the text vanish.** Put the blur on the wrapper.
- **Springs overshoot**: anything clipped by a panel edge (timeline clips, bars) should ease out instead.
- **`clip/set-property` silently drops keys it doesn't know**; keyframes go through `keyframe/set` (the kit already does this).
- **Asset fields need a default URL**, and the asset host must send CORS headers for fonts.
- **Terminal's `.grad` adds a `> ` prompt.** Turn it off where it reads wrong: `.t-terminal .big .grad::before{content:none}`.
- **Pop's corner circles** cover 9:16 headlines and top-right values: keep text off them, or use `var(--ink)` there.
