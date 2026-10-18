---
name: launch-video
description: Make a product launch, feature announcement, promo or explainer video from a brief, a script, screenshots, a website or a changelog, using Miraiclip HTML motion graphics through the MCP server. Use when the user wants a polished motion-graphics video and has no footage, or only screenshots and a logo.
---

# Launch video (motion graphics)

A sequence of designed scenes: kinetic type, product shots, proof points and a call to action. It needs no camera footage. Read the `edit-video` skill first, especially `reference/craft.md` and `reference/html-recipes.md`. This skill is how to put them together.

## 1. Gather the material

Ask for or collect (one short question if the request is thin):

- **What's launching** and the one sentence a viewer should remember.
- **Proof**: 2–4 facts, numbers, features or quotes. They must come from the user, their site, docs or changelog. Never invent stats or testimonials.
- **Visuals**: screenshots, logo (SVG or PNG), brand colours and font. If the user gives a URL and you can browse it, take your copy and facts from it, and ask them for screenshots (or capture them if you have a browser tool).
- **Shape and length**: default 1920×1080, 20–40 s. 1080×1920 for social.
- **Music**: a file in the folder, or none. Don't make the video wait on music; it can be added at the end.

## 2. Write the script before any HTML

Write a scene list and show it to the user if they're around (it's cheap to change now, expensive later):

```
Scene  Len   On screen                                  Motion
1      3.2s  Eyebrow "ACME" + "Ship video in minutes"   words rise, line 2 reveals
2      3.6s  "Every edit is a command" + code card      card fades, lines stagger
3      3.4s  3 stat cards: 79 effects / 125 min / 60fps counters
4      3.6s  Screenshot in browser frame + caption      frame rises, slow scroll
5      3.4s  End card: logo, tagline, URL pill          pop, fade, pulse ×3
```

Rules: hook in scene 1 (what it is, not a logo sting); one idea per scene; ≤ 7 words of headline per scene; 2.5–4 s per scene; end card ≥ 2.5 s. Total = sum of scene lengths.

## 3. Design system (once)

Decide and keep for every scene:

- Palette as CSS variables in the base kit (`--bg`, `--ink`, `--muted`, `--a1`, `--a2`, `--card`, `--line`). Take them from the brand; otherwise use the kit's defaults.
- Font asset: the brand font, or Inter (see `reference/craft.md` → Type).
- Layout grid for 16:9: content from x = 160 px to 1760 px. Headlines top-left at ~y 150–360 or centred for single statements. Same positions for the same roles in every scene.

## 4. Build

Tracks, bottom-up: `bg` (video), `scene` (video), optional `overlay` (video), `music` (audio).

1. **Background**: one static full-frame HTML clip for the whole length (recipe: Background), then `mc animate --clip bg --loop kenburns` and `effect/add` `{ "clipId": "bg", "kind": "grain", "effectId": "grain", "params": { "intensity": 0.12 } }`.
2. **Scenes**: one **animated** full-frame HTML clip per scene on `scene`, back to back (`startUs` of each = previous start + duration), ids `s1`, `s2`, …. Each template = base kit `<style>` + the scene's own CSS + markup from the recipes. Every element enters with `--d` staggers in reading order. Scenes have transparent backgrounds so the shared background shows through.
3. **Transitions**: `crossDissolve` 500 ms between every pair of scenes (`s1→s2`, …). HTML clips have unlimited headroom, so these always fit.
4. **Screenshots**: register as image assets and place them inside scenes with `src="asset:<id>"` (recipe: Screenshot in a browser frame), so they move with the scene's CSS.
5. **Music**: if supplied, an audio clip from 0 to the end, volume 0.8, `fadeInUs` 500000, `fadeOutUs` 2000000. Then adjust scene lengths so scene starts land on strong beats if the user gave a BPM (beat = 60 / BPM s).

Send everything for steps 1–3 as one `apply_commands` batch labelled `launch video`, then the animate output as a second batch.

Writing big templates as JSON strings is error-prone. Write each scene's HTML into `scenes/s1.html` etc. first, then build the command batch with a short Node script that reads them (`JSON.stringify` does the escaping), print it, and pass it to `apply_commands`. Keep the scene files: the user can edit them later.

## 5. Review

1. `preview_frame` each scene at its **settled** moment (≈ 0.75 × its length), full width 960 px. Look for overflow, collisions, text off its card, wrong font, low contrast.
2. Draft export at 640×360, 10 fps, then `mc sheet draft.webm --every 0.5 --cols 8`. Look at entrances (do things arrive in order?), dead time, and the transitions.
3. Fix with `clip/set-property` `{ clipId, template }` (a new template keeps the clip's timing and transitions), then check that scene again.

## 6. Deliver

Final export at `quality: "high"` (and `mp4` if Chrome is installed, else `webm` + ffmpeg conversion). Tell the user the length, the scene list in one line, and anything to check: claims on screen, the music licence, screenshot freshness. Offer the 9:16 version (the `reformat` skill).

## Energetic / funky variant

When the brief says funky, playful, hype or "like a launch trailer":

- **Music first.** Get the track and its BPM before anything else (ask; if the user has none, the Miraiclip React template ships CC0 music and sound effects in `public/media/audio`). Lay the scene grid in bars: 1–2 bars per scene, the drop on a scene start.
- **Story beats** that work (from real launch trailers): a late-night problem (notifications) → the prompt being typed → the drop (mascot or logo slam on colour flashes) → the product doing the work (timeline building, tool-call chips) → "Introducing" + the real product → a montage of real screens, one per beat → "ask for anything" prompt montage → proof → export → end card.
- Use the beat-synced patterns in `reference/html-recipes.md`: colour flashes, sticker cards, boing/slam entrances, typewriter, sequential prompts, screenshot montage.
- Hard cuts on bar lines. Sound effects on the big moments only (notification pops, the Enter key, the drop, the export click, the final success), at volume 0.4–0.5.
- Credit third-party media that requires it (e.g. CC BY footage visible in screenshots) in small text on those scenes.

## Scene ideas

| Scene type | Recipe(s) |
| --- | --- |
| Hook / title | Kinetic headline, eyebrow |
| Feature with UI | Screenshot in a browser frame + one-line caption |
| How it works | Code card, or a 3-step checklist |
| Proof | Stat counters, bar chart, a quote card (big quote mark, quote in 56 px, name in muted 30 px) |
| Before / after | Two cards side by side, the second enters 0.6 s later with an accent border |
| Call to action | End card with URL pill |
