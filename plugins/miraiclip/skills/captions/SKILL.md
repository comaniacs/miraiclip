---
name: captions
description: Add word-timed captions or subtitles to a video with the Miraiclip MCP server - karaoke, pop or word-by-word social styles, from a transcript, SRT/VTT or automatic speech-to-text - and export SRT/VTT. Use when the user asks for captions, subtitles or burned-in text that follows speech.
---

# Captions

Read the `edit-video` skill first. Captions are `caption` clips on a video track above everything else, one clip per short phrase, each word timed.

```bash
MC="node ${CLAUDE_PLUGIN_ROOT}/scripts/mc.mjs"
```

## 1. Get word timings

| The user has… | Do |
| --- | --- |
| Word-level JSON (Whisper, `{ words: [{ text, start, end }] }`) | Use it directly |
| `.srt` / `.vtt` | Use it directly. Words are spread evenly inside each cue, which is fine for `highlight`, less precise for `karaoke` |
| Nothing | `$MC transcribe video.mp4 --out words.json` (see the `talking-head` skill for engines and installing) |

Read the transcript and correct names, brands and numbers before building captions. Spoken numbers ("twenty twenty-six") can stay as spoken or be rewritten as digits; keep the word count the same per phrase if you edit text, so timings still line up.

If the video on the timeline doesn't start at the source's 0 (it was trimmed or placed later), shift with `--offset-us <clip.startUs - clip.trimStartUs>`. If it was recut into segments with `mc recut`, pass `--map recut-map.json` instead.

## 2. Pick a style

| Look | `--style` JSON | Use for |
| --- | --- | --- |
| Social karaoke (default) | `{"preset":"karaoke","fontWeight":800,"fontSizeFrac":0.055,"strokeColor":"#000000","strokeWidthFrac":0.12,"highlightColor":"#ffd400"}` | Reels, Shorts, TikTok, podcasts |
| Pop, one word big | `{"preset":"pop","display":"word","fontWeight":900,"fontSizeFrac":0.075,"textTransform":"uppercase","strokeColor":"#000000","strokeWidthFrac":0.14,"highlightColor":"#ffffff"}` with `--max-words 1` | Fast hype edits, hooks |
| Boxed highlight | `{"preset":"highlight","fontWeight":700,"fontSizeFrac":0.05,"color":"#ffffff","highlightColor":"#0a0d18","activeBackgroundColor":"#ffd400"}` | Clean brand look, light footage |
| Subtitle bar | `{"preset":"plain","fontWeight":600,"fontSizeFrac":0.042,"backgroundColor":"#000000b3"}` with `--max-words 8` | Interviews, documentaries, accessibility |
| Reveal | `{"preset":"reveal","fontWeight":800,"fontSizeFrac":0.055,"shadowColor":"#000000","shadowBlurFrac":0.3,"shadowOffsetFrac":0}` | Storytelling, quotes |

Add `"fontFamily":"<family>"` with a registered font asset (Inter if no brand font; see `reference/craft.md` → Type). Use the brand's accent as `highlightColor` when it has enough contrast on footage.

Words per clip (`--max-words`): 3–4 for 9:16 social, 4–6 for 16:9 social, 6–8 for subtitles. Position (`--y`): 0.78–0.82 on 16:9, 0.68–0.72 on 9:16 (above the platform UI).

## 3. Build and apply

```bash
$MC captions words.json --track captions --max-words 4 --y 0.8 --style '<json>' > captions.json
```

`track/add` `{ "id": "captions", "kind": "video" }` as the top track (if it isn't there yet), then `apply_commands` with the generated `commands` and `label: "captions"`. A long video can produce hundreds of clips: send them in batches of ~150 commands.

## 4. Check

`preview_frame` at three moments: a short phrase, the longest phrase, and the busiest or brightest shot. Check:

- Longest phrase fits on at most 2 lines and inside the safe zone. If not, lower `--max-words` or `fontSizeFrac` and rebuild (`undo` the caption batch first).
- Legible over the brightest footage (raise `strokeWidthFrac`, or switch to a boxed style).
- Doesn't cover faces or on-screen text. Move with `clip/set-property` `transform.y` on the affected clips only.

To restyle every caption at once, send `clip/set-property` `{ clipId, style: {…} }` for each caption clip id in one batch (style merges).

## 5. Sidecar files

If the user also wants subtitle files (for a YouTube upload, say), write them from the caption clips in the project:

```bash
$MC subtitles --format srt --out video.srt     # or --format vtt / txt (plain transcript)
```

If it isn't clear, ask whether they want burned-in captions, a sidecar file, or both. Platforms that accept SRT let viewers turn captions off.
