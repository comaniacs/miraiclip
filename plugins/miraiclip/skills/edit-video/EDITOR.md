---
name: edit-video
description: The base playbook for editing in a Miraiclip editor - the edit loop, timing and layer rules, and where the craft references are (formats, safe zones, type, pacing, HTML title recipes, motion). Load it for any edit bigger than one change, and before any other skill.
---

# Edit video in the editor

You edit the user's open project with tools. Each request lands as one undo step when you finish. You can't watch the video, so you check your work by reading the project back (`get_state`) and by doing the geometry and timing in numbers.

## Pick the workflow

| The user wants… | Load |
| --- | --- |
| A recorded talk, interview or vlog tightened and packaged (punch-ins, captions, lower third, music) | `talking-head` |
| Captions or subtitles | `captions` |
| A launch, intro, feature promo or announcement for a product, service or business, from a brief, with no footage or only screenshots | `launch-video` (a recipe on top of `make-film`) |
| Any other film from a brief: a course or programme promo, a trailer or teaser for a show, film, book or event, a documentary, biography, recap or explainer | `make-film` |
| Motion graphics, an animated sequence or a title sequence on its own | `sequence-core` and `motion` (and `look` for its colours and type) |
| The same video in another shape (9:16, 1:1, 4:5, 16:9) | `reformat` |
| A screen recording turned into a tutorial or walkthrough | `screen-tutorial` |
| A reusable template | `make-template` |
| One change (a title, music, a transition, a look) | No other skill: the loop below |

## The loop

1. **Read** the project summary (or `get_state`). Use the ids it shows.
2. **Settle the brief** if the request is open: shape, length, tone, the one thing to remember. Ask one short question only if guessing would waste the edit.
3. **Plan** the edit as a list of steps. Give new clips and tracks readable ids (`title`, `cap-3`, `s2`).
4. **Apply**: prefer the high-level tools (`add_transition`, `animate_clip`, `add_effect`, `trim_clip`, `close_gaps`, `set_keyframes`, `set_background`, and any text, caption or audio tools the editor has). Batch everything else in `apply_commands`; it is all-or-nothing, so a failed batch applied nothing: fix and resend all of it.
5. **Check**: `get_state` after big changes. Check every new clip's start and end against its neighbours, every text against the safe zone, and that nothing ends after the video does.

## Rules that prevent most failures

- **Commands use integer microseconds** (1 s = 1000000). High-level tools take seconds.
- **Tracks are layers**: the first track is the bottom. Bottom-up: background → footage → B-roll/overlays → titles → captions. Add a track with `track/add` before putting clips on it.
- **Position with `transform`**: `x`, `y` are the clip's centre as fractions of the frame (0.5, 0.5 = centre); `scale: 1` fits the clip in the frame. `transform` in `clip/set-property` merges.
- **Keyframe times are relative to the clip's start**; `anchor: "end"` measures from its end so exits follow trims.
- **Transitions** need two clips on one track that touch exactly, and source media past the cut. Text, image, caption and HTML clips always have enough; a video clip that plays its whole file has none until trimmed.
- **Look up a command's schema** (`get_command_schema`) the first time you use it. `reference/commands.md` is the short list.
- **Never invent media.** Use assets in the project or ones a tool returned. Never invent stats, quotes or testimonials either: use the user's, or mark them as placeholders.
- **Never present sample media as the brand's product.** A sample or placeholder screenshot in a browser frame labelled with the brand's address tells viewers "this is their product" when it isn't. Use screenshots the user supplied; otherwise design an abstract UI card in HTML (shapes, the brand's colours, their real feature names), or leave that scene out.
- **HTML must parse as XML** (`reference/html-recipes.md` → Rules); the editor rejects a clip that won't, with the reason. `asset:<id>` must name an asset in the project.

## Brand and direction

Decide the look and the voice before the first scene, in this order:

1. **What the user asked for wins.** Colours, theme, style, mood, references ("like Apple", "playful", "dark and minimal"), pacing and tone of voice in the request are applied as asked, even when they differ from the brand's own. Don't trade them for a default.
2. **Otherwise, the brand's own identity.** For a named brand, company, product or website, use its real look and voice: call `get_brand` if the editor has it (the saved brand kit, or the brand's website: colours, fonts, logo, and its own headlines, buttons and copy). Use its primary colour for the accent moments, its background and text colours or a dark/light version that fits them, its fonts (or the closest the editor has), and its logo on the end card.
3. **Only when there's nothing to go on**, use the base kit's neutral palette, and say so in your reply so the user can give you their colours.

Mix them sensibly: "make it energetic" for a brand with a calm site keeps the brand's colours and type and changes the motion and copy rhythm.

**Voice**: write the copy the way the brand writes. Reuse its own terms and phrases (product names, the words in its headlines and buttons), match its sentence length and tone (plain, bold, technical, warm), and keep its capitalisation. Facts, numbers and claims come only from the user or the brand's own copy.

## Making it look good

Read `reference/craft.md` before building titles, graphics or captions: formats, safe zones, type sizes, pacing, motion timing, colour, audio levels and a review checklist.

- **Fill the frame.** A full-frame scene's root is the composition's size (1920×1080 or 1080×1920): lay content across it on the grid (16:9: x 160–1760 px), with headlines at the craft sizes (hero 110–160 px). A small block of content in one corner of a big empty frame reads as unfinished.
- **Designed text**: if the editor has a text-style tool (`add_text_style`), start there. For anything custom, use **HTML clips** (`clip/add` with `kind: "html"`) built from the tested patterns in `reference/html-recipes.md` (real CSS layout, fonts, gradients, `@keyframes`). Images inside HTML are `src="asset:<id>"`.
- **Moving whole clips**: `animate_clip` (presets: in, loop, out, easing). Hand-made moves are `set_keyframes`. `reference/motion.md` has the presets and the useful moves (punch-in, picture-in-picture, push-in, ducking).
- **Looks**: `add_effect`. At most one look per video, low intensities (0.1–0.4).
- **Audio**: music under speech at about 0.15–0.3, fade in 1 s and out 2 s, ends with the video.

## Before you finish

Go through `reference/craft.md` → Review checklist against the project state: text inside safe zones and readable sizes, no overlaps between captions and lower thirds, no gaps or black frames between clips, no clip running past the end, consistent fonts and colours.

## Hand-off

Reply in one to three sentences: what the video now is or what changed (times in seconds, names over ids), and anything the user should check (a claim on screen, a music choice). Suggest previewing the parts you changed.
