---
name: look
description: Invent a film's look from its subject — palette, type, finish, the frame and its grid, picture treatments — and pass it to plan_film. Load it when planning any film from a brief; reference/scenes.md has the craft for design_scene stills.
---

# Look

Every film gets its own look, taken from the subject's world, never the last film's. Decide it before `plan_film`, and pass it as `style: "custom"` with its tokens. For a brand's film, use `style: "brand"` after `get_brand`. The user's direction always wins: the colours, mood or style they name.

## Palette

- **From what the subject looks like and how it should feel.** An environmental film might take moss green, river-water teal, smog grey and a warning amber. A jazz festival might take brass and night blue; a children's science course chalkboard green and crayon colours; a fintech launch ink, paper and one signal green.
- **Four tokens:**
  - `bg`: the background;
  - `ink`: the text;
  - `primary`: the one accent;
  - `secondary`: a second accent, used much less.

  The editor derives the rest: muted text, card, line, and text on the accent.
- **Contrast:** body text must read on the background, at better than 4.5:1. The accent must stand out from both.
- **One accent:**
  - Use it on the key word, small accent shapes, the end dot, and one highlighted thing per frame.
  - An accent everywhere is no accent.
  - Photos may be the only saturated thing in the film; that is a look too.
- **Light or dark from the tone:**
  - paper and daylight for calm, craft, learning and food;
  - night and glow for tech, drama and music.

  Not dark by default.

## Type

- **A typeface that speaks the subject's language:**

  | Subject | Typeface |
  |---|---|
  | Nature, history | A humanist serif |
  | Urgency, news | A condensed grotesk |
  | Product, UI | A geometric sans |
  | Kids, playful | A rounded sans |
  | Code | A mono |
  | Something handmade | A script, only then |

  Any Google Fonts family works.
- **Two families at most:** a display face for titles (`.k-display`) and a body face.
- **Scale, in container units:**

  | Use | Size |
  |---|---|
  | Hero | 11–16 cqmin |
  | Headline | 7–10 cqmin |
  | Body | 3.6–5 cqmin |
  | Labels | 2.6–3.2 cqmin, in caps with `letter-spacing: .2em` |

  Nothing under 2.5 cqmin. A word set huge (bleeding past the edges) is a motif, not a size.
- **Setting:** tight leading on titles (1–1.05), `text-wrap: balance`, and the key word in the accent or in italic. At most about 7 words on screen in motion graphics, and about 25 in a still scene.

## Finish

- **Grain and letterbox** only for cinematic subjects (documentary, trailer).
- **Texture** belongs to the concept: paper grain, a dot grid, a notebook grid, scanlines, soft colour blooms. Make it subtle, never on top of text. Make blooms and glows with `radial-gradient(circle, <colour>, transparent 65%)`, not `filter: blur()` on a big shape.
- **Pace and joins from the tone:** slow dissolves for reflection, cuts and whips for energy.
- **Music words** that fit the subject (the media-sound skill has the rest).

## The frame

- **Units:**
  - `cqmin` for type, spacing and radii;
  - `cqw` / `cqh` for layout widths and heights;
  - in a sequence's script, `S.w` / `S.h` / `S.min`.

  Never `px` for type, never `vw` / `vh`.
- **Safe area:** keep text 6% in from every edge (`inset: 8cqh 7cqw`). With letterbox bars, keep it in the middle 70% of the height.
- **Portrait:** `@container (max-aspect-ratio: 1/1) { … }` re-lays the frame for 9:16. Stack columns and enlarge type a little. Every film should survive a `reformat` to 9:16.
- **Tokens in CSS:**

  | Variable | What it is |
  |---|---|
  | `var(--bg)` | Background |
  | `var(--ink)` | Text |
  | `var(--mut)` | Muted text |
  | `var(--p)` | Accent |
  | `var(--s)` | Second accent |
  | `var(--card)` | Card surface |
  | `var(--line)` | Hairlines |
  | `var(--onp)` | Text on the accent |

  Never hard-code a colour the plan already has, except in a sequence's tweens, which need the hex.

## Grid and composition

- **Pick a grid for the film** and keep to it:
  - a centred axis for statements;
  - thirds for picture plus caption;
  - a 12-column editorial grid for explainers;
  - a free field for playful shapes.
- **Vary the composition from beat to beat:** full-bleed, split, grid, type only, close-up crop, diagram. Never the same composition twice in a row.
- **Hierarchy:** one thing is biggest. The eye lands on it first, then the label, then the detail.
- **Balance:** no big empty half, and nothing crammed in a corner. Empty space is fine when it is meant.

## Pictures

- **Show them** with `<img src="asset:ID" class="k-cover"/>` inside a sized frame with `overflow: hidden`. Never stretch a picture; use `object-fit: cover`.
- **Treat pictures to fit the look.** Pick one treatment for the whole film:
  - **Duotone:** `filter: grayscale(1) contrast(1.1)`, plus an accent layer with `mix-blend-mode: multiply`.
  - **Frames:** rounded, film-strip edges, a polaroid border, a cut-out with a drop shadow.
  - **Texture:** soft blur and low opacity, when the pictures are atmosphere.
- **Composition:**
  - A face or subject goes on a third, not dead centre under the text.
  - Crop for a close-up: use `object-position` and a larger scale.
- **Legibility over pictures:** a gradient from the background (`linear-gradient(transparent 45%, color-mix(in srgb, var(--bg) 85%, transparent))`), the caption on a third.

## Checklist before plan_film

- The palette and type come from this subject. If it could be any brief's look, start again.
- It isn't one of the named styles unless the user named it. The editor refuses a copy of a named style.
- Text reads on the background, and the accent is used for one thing.
- You know the grid, the picture treatment and the texture.

`reference/scenes.md` is the craft for still scenes built with `design_scene` (its CSS animation classes, patterns and an example).
