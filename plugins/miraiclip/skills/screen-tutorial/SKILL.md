---
name: screen-tutorial
description: Turn a screen recording into a polished tutorial or product walkthrough with the Miraiclip MCP server - zoom in on the action, speed up waiting, hold key frames, blur private data, add step callouts and chapters. Use when the user hands over a screen recording (with or without narration) and wants a how-to, demo or walkthrough video.
---

# Screen tutorial

Read the `edit-video` skill first: its loop, rules and review apply here. A screen tutorial is footage where the whole frame matters, so the craft is in **guiding the eye**: zoom to where the action is, cut or speed up the dead time, hold the frame when something needs reading, and hide anything private.

## 1. Understand the recording

1. Probe and register the recording (and narration or music if separate) with `mc probe`.
2. Make a contact sheet of the raw recording (`mc sheet recording.mp4 --every 2`) and read it: which app, which screens, where the cursor goes.
3. If there's narration, transcribe it (`mc transcribe`) and use the words to find the steps ("click Save", "now open Settings").
4. Write the step list before editing: for each step, its time range, what the viewer should look at (a rough box on screen), and a 2–5 word label. Show it to the user if the request was open.

If the user has a recorder's event log (a `*.session.json` from `@miraiclip/capture`), use it for the step times and boxes instead of guessing, and prefer the planners in section 8.

## 2. Structure

- One `marker/add` per step, with `durationUs` for the step's span and `data: { "kind": "step", "n": 1 }`. Markers become chapters in players and sections in written guides.
- Put the recording on track `screen` at `scale: 1`. Keep the project at the recording's shape (usually 16:9; set it with `project/set-settings` before adding clips).

## 3. Pace

- **Dead time** (loading spinners, typing long text, waiting): split around it and `clip/set-speed` the middle part to 2–4× (`ripple: true` so the rest follows). Over 4× looks broken; cut instead.
- **Hold a frame** when the viewer must read something (a result, a settings page): `clip/freeze` at that moment for 1–2 s.
- **Cut** mistakes and repeated attempts entirely (split, remove, close the gap).
- Aim for one step every 4–10 seconds of finished video.

## 4. Zoom to the action

Zoom with keyframes on the screen clip's `scale`, `x` and `y` (see `reference/motion.md`). For a zoom onto a box centred at `(cx, cy)` (fractions of the frame) at zoom `z`:

- `scale = z`, `x = 0.5 + (0.5 − cx) × z`, `y = 0.5 + (0.5 − cy) × z`
- clamp so the frame stays filled: `x` within `[1 − z/2, z/2]`, same for `y`

Rules: zoom in over 400–600 ms with `easeInOut`, stay while the step happens, zoom out before jumping to a distant part of the screen. Use `z` 1.5–2.5. Don't zoom for every click; zoom when the target is small.

## 5. Privacy and focus

- **Blur or pixelate private data** (emails, API keys, names, card numbers): `effect/add` `pixelate` (or `blur` 0.03) with `region: { x, y, width, height }` as fractions of the **clip's** frame. The region stays on the content through your zooms. If the field moves (scrolling), keyframe it with `effect/set-region-keyframe`. Check every frame it appears in on the contact sheet.
- **Spotlight** a control: `effect/add` `colorAdjust` `{ brightness: -0.45 }` with `region: { …, shape: "ellipse", feather: 0.5, invert: true }` for the step's duration (split the clip or use a short duplicate on a track above).

## 6. Callouts and titles

- Step labels: a small HTML lower-third or pill near (not over) the target, 2–5 words, from `reference/html-recipes.md`. One callout on screen at a time.
- An intro card (what you'll learn, ≤ 3 s) and an end card (the result or next step).
- Captions from the narration if there is any (`captions` skill), kept clear of the callouts.

## 7. Review and export

Draft export + contact sheet as in `edit-video`. Check specifically: nothing private visible on any frame; zooms never show past the edge of the recording; sped-up parts still readable; each step's label on screen while its action happens. Then the final export.

In the hand-off, list the steps (one line each) so the user can paste them into a help article.

## 8. With a capture log: use the planners

When the recording came with a `CaptureSession` (clicks, keys, scrolls and flagged private fields), don't place zooms, cursor, blurs or callouts by hand. Write a short Node script with the planners and apply their commands as one batch, then review as above:

1. `sessionCommands(session, { screenSrc })` (`@miraiclip/capture`): the starting project with a marker per step.
2. If there's speech: `planCleanup(doc, transcript, { linkedClipIds })` (`@miraiclip/transcript`) removes fillers, stutters and long pauses as one ripple cut. Cut first; the planners follow trims.
3. `planScreencast(doc, session, { clipId: "screen", callouts: true })` (`@miraiclip/screencast`): redactions of every flagged field, zooms on clicks and typing, a clean cursor, click ripples, step callouts.
4. Voiceover, if wanted: `scriptFromMarkers` → `rewriteScript` → `synthesizeNarration` → `alignNarration` (`@miraiclip/narration`). Read `placements`: every line says whether it needed a freeze or a speed change.
5. Captions with `captionCommands(doc, transcript, { trackId: "captions" })` after all cuts, so they match what's said.
6. A written guide from the same project: `buildGuide` → `addStills` → `toMarkdown` (`@miraiclip/guides`).

Planner output is ordinary commands: inspect it, change what looks wrong, and keep the contact-sheet review.

