---
name: captions
description: Add, fix or restyle word-timed captions or subtitles in the editor - karaoke, pop, word-by-word, boxed or subtitle-bar looks - from a transcript, an SRT/VTT the user pastes, or the editor's own transcription. Use for any request about captions, subtitles or on-screen text that follows speech.
---

# Captions

Load `edit-video` first if you haven't. Captions are `caption` clips on their own video track above everything else: one clip per short phrase, each word timed (`words: [{ text, startUs, durationUs }]`, times relative to the clip's start).

## 1. Where the words come from

| The project or user has… | Do |
| --- | --- |
| Caption clips already | Edit or restyle them; don't rebuild |
| A pasted SRT/VTT or word-timed JSON | Build caption clips from it (step 3) |
| Plain text, no timings | Spread the words evenly over the speech the user points to, about 2.5–3 words a second; say the timing is approximate |
| Nothing | You can't hear the audio. Ask the user to transcribe it with the editor's transcription feature (if it has one) or paste a transcript, then come back |

Never invent the words someone says. Fix obvious mis-hearings of names and brands; keep the word count per phrase the same so timings still line up.

Timeline time = source time + `clip.startUs − clip.trimStartUs` of the video clip the speech belongs to. If the video was recut, map each word through the segment it falls in, and drop words that were cut.

## 2. Pick a look

If the editor has a caption-look tool (`style_captions`), add the clips first, then apply a look with it (and the brand accent as its colour). Otherwise set `style` on each caption clip:

| Look | `style` | Use for |
| --- | --- | --- |
| Social karaoke (default) | `{"preset":"karaoke","fontWeight":800,"fontSizeFrac":0.055,"strokeColor":"#000000","strokeWidthFrac":0.12,"highlightColor":"#ffd400"}` | Reels, Shorts, TikTok, podcasts |
| Pop, one word big | `{"preset":"pop","display":"word","fontWeight":900,"fontSizeFrac":0.075,"textTransform":"uppercase","strokeColor":"#000000","strokeWidthFrac":0.14,"highlightColor":"#ffffff"}`, one word per clip | Hype edits, hooks |
| Boxed highlight | `{"preset":"highlight","fontWeight":700,"fontSizeFrac":0.05,"color":"#ffffff","highlightColor":"#0a0d18","activeBackgroundColor":"#ffd400"}` | Clean brand look |
| Subtitle bar | `{"preset":"plain","fontWeight":600,"fontSizeFrac":0.042,"backgroundColor":"#000000b3"}`, 6–8 words | Interviews, accessibility |
| Reveal | `{"preset":"reveal","fontWeight":800,"fontSizeFrac":0.055,"shadowColor":"#000000","shadowBlurFrac":0.3,"shadowOffsetFrac":0}` | Storytelling, quotes |

## 3. Build

- Words per clip: 3–4 for 9:16 social, 4–6 for 16:9 social, 6–8 for subtitles. Break phrases at punctuation and pauses, never mid-name.
- Position: `transform.y` 0.78–0.82 on 16:9, 0.68–0.72 on 9:16 (above the platform UI).
- `track/add` `{ "id": "captions", "kind": "video" }` on top if it's missing, then one `apply_commands` batch of `clip/add` (kind `caption`), ids `cap-1`, `cap-2`, …. Long videos: batches of about 150 commands.
- Each clip runs from its first word's start to its last word's end (a little hold, ≤ 0.3 s, is fine); clips must not overlap.

## 4. Check

From the state: phrases stay within the words-per-clip limits above (they keep a caption to two lines at these sizes); captions don't overlap a lower third or callout in time and place (move them up, `y` 0.7, while it's on); nothing runs past the video's end.

To restyle every caption, use the look tool, or one batch of `clip/set-property` `{ clipId, style }` per caption clip (style merges).

Tell the user how many captions you added, the look, and to play one stretch to check the timing.
