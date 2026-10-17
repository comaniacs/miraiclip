---
name: edit-video
description: Make or edit a video with the Miraiclip MCP server (tools named get_state, apply_commands, preview_frame, export). Use for any video request in a Miraiclip project folder - cutting footage, adding titles, captions, music, motion graphics, reformatting or exporting - and to pick the right workflow skill.
---

# Edit video with Miraiclip

You edit a video by sending **commands** to the `miraiclip` MCP server. The server owns one project file (`video.miraiclip.json` in the current folder), saves after every successful edit, and can render any frame as an image you can look at. You work like an editor: plan, make the edit, **look at it**, fix it, export.

## Pick the workflow first

| The user wants… | Use |
| --- | --- |
| A recorded talk, interview, podcast or vlog cleaned up (pauses cut, punch-ins, captions, lower third) | `talking-head` skill |
| Captions or subtitles on an existing video | `captions` skill |
| A product launch, feature promo, explainer or announcement made from a brief, screenshots or a URL | `launch-video` skill |
| The same video in another shape (9:16 Reels/TikTok/Shorts, 1:1, 16:9) | `reformat` skill |
| Anything else (a single change, a title, music, a transition, an export) | This skill: follow the loop below |

Read the matching skill's SKILL.md before starting. Every workflow uses the loop and rules in this file.

## Before the first edit

1. Check that the `miraiclip` tools exist (`get_state`, `apply_commands`, `preview_frame`, `export`). If they don't, the plugin's MCP server isn't running: tell the user to run Claude Code from the folder that holds their media (one folder per video) and to check `/mcp`. Stop there.
2. Call `get_state`. An empty project is 1920×1080 at 30 fps. Change it with `project/set-settings` before adding clips if the target is another shape (see `reference/craft.md` → Formats).
3. List the media in the folder. Register it with the helper, which reads duration, size and fps for you:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/mc.mjs" probe clip1.mp4 music.mp3 logo.png
   ```
   Pass its `commands` to `apply_commands`. Video and audio assets **must** have `durationUs`, or trims and transitions can't be checked. If `ffprobe` is missing, say so and ask the user for durations or to install ffmpeg.
4. Settle the brief in one or two lines before building: platform and shape, length, tone, the one thing the viewer should remember. If the user gave no brief and the request is open, ask once (AskUserQuestion), then go.

## The loop

1. **Read**: `get_state`. Commands reference the ids it shows.
2. **Plan** the edit as a list of commands. Name ids yourself so later commands can refer to them (`title`, `cap-3`, `seg-2`), not random strings.
3. **Apply** the whole plan in one `apply_commands` call with a `label`. It is all-or-nothing and one undo step. If it fails, the error gives `failedIndex` and the reason: fix that command and resend the batch. Nothing was applied.
4. **Look**: `preview_frame` at the moments that matter. For motion and pacing, export a cheap draft and make a contact sheet (see Review below).
5. **Fix** with more commands, or `undo` the last batch.
6. **Export** when it's right (see Export).

Never claim an edit looks right without having looked at a frame of it.

## Rules that prevent most failures

- **All times are integer microseconds.** 1 s = `1000000`. 0.5 s = `500000`. Never send seconds or floats.
- **Tracks are layers.** `trackOrder[0]` is the bottom. Add tracks bottom-up: background → main footage → B-roll/overlays → titles → captions. Audio goes on `audio` tracks; a video clip plays its own sound.
- **Position with `transform`**: `x`, `y` are the clip's centre as fractions of the frame (0.5, 0.5 = centre). `scale: 1` fits the clip inside the frame. `transform` in `clip/set-property` merges, so `{ "scale": 1.15 }` changes only scale.
- **Keyframe times are relative to the clip's start.** Use `anchor: "end"` for exit animations so they follow trims.
- **Transitions** need two clips on the same track that touch exactly (`toClip.startUs == fromClip.startUs + fromClip.durationUs`), and enough source media past each cut (headroom). Text, image, caption and HTML clips have unlimited headroom. Video clips that play a whole file have none: trim them first.
- **Asset `src` paths** are relative to the project folder. HTML clips can't load URLs: images go in as `src="asset:<id>"`, fonts as a font asset whose `family` the CSS names.
- **Check the schema** with `get_command_schema` before using a command you haven't used in this session. `reference/commands.md` is the short version.

## Making it look good

This is what separates a usable edit from one people share. Read `reference/craft.md` before building anything with titles, graphics or captions. It has formats, safe zones, type sizes, pacing, motion timing, colour and audio levels.

- Titles and graphics: **HTML clips** (`kind: "html"`), built from the tested patterns in `reference/html-recipes.md`. They give you real CSS layout, web fonts, gradients, shadows and `@keyframes` animation, frame-exact in export.
- Moving existing clips (photos, footage, logos): **animation presets**, which produce the same keyframes as the Miraiclip editor's animation panel:
  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/scripts/mc.mjs" presets
  node "${CLAUDE_PLUGIN_ROOT}/scripts/mc.mjs" animate --clip logo --in pop --out fade --easing snappy
  node "${CLAUDE_PLUGIN_ROOT}/scripts/mc.mjs" animate --clip photo-1,photo-2 --loop kenburns
  ```
  It reads the saved project file, so apply the clip first, then animate. Details: `reference/motion.md`.
- Looks: effects via `effect/add` (79 kinds; list in `reference/commands.md`). Use at most one look per video and keep intensities low (0.1–0.4).

## Review

Do this before every final export, and whenever motion or timing matters:

```bash
# 1. a cheap draft (small and low fps renders fast)
#    export tool: { "out": "draft.webm", "format": "webm", "quality": "draft", "width": 640, "height": 360, "fps": 10 }
# 2. one image of the whole video, one frame per second
node "${CLAUDE_PLUGIN_ROOT}/scripts/mc.mjs" sheet draft.webm --every 1 --cols 6
```

For a 9:16 project use `"width": 360, "height": 640`. Read `sheet.png` and go through the checklist in `reference/craft.md` → Review checklist: legibility, safe zones, overflow, empty or black frames, pacing, consistency. Fix, then check again. Use `preview_frame` at full size for single moments (a title's settled frame, a caption over a busy shot).

## Export

- `export` with `format: "mp4"` needs Google Chrome installed on the machine. If it fails, export `webm` and, if the user needs MP4 and ffmpeg is present, convert: `ffmpeg -i out.webm -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart out.mp4`.
- Use `quality: "high"` for the final. Name the file after the project (`launch-16x9.mp4`), not `out.mp4`.
- Exports with many animated HTML clips render every frame in a browser and take a while. Tell the user roughly how long to expect and don't export the final more than once.

## Hand-off

When done, tell the user in two or three lines what the video is (length, shape, what's in it) and where the file is. Mention anything you assumed (music choice, a claim on screen, a font) that they should check. Don't list the commands you ran.

## References

- `reference/craft.md`: formats, safe zones, type, pacing, motion, colour, audio, review checklist
- `reference/html-recipes.md`: tested HTML/CSS patterns for titles, lower thirds, stats, lists, code cards, CTAs, end cards
- `reference/motion.md`: animation presets, keyframes and easing
- `reference/commands.md`: every command's payload, effect kinds, transition kinds, error codes
