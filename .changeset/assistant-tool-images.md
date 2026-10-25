---
"@miraiclip/assistant": minor
---

Tools can return images, and films from a brief have a new skill set.

- `ToolOutput` takes `images` (`ChatImage`: `mimeType` plus base64 `data`), and the assistant sends them to the model with the tool's result:
  - Anthropic gets them inside the `tool_result`.
  - OpenAI and Gemini get them in a message right after the run of tool results.
- Only the latest two image-bearing results keep their pictures. If a model refuses images (400), the turn continues with text only.
- `tool-end` events carry the tool's `images`, so apps can show them, for example a storyboard.
- `MIRAICLIP_SKILLS` splits film-making by job:
  - `direction`: brief to treatment;
  - `look`: palette, type and finish from the subject;
  - `media-sound`: pictures, music first, sound effects;
  - `sequence-core`: the contract for stage-kit sequences;
  - `motion`: the motion-graphics grammar, 32 techniques with working code, and breakdowns of whole films.
- `make-film` and `launch-video` are recipes on top of these skills: direct, plan the look, approve, music first, build continuous acts, check.
