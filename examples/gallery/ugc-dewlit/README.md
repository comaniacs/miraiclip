# DEWLIT Cloud Milk Serum: UGC ad (everything but the human)

A 30-second vertical UGC-style ad for an **invented** skincare product, DEWLIT Cloud Milk Serum. Everything except the human presenter is built and rendered:
- the brand and packaging
- three product inserts (a label-turn close-up, a macro of the milky texture, the bottle on the vanity)
- karaoke captions and emphasis captions, synced to the script
- the end card with its disclosure
- the background music and product sounds

The presenter is **six clearly marked placeholder clips**. Each one states its framing, action and exact line.

The brand, presenter casting spec, script and shot list are in [PRODUCTION.md](./PRODUCTION.md). The subtitles are also in `captions.srt`.

## Add the presenter

1. **Film (or generate) the six shots** from the shot list, each exactly its slot length:
   - Shot 1: 0–4 s
   - Shot 2: 4–8 s
   - Shot 3: 8–15 s
   - Shot 4: 15–21 s
   - Shot 5: 21–26 s
   - Shot 6: 26–30 s

   Use 1080×1920 at 30 fps, with the presenter saying the scripted line.
2. **Replace the placeholders.** In `video.miraiclip.json`, swap the html clips `p1`…`p6` on the `presenter` track for video clips of the same start and duration: in the Miraiclip editor, or with `clip/add` (kind `video`) plus removing the placeholders. Everything on the `overlay` track stays as it is.
3. **Keep the voice.** Use the footage's own audio and mix the bed (`audio.mjs`) under it. It's already mixed low.
4. **Disclose an avatar.** If the presenter is an AI avatar, change the end card's small print to add "AI-generated presenter".

## Run

```sh
node build.mjs                         # → video.miraiclip.json (presenter + overlay tracks), overlay.html, captions.srt
node ../../../scripts/mc.mjs stills video.miraiclip.json --at 0.5,5.4,9.6,17,24,29 --sheet
node render.mjs                        # picture + bed + mux + validation (≈ 20 s)
```

## Validated output (`out/dewlit.mp4`, with placeholders)

These are measured by the app-film kit's `render.mjs`:
- 1080 × 1920, 30 fps, 900 frames, 30.000 s.
- AAC audio, 30.000 s, −16.6 LUFS, true peak −1.6 dBFS.
- No black frames.
- **Hard cuts only where planned:** 12 planned cuts (the shot changes and the insert in/out points). UGC cuts on purpose, so the validator is given the planned cuts and fails on any other.

## Honest status

- **There is no real human in this video yet.** The presenter clips are placeholders, and there's no voice: the captions show the scripted lines.
- **The product and brand are fictional.** No clinical, SPF, certification or ingredient-result claims are made.
- **The inserts are drawn, not filmed.** The bottle and the texture macro are HTML/CSS/SVG illustrations, styled to sit between real footage.
