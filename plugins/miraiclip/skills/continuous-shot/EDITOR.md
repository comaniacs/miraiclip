---
name: continuous-shot
description: Make a continuous shot: one unbroken camera move where every beat grows out of the last, with no cuts and nothing that feels like slides. Use when the user asks for a continuous shot, one take, no cuts, a single camera move, or says a film should not feel like a slideshow. Offers three concepts, writes a beat sheet, builds with the version-2 stage kit, runs check_sequence until no boundary is bare, and reviews on a contact sheet.
---

# Continuous shot

One take: a subject, a camera, and beats that each grow out of the one before. The shot is checked by measurement, not by feel: `check_sequence` says which beats start from nothing.

Load `sequence-core` (the stage kit API, including the version-2 verbs) and `motion` before building, and `look` for the palette and type. Load `direction` if the brief is thin. Never export; the user does that.

## 1. Three concepts

Before any plan, offer **three concepts** that differ in their central picture, not in wording. Each is one sentence naming the subject and the world it travels through, e.g. "a single dot that becomes the product", "a cursor that opens each screen", "a camera that falls into each detail". Present them as choices the user can click (in the studio, as options) and wait for the pick. If the user is not there, pick the one that best matches the brief, say which, and continue.

## 2. Beat sheet

Write the beat sheet (`reference/beat-sheet.md`) and show it: time · beat · what moves · what is still · what carries into the next beat. Choose a carry type for every boundary from `reference/carry-types.md`. Include the hook, one declared rest and the lockup. Ask for changes once; don't build until it is agreed, unless the user is away.

## 3. Build

Compose one sequence per act with `data-stage-version="2"` on the stage root. Mark every beat with `tl.label(name, time)` (labels are what the check looks at). Use the carry verbs from the sheet, the operated camera (`tl.camera`, `tl.follow`, `tl.whip`, `tl.handheld`) and declared rests (`tl.rest`). Put `data-keep-in-frame="t0,t1"` on the subject. Use `S.*` units, never pixels.

## 4. Check until clean

Run `check_sequence`. Fix every warning:

- **bare boundary**: carry something across it with the verb its hint suggests, or redesign the beat;
- **framing**: keep the subject in frame, or follow it with the camera;
- **cadence**: vary the beat lengths;
- **hard cut**: hide it in a move or remove it.

Repeat until no boundary is bare and every subject stays in frame. A carry score under 0.5 is never acceptable. A deliberate `tl.cut` is allowed only if the sheet says why.

## 5. Contact sheet and review

Show the boundary frames (the filmstrip `compose_sequence` returns, and the frames around every label) and grade the draft against `reference/scorecard.md`. Fix any fail, then tell the user which concept was built, the beat sheet in one line, and what to look at. Warnings never block an export, but don't hand over a draft with a bare boundary. When the user is ready to export the final, suggest motion blur (`motionBlur: {}` on the export): a continuous shot moves a lot, and the shutter smear is what keeps fast moves from strobing. It is slower to render, so it is for the final, not for drafts or previews.

## More than one act

If the film needs more than one act, use the existing hand-off between acts: the next act starts from the element and camera state the last one ended on (see `sequence-core`, "Hand-off between acts"). Run `check_sequence` across the join; it reports a hard join between clips as `act-join`.

## Sound and music

Sound moments are `tl.hit` events; carry landings, presses, impacts and shakes add their own. After the check is clean:

1. Pick one material for the film's sounds (all wood, all glass, all soft synth) and add one CC0 sound per hit kind as audio assets.
2. `place_sfx_from_events` puts one sound at every hit and ducks the music under them. It reports where on screen each hit happened; audio clips have no pan yet, so that is not applied.
3. To land carries on the music: Get the beat grid of the music (the host analyses it) and write it with `set_beat_grid`, then build carries on `S.beat(n)` and `S.downbeat(n)`.

Sound effects on the big moments only; a hit on every beat is noise.
