---
name: make-film
description: Make any film from a brief in the editor — a product or service intro, a launch or promo, a course or programme promo, a trailer or teaser, a documentary, biography or recap, an explainer — directed for the brief (a treatment), with its own look, built as continuous motion-graphics acts (compose_sequence) or designed scenes. Use whenever the user asks for a video about something and has no footage to edit, or only a few stills.
---

# Make a film from a brief

**Design for the brief; don't fill a template.** The user asked for *their* film. Invent the world, the look and the moves that belong to this subject, then build them. A film assembled from the same parts as the last one reads as a template, whatever the words.

Load `edit-video` first if you haven't (its Brand and direction rules apply). This recipe calls on five skills, each for one job. Load each with `load_skill` when you reach its step:

| Skill | Its job |
|---|---|
| `direction` | Brief → treatment: the world, the protagonist element, acts and a timed beat sheet |
| `look` | Palette, type, finish, grid, picture treatment, from the subject |
| `media-sound` | Pictures (find or generate), music chosen first, sound effects, mix |
| `sequence-core` | The contract for compose_sequence acts: the stage kit API and its rules |
| `motion` | The motion-graphics grammar and about 30 techniques, plus breakdowns of whole films |
| `continuous-shot` | When the ask is a continuous shot, one take, no cuts, or "not a slideshow": three concepts, a beat sheet, and a measured check of every beat |

## 1. Read the brief

Decide, in one line each:

- **Subject**: what the film is about, by name.
- **Format**: the job the film does:

  | The brief is… | Format |
  |---|---|
  | A product, app, service, business or feature to introduce or promote (not a course) | `launch` |
  | A course, class, bootcamp, workshop, certification or learning programme | `course` |
  | A show, film, book, game, album or event to tease | `trailer` |
  | A real story: biography, history, true crime, a recap, a profile | `documentary` |
  | How something works, a concept, a process | `explainer` |

- **Build mode**:
  - **Motion graphics** (`compose_sequence`) whenever it is available. Use it for launches, intros, promos, explainers, courses and trailers, and for anything where the user says "motion graphics", "animated", "dynamic", "kinetic", or names shapes or type as the subject. The film is a few continuous acts.
  - **Designed scenes** (`design_scene`, with `add_scene` where a library scene fits) for documentaries built on stills, or when `compose_sequence` isn't available. The film is a row of scenes joined by dissolves.

The user's own direction always wins: a style, colours, a mood, a length.

## 2. Direct

Load `direction` and write the treatment. It covers:

- the world;
- the protagonist chain;
- the promise;
- acts with a timed beat sheet, with a technique and a carry-over per beat;
- words per beat;
- the look, camera and music direction.

Read the closest breakdown in `motion` → `reference/breakdowns/` to borrow its grammar.

## 3. Look, plan and approval

Load `look`, decide the palette, type and finish for this subject, and call `plan_film` with:

- `format`, `subject`, `seconds`, `reason`;
- the look as `style: "custom"` tokens (or `style: "brand"` after `get_brand`; a named style only when the user names it);
- the `concept`, from the treatment:
  - idea = the world;
  - motif = the protagonist element;
  - layout = the grid;
  - motion = the camera's character;
  - imagery = the shot list.

It registers the fonts and returns the film's tokens and music words.

Then record the treatment with `direct_film`. It checks the treatment and shows the user a storyboard. **Unless the user said to just make it, end your turn and wait for their approval** (the chat offers Approve & build and Change direction). Revise with `direct_film` if they ask for changes.

## 4. Material (after approval)

A film from a brief gets its own timeline. First remove the project's existing clips and tracks, in one `apply_commands` batch, unless the user asked to add to this project. Use 16:9 unless asked. Then load `media-sound`.

- **Words come from the subject's world.** Use its real names, facts, lines and dates. Never invent people, numbers, reviews or quotes; mark a paraphrase as one ("— paraphrased"). The editor refuses placeholder copy.
- **Pictures:** only the subject's own (user-added, `brand-*`, or from `find_images` / `generate_image`). Get them before building.
- **Music first:** add the music under the whole film (volume 0.7, fade in 1 s and out 2 s). Then call `get_beat_grid`. It measures the beats and gives every act its beat times (`S.beat(n)`), so the big moves land on the music.

## 5. Build

**Motion graphics.** Load `sequence-core` and `motion`. Then compose one `compose_sequence` per act, in order:

- Each act is one timeline. Elements persist and transform; the camera keeps moving (stillness only in a declared `tl.rest`); beats are labels; each beat grows out of the last.
- The next act starts where the last one ended.
- Look at each filmstrip and fix the act with `replace` before composing the next.
- Use `design_scene` only for a single still moment, if one is needed at all.

**Designed scenes.** Read `look` → `reference/scenes.md`.

- Use `design_scene` for the film's own moments: your HTML and CSS following the concept. Check every preview, and fix it with `replace`.
- Use `add_scene` only where a library scene fits a beat as-is.
- Vary the compositions; don't settle into a loop.
- Scenes dissolve into each other. Dip (`join: "dip"`) only at chapter breaks, and fade out (`fadeOut`) only at the very end.

**Both modes:**

- Use quote marks only for real quotes, with the speaker.
- A film *about* an organisation isn't *by* it: no official-looking end card, no logo lock-up or "Join us" unless the user is that organisation. Credit the sources.
- Once the acts are in, place sound effects on the big moves with `add_sound_effects` (a whoosh on a whip, a pop on a pop-in, an impact on a collide), and check that the music still runs to the end.

## 6. Check and deliver

`preview_film` shows the film and measures its motion. When a reviewer model is set (AI settings → Reviewer), call `review_film` next. It sends the film to that model for notes with times, fixes and a verdict. Fix the notes that matter; if you disagree with one, say why in your reply.

Check that:

- it reads as one piece;
- the length is within 10% of what was asked;
- there is no unrelated media;
- the music runs to the end.

Reply with:

- the length;
- the world and the protagonist chain, in one line each;
- the look in one line;
- the acts or beats in one line each;
- what to check (facts, quotes, image rights, music licence).

Offer their own pictures, a 9:16 version (`reformat`), or another direction.
