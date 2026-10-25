---
"@miraiclip/registry": minor
---

Film scenes, formats and styles. Nine trailer and documentary scenes (`DOC_SCENES`): a cold open, a title card, a still with a Ken Burns move and a caption, a character card, a pull quote, a case file, a chapter card, trailer hits and a title reveal. They take a `display` title font (`DISPLAY_FIELD`). `overlay-film-look` (`FILM_OVERLAY`, new category `overlay`) adds grain, a vignette and letterbox bars. Every scene is tagged with its formats (`format:launch`, `format:trailer`, `format:documentary`, `format:explainer`; `sceneFormats`). `FILM_FORMATS` and `FORMAT_INFO` describe each format's beats, openers and closers. `FILM_STYLES` holds eight reference looks (brand, documentary, hype, midnight, paper, terminal, pop, editorial) with a palette, fonts, grain, letterbox, pace, transition and music words. `FILM_SCENES` exports every scene.
