---
name: talking-head
description: Recut a recorded talk, interview, podcast clip, tutorial or vlog with the Miraiclip MCP server - cut pauses and filler words, punch in to hide jump cuts, add karaoke captions, a lower third, music and an end card. Use when the user has footage of someone speaking and wants it tightened or packaged.
---

# Talking-head recut

Turn a raw recording of someone speaking into a tight, captioned video. Read the `edit-video` skill first: its loop, rules and `reference/craft.md` apply here.

```bash
MC="node ${CLAUDE_PLUGIN_ROOT}/scripts/mc.mjs"
```

## 1. Brief and setup

Find out (from the request, or ask once): target platform and shape, target length, who is speaking (name and role, for the lower third), and whether to keep it verbatim or trim to the best part. Defaults: same shape as the footage, cut pauses and fillers only, karaoke captions, no music.

`get_state`, set the format (`project/set-settings` to the footage's size and fps unless reformatting), then probe and add the footage: `$MC probe interview.mp4`.

## 2. Transcript

Word-level timestamps drive the cuts and the captions.

1. If the user has a transcript with word times (Whisper JSON, `{ words: [...] }`) or an `.srt`/`.vtt`, use it.
2. Otherwise: `$MC transcribe interview.mp4 --out words.json` (uses `faster-whisper` or `openai-whisper` if installed; `--model small` is better than the default `base` for names and jargon, but slower).
3. If neither engine is installed, it exits with install instructions. Ask the user before installing anything (`pip install faster-whisper` is the lighter option). Without a transcript you can still cut silences (step 3 without `--words`) but can't caption.

Read the transcript text yourself. Fix obvious mis-hearings of names and product terms in `words.json` before captioning.

## 3. Decide the cuts

```bash
$MC cuts interview.mp4 --words words.json --out keep.json
```

This keeps everything except silences longer than 0.45 s (padded 120 ms so words aren't clipped) and filler words (`um, uh, erm, uhm, umm, hmm`). Tune it:

- Speaker breathes a lot / fast-paced edit: `--min-silence-ms 300 --pad-ms 80`.
- Calm, thoughtful pacing: `--min-silence-ms 700 --pad-ms 200`.
- Noisy room (silences not detected): raise `--noise -30` (dB).
- Extra fillers for this speaker: `--fillers um,uh,like,you know` (single words only).

To trim to the best part (a 60 s clip from a 20 min talk), read the transcript, pick the passage, and edit `keep.json` to only the ranges inside it (times are microseconds in the source file). Prefer starting on a strong sentence, not a greeting.

Tell the user the before/after length from the command's notes.

## 4. Build the sequence

```bash
$MC recut --asset interview --keep keep.json --track main
```

`apply_commands` with: `track/add` for `main` (video), the `recut` commands, then the overlay tracks you'll need, bottom-up: `scrim`, `graphics`, `captions` (all video tracks) and `music` (audio). The recut also writes `recut-map.json`, mapping source time to timeline time, for the captions.

## 5. Punch-ins

Every hard cut in the same shot is a visible jump. Alternate the framing: `clip/set-property` `{ "transform": { "scale": 1.15 } }` on every other segment (`seg-2`, `seg-4`, …). Check one punched frame with `preview_frame`: if the head is cut off at the top, set `y` to 0.52–0.55 on those segments (moves the picture down). Skip punch-ins on segments shorter than 1 s; they flicker.

## 6. Captions

```bash
$MC captions words.json --map recut-map.json --track captions --max-words 4 \
  --style '{"preset":"karaoke","fontFamily":"Inter","fontWeight":800,"fontSizeFrac":0.055,"strokeColor":"#000000","strokeWidthFrac":0.12,"highlightColor":"#ffd400"}' --y 0.8
```

`--map` moves each word to its place in the recut and drops words that were cut. Style choices are in the `captions` skill. For 9:16, use `--max-words 3`, `fontSizeFrac 0.04` and `--y 0.7`.

Register the font first if you use one (see `reference/craft.md` → Type).

## 7. Lower third, music, end card

- Lower third from `reference/html-recipes.md` with the speaker's `name` and `role` in `params`, at 1–2 s, 5 s long, `mc animate --clip lt --in left --out fade --easing snappy`. Captions and lower third must not overlap: move the captions up (`y` 0.7) while the lower third is on, or put the lower third top-left (`y` 0.12).
- Music only if the user supplied a track: audio clip at volume 0.12–0.2 under speech, `fadeInUs` 1000000, `fadeOutUs` 2000000, trimmed to end with the video.
- End card (optional): a 3 s HTML scene after the last segment with name, handle or URL. Add a `crossDissolve` from the last segment only if that segment has headroom (it usually does when the cut ended before the file's end).

## 8. Review and export

Draft export + contact sheet (see `edit-video` → Review), then check especially:

- No word clipped at a cut (play the draft around 2–3 cuts if you can, or look for captions starting mid-word).
- Captions readable over every shot, inside safe zones, never covering the face or the lower third.
- Punch-ins don't crop the head.
- First 2 seconds start on speech, not on silence or "so, um".

Export `quality: "high"`. Report the final length and what was cut ("12:40 → 9:55, 214 pauses and 61 fillers removed").
