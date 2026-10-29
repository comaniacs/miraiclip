# Kiteline: production script

A 30-second launch film for an invented SaaS product. The website in `app/` is real and works on its own. The film (`film/`) mounts that same app code inside a CSS-3D browser window and drives it with scripted clicks and typing. It is HTML, CSS and DOM only, with no three.js or WebGL, and mixes flat 2D views of the UI with 3D camera moves around it.

## A. Brand and concept

| | |
|---|---|
| **Name** | **Kiteline**: ideas are kites, and the product is the line that brings them in. |
| **What it does** | Plan, write and schedule social posts in one flow: calendar → AI prompt → draft → edit with live preview → schedule. |
| **Audience** | Small marketing teams and founders who run 2–4 channels without a social media manager. |
| **Value** | One calm place where a rough idea becomes a scheduled, on-brand post, without switching between a notes app, a chatbot and a scheduler. |
| **Personality** | Calm, crafted and quietly clever. Warm paper-white UI on a deep ink stage, with one coral accent. |
| **Palette** | Ink `#13121f` (stage), Paper `#fbfaf7` (app), Coral `#ff6a4d` (brand, the line), Lilac `#7c6cf2` (AI), Mint `#25a876` (scheduled), Amber `#d98a1c` (draft). Platform tints are our own, with no official logos. |
| **Type** | UI: system sans (SF Pro on macOS). Display: Avenir Next Demi Bold with tight tracking. |
| **Visual device** | **The kite line**: one coral line. It threads scattered ideas into the calendar, runs from Generate into the prompt, and ties the scheduled posts into a plan in the final 3D view. |
| **Demo honesty** | The app runs a local, deterministic demo generator, marked "Demo AI · runs in your browser". Scheduling changes the app's own state and never posts to a network. Platform previews are approximations labelled "Preview". |

**Sample customer.** The workspace belongs to *Fieldnote* (fictional), a meeting-notes app launching on Thursday 12 November 2026. The seed calendar tells that story: a sneak peek on Tuesday, "two days to go" on Wednesday, and an empty Thursday waiting for the launch post. The demo's "today" is fixed at Monday 9 November 2026, so the film is deterministic. The standalone site uses the real date.

## B. Production script (time-coded)

The camera is one CSS transform on the world: `{yaw, elev, dist, target, screen offset}`, keyed in `film/60-camera.js` with monotone cubics (C1-continuous, no overshoot). `dist = 1600` equals the perspective, which shows the app frontally at exactly 1:1 pixels. These are the "2D" moments, used for every interaction so text stays crisp. The "3D" moments orbit the window.

