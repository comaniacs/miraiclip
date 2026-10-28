---
name: launch-video
description: Make a product or service launch, feature announcement, promo, intro or teaser film in the editor, in the brand's own look and voice — directed for this brand (a treatment), approved, then built as continuous motion-graphics acts. Use when the user wants a launch, promo or intro video and has no footage, or only screenshots and a logo.
---

# Launch video

A recipe: the launch's story order and defaults. How to direct, design and build comes from the skills `make-film` calls on (`direction`, `look`, `media-sound`, `sequence-core`, `motion`). Load `make-film` and follow its steps, with what this file adds. For a film that isn't promoting a product or business (a course, a show, a story, an event), `make-film` alone is the recipe.

When the user asks for a continuous shot, one take or no cuts, load `continuous-shot` instead and follow it; it replaces the act-by-act build below.

A launch film people watch to the end is fast, specific and always moving. A deck of cards with a headline each is not a film, even with transitions.

## Brand first

- The user's direction (colours, theme, style, mood, voice) wins.
- Otherwise call `get_brand` with the brand's site (the user's URL, or the brand's well-known domain). It reads the colours, light or dark look, fonts, logo, the site's own images and its copy, and imports the font, logo and images as `brand-*` assets. If the editor has no `get_brand`, ask the user for colours, font and screenshots.
- The film's look is the brand's: `plan_film` with `style: "brand"`. A look the user names ("like a movie trailer", "playful orbs") is designed in the brand's colours unless they say otherwise.
- **Only the brand's media goes in the film**: `brand-logo`, `brand-image-N` (each listed with what it shows), and files the user names. Anything else already in the project belongs to something else, however much it looks like a product screenshot; the editor refuses it.
- **Copy comes from the brand's own words:** its headline, product and feature names, button wording. Facts and numbers come only from the user or the brand's site. List the brand's material (headings, features, numbers, quotes, images) before writing the treatment, and give each beat its own item.

## The launch arc

1. **The problem**: the viewer's pain, concrete and visual, in their words. Many tools, lost leads, hours of busywork.
2. **The turn**: the product appears *out of* the problem. The protagonist element is born here: the scattered tools collide into it, the messy inbox folds into it.
3. **The product in action**: 2–4 things it does, each shown happening (a message answered, a booking landing, a funnel filling), each growing from the last. Use real product images where they exist, on screens or cards the camera pushes into.
4. **Proof**: one real number or name (only real ones).
5. **The call to action**: the brand's own line and the address, held and drifting.

**Defaults when the user doesn't say:**

| Setting | Default |
|---|---|
| Length | 20–35 s, as 2–3 acts |
| Music | Bright and driving, about 115–128 bpm |
| Camera | Pushing and tilting, with whip-pans or zoom-throughs between ideas |
| Type | The brand's font, set large: 1–4 words for the punches, a short line at most |
| Format | 16:9; offer 9:16 after |

A length the user asks for is a requirement, within 10%. Each extra 10 s needs new material (a feature, a proof point), not a slower film. If there isn't enough material, make it shorter and say why.

## Library scenes are blueprints

The editor's launch scenes are worked examples of single moments: a typed hook, a word slam, a 3D product card, a feature trio, a counting stat, a wordmark reveal. When one is close to a beat you want, read its code with `read_scene` and take the technique into your act. Don't fill them in as the film.

Only when `compose_sequence` isn't available does a launch fall back to `design_scene` for the brand's own moments, plus `add_scene` where a library scene fits a beat as-is.

## Deliver

Reply with:

- the length, and the length asked for if it differs, with the reason;
- the world and the protagonist chain;
- the acts in one line each;
- the look: the colours (hex) and fonts, and where they came from (the user, the brand's site or kit, or neutral defaults), and which brand images appear.

Then say what to check: claims and numbers on screen, and the music licence. Offer a 9:16 version (`reformat`).
