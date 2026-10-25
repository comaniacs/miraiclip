---
name: talking-head
description: Package a recorded talk, interview, podcast clip or vlog in the editor - punch-ins on every other segment to hide jump cuts, captions, a lower third with the speaker's name, music under speech and an end card. Use when the project has footage of someone speaking and the user wants it tightened or packaged.
---

# Talking-head package

Load `edit-video` first if you haven't; its loop and `reference/craft.md` apply.

You can't hear the audio, so you can't find pauses or fillers yourself. Cutting by speech needs word timings: caption clips already in the project, a transcript the user pastes, or the editor's own transcription or cleanup feature (if it has one, point the user to it and continue with the rest). Never cut blind at guessed times.

## 1. Brief

From the request (ask once if it matters): platform and shape, who is speaking (name and role, for the lower third), keep it verbatim or trim to the best part. Defaults: same shape, captions, lower third, no music unless asked.

## 2. Cuts (only with word timings)

- With words: keep everything except pauses longer than about 0.45 s (leave 120 ms around words) and filler words (um, uh, erm, hmm). Do it with `clip/split` at both ends of each removed range, `clip/remove` the middle, then `close_gaps`.
- To trim to the best part: pick the passage from the transcript (start on a strong sentence, not a greeting) and `trim_clip` to it.
- Report the before and after length.

## 3. Punch-ins

Every hard cut inside the same shot shows as a jump. On every other segment: `clip/set-property` `{ "transform": { "scale": 1.15, "y": 0.53 } }` (the slight `y` keeps the head in frame). Skip segments shorter than 1 s. Without cuts, punch in on a new segment every 5–8 s only if the user wants movement.

## 4. Captions

Follow the `captions` skill. For 9:16: 3 words per clip, `y` 0.7.

## 5. Lower third, music, end card

- **Lower third** at 1–2 s for 5 s: a text-style tool's lower third if the editor has one, else the Lower third recipe in `reference/html-recipes.md` with the name and role. `animate_clip` in from-left, out fade, easing snappy. While it's on, captions move up (`y` 0.7), or put the lower third top-left (`y` 0.12).
- **Music** only if asked: under speech at 0.12–0.2, fade in 1 s, out 2 s, trimmed to end with the video.
- **End card** (optional): a 3 s HTML scene after the last segment with name and handle or URL; crossDissolve from the last segment if it has headroom.

## 6. Check and hand off

From the state: captions never overlap the lower third, punch-in values the same on alternating segments, no gaps, music ends with the video. Report the length, what was cut (if anything), and ask the user to watch one punch-in to check the framing.