| Time | Scene | Real app state and action | Camera / 3D | Motion graphics and type | Sound |
|---|---|---|---|---|---|
| 0.0–4.2 | **1 · Hook** | The app is mounted (calendar, month view) but hidden. | Wide 3D (yaw 28°, dist 2300) through a field of 11 floating idea cards. Five of them are the real seed posts. Pushing in and squaring up. | 0.5 "Your ideas are everywhere." 2.0 "Give them a line." The coral line threads the five real ideas (0.8–2.4), then they fly to their exact calendar chips. Faint day tiles assemble on the real cell positions. The six loose ideas drift away. At 3.6–4.3 the real app fades in under the tiles. | Airy pad. A soft pluck as each idea is threaded. A low "align" swell as the tiles lock. |
| 4.2–9.0 | **2 · Calendar** | 4.9 click **Week** → week of 9–15 Nov. 5.9 click **Thu 12** → day panel "Nothing planned yet". 8.3 click **Create post for Thu, Nov 12** → Prompt studio with the date. | Frontal 1:1 for the clicks; 6.6–8.6 yaw −18° with the window to the right. | "Plan every channel in one calendar." (6.7–8.4) | A UI click per click. |
| 8.4–9.4 | **2→3 bridge** | Studio is open (real). | Back to frontal. | The Thursday column lifts out of the week (a copy of the real header with a coral outline), flies to the idea field and lands as the field gains focus. | Whoosh. |
| 9.0–14.0 | **3 · Prompt studio** | 9.3–10.6 type the idea "Introduce Fieldnote, our new meeting-notes app". 10.85 **LinkedIn**. 11.15 **Team leads**. 11.45 **Confident** (goal "Launch" is the default). 11.85 **Generate prompt** → a structured prompt from those inputs. | Frontal; 12.5–13.8 push into the prompt (×1.25). | The coral line runs from Generate to the prompt; sections reveal top to bottom (12.0–12.6). "A rough idea becomes a real brief." (12.7–13.8). | Soft typing; a lilac shimmer on Generate. |
| 13.9–14.4 | **3→4 bridge** | 13.9 click **Write post from prompt** → editor with an AI draft (real). | Frontal. | A copy of the prompt card slides into the caption field and dissolves into it. | Whoosh. |
| 14.0–20.0 | **4 · Edit and preview** | 15.0 click the caption. 15.2–16.7 retype line 1, "Meet Fieldnote, our new meeting-notes app." → "Your meetings deserve better notes. Meet Fieldnote.". The live preview and the count update each frame. 16.95 pick media **2**. 17.45 **Instagram** (preview changes layout, limit 2,200). 18.0 **LinkedIn**. 19.6 **Schedule** → status Scheduled on Thu 12 Nov 10:00, the calendar opens, toast. | Frontal; 17.2–18.4 push to the preview; 18.4–19.4 yaw −20°. | A coral underline pulses on the preview's first line as it changes. "Edit it. See it live." (18.4–19.4). | Typing; clicks; a two-note confirm on Schedule. |
| 19.6–20.6 | **4→5 bridge** | The calendar shows the new post (real). | Frontal. | A copy of the live preview card shrinks and flies to the Thursday 10:00 slot, where the real chip is revealed as it lands. | Whoosh into a "set" tick. |
| 20.6–26.0 | **5 · Schedule and organize** | The toast "Scheduled for Thu, Nov 12 at 10:00" (app state). 21.4 click **Month**: Nov 12 shows the launch post among the plan. | 22.0–25.5 the board tilts back (elev 34°) and orbits. | Every post chip lifts off its date as a 3D card with a shadow (copies of the real chips at their real positions). The coral line ties the scheduled ones in date order. "From idea to scheduled. In one flow." (22.6–25.4). | Rising pulse; a soft chord as the line completes. |
| 26.0–30.0 | **6 · Hero** | Unchanged. | Wide 3D, window right (yaw −24°); held from 28.8. | The cards settle home. Copies of the real prompt card and live preview float in front of the window. Lockup on the left: mark + "Kiteline" / "Plan, write and schedule social posts — with AI that stays out of your way." / "Start planning" pill. | Final accent; the music resolves and ends at 30.000 s. |

## C. Storyboard

Frames from the real render every half second: `stills/sheet-1.png`, `stills/sheet-2.png` (regenerate with the commands in the README).

## D. 3D, materials, lighting

CSS 3D has no lighting engine, so light is designed into the surfaces:

- The window is matte paper-white with a 1 px inner highlight and a soft long shadow on the stage.
- Idea cards and lifted chips are frosted paper (92 % white, a 1 px border, layered shadows). Their shadows fall on the dot-grid floor in its own 3D context, so they never sort over the UI.
- The stage is deep ink, with a large soft key glow top-left (coral-tinted) and a cool lilac rim glow bottom-right. These are static gradients, so exposure never flickers.

## E. Sound

`audio.mjs` synthesizes an original score at 104 BPM: a soft Rhodes-like chord pad, a pluck arpeggio from 4.2 s, a click on every scripted click, soft key ticks while typing, a shimmer on Generate, a confirm on Schedule, and a final chord at 26.4 s that fades to silence at exactly 30 s. Every UI sound is placed from the same action list that drives the app.
