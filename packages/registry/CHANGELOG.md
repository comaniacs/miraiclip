# @miraiclip/registry

## 0.2.2

### Patch Changes

- Updated dependencies [9ac0cee]
  - @miraiclip/core@0.10.0

## 0.2.1

### Patch Changes

- Updated dependencies [5fa8674]
  - @miraiclip/core@0.9.0

## 0.2.0

### Minor Changes

- 63276db: Course scenes and a `course` format. Seven `scene-course-*` blocks (`COURSE_SCENES`) cover a course title, a syllabus, a lesson in a player, projects, an instructor, skills with a certificate, and an enrol closer. They also join `FILM_SCENES`. `FORMAT_INFO.course` gives the learner-led beat order. The new `academy` reference style uses warm white, navy, a serif and a notebook grid. The typed hook now sizes its type to its longest line (`len` field), so long questions stay in frame.
- 63276db: Film scenes and looks, as blueprints for films made from a brief:
  
  - `LAUNCH_SCENES`: animated launch scenes.
  - `DOC_SCENES`: documentary scenes.
  - `COURSE_SCENES`: course scenes.
  - `FILM_SCENES`: all three.
  - `FILM_OVERLAY`: grain, vignette and letterbox.
  - `FILM_FORMATS` and `FORMAT_INFO`: launch, course, trailer, documentary and explainer, with their story order.
  - `FILM_STYLES`: reference looks.
  - `sceneFormats(block)`: the formats a scene is tagged for.
  
  Hook lines fit their frame at any length, and inline SVG carries its namespace.
- 63276db: Film scenes, formats and styles. Nine trailer and documentary scenes (`DOC_SCENES`): a cold open, a title card, a still with a Ken Burns move and a caption, a character card, a pull quote, a case file, a chapter card, trailer hits and a title reveal. They take a `display` title font (`DISPLAY_FIELD`). `overlay-film-look` (`FILM_OVERLAY`, new category `overlay`) adds grain, a vignette and letterbox bars. Every scene is tagged with its formats (`format:launch`, `format:trailer`, `format:documentary`, `format:explainer`; `sceneFormats`). `FILM_FORMATS` and `FORMAT_INFO` describe each format's beats, openers and closers. `FILM_STYLES` holds eight reference looks (brand, documentary, hype, midnight, paper, terminal, pop, editorial) with a palette, fonts, grain, letterbox, pace, transition and music words. `FILM_SCENES` exports every scene.
- 63276db: Launch scenes: sixteen full-frame, animated `scene` blocks for launch films, teasers and promos in the fast "launch trailer" style. They are a typed hook question, a word slam on the beat, tilted prompt cards, a 3D product shot with feature chips, three feature cards, an image montage, a counting stat in a drawn ring, a wordmark reveal with a call to action, a phone-style conversation, notifications landing, a product close-up that zooms into one spot of a screenshot, before and after, steps along a drawing line, a tilted wall of feature words, a kinetic three-line statement, and a customer quote. Every scene has three looks (`look`: light, dark, brand colour; `LOOK_FIELD`, `LOOKS`), so a long film changes light. Every scene keeps moving (camera push or pan) and exits with a short blur-push. Each takes the brand as fields (`primary`, `secondary`, `bg`, `ink`, `font`; `BRAND_FIELDS`, `BRAND_FIELD_KEYS`), images as asset ids, and is sized in container units, so it works in 16:9, 9:16 and 1:1 and at any preview or export resolution. `LAUNCH_SCENES` exports them; they're also in `BUILTIN_BLOCKS` (new category `scene`).

### Patch Changes

- Updated dependencies [ba096e4]
- Updated dependencies [cdd6cf6]
  - @miraiclip/core@0.8.0

## 0.1.1

### Patch Changes

- Updated dependencies [7477fe6]
  - @miraiclip/core@0.7.0

## 0.1.0

### Minor Changes

- fd07ee1: New packages: the block registry and `miraiclip` CLI, the `<miraiclip-player>` web component, and HTML composition import/export.

### Patch Changes

- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
  - @miraiclip/core@0.6.0
