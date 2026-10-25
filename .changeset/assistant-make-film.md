---
"@miraiclip/assistant": patch
---

New bundled skill `make-film`: it makes any film from a brief (a course promo, trailer, documentary, recap, explainer or launch). It first picks the format and style that fit the subject and tone, from the reference styles or a custom one, then builds the film from scenes. `launch-video` and `edit-video` route to it. It uses the image tools (`find_images`, `generate_image`) when the editor has them.
