# One day: a HighLevel AI Employee launch film

A 60-second, 1920×1080 launch film for HighLevel's **AI Employee**. The angle is narrative: *one day in the life of your AI Employee*. A 24-hour sky time-lapse runs behind the whole film: stars and a lit skyline at night, dawn, a sun crossing the day, dusk, and the moon at midnight. Between scenes a giant clock races to the next moment, and each of the six modules handles that moment in recreated product UI.

| Time | Clock | Scene |
|---|---|---|
| 0–5 | 2:14 AM | **Hook.** A phone rings: "A new lead calls at 2:14 AM. **Who picks up?**" The call is answered by the AI Employee |
| 5–8.75 | 2:15 AM | The phone flies into an AI orb; six module chips burst out: "Meet your **AI Employee.**" |
| 8.75 | 2:15 AM | **Voice AI** · a live call with a waveform and transcript; "Appointment booked" |
| 15.6 | 7:42 AM | **Conversation AI** · one inbox, Instagram/SMS/Facebook/chat; it replies, and every thread gets "AI replied" |
| 22.5 | 9:15 AM | **Reviews AI** · a five-star Google review; a drafted reply; "Posted" |
| 29.4 | 11:30 AM | **Content AI** · a prompt; an Instagram post with its image, a blog draft |
| 36.25 | 2:05 PM | **Funnel AI** · a prompt; landing → booking → thank-you pages assemble and connect |
| 43.1 | 4:40 PM | **Workflow AI Assistant** · "Follow up with new leads until they book"; suggested steps applied as a workflow |
| 50 | 11:59 PM | Recap: "One day. Six AI teammates." with the day's six results |
| 55–60 | | HighLevel logo · **AI Employee** · "Your best hire never clocks out." · **app.gohighlevel.com**. Held from 58.4 s |

## Sources and honesty

- **Module names** come from HighLevel's AI Employee launch (November 2024): Voice AI, Conversation AI, Reviews AI, Content AI, Funnel AI and Workflow AI Assistant. Their one-line descriptions are paraphrased from public write-ups of that launch. **No prices, statistics or performance numbers are shown**; public sources disagree on pricing.
- **The UI is recreated in HTML** in HighLevel's brand colours (#188BF6, #37CA37, #FFBC00, from the logo SVG). It is not screenshots, and the film says so on screen ("UI recreated for illustration · sample data").
- **All data is sample data.** "Bright Smile Dental", the people and the 555 phone number are fictional.
- **Logo:** `assets/HighLevel-logo-white.png`, from the `affiliate-signup-page` repo. **Fonts:** Geist and Geist Mono (SIL OFL).

## Run

```sh
node build.mjs && node ../../../scripts/mc.mjs check video.miraiclip.json
node ../../../scripts/mc.mjs stills video.miraiclip.json --at 0.2,3.4,7.2,14.4,20.5,27.6,34.5,41.3,48.3,53.5,58.8 --sheet
node render.mjs            # high quality, about 41 s on 4 workers → out/oneday.mp4
```

| File | What it is |
|---|---|
| `timeline.mjs` | `T` and `SCENES`: every module's start, clock hour and copy (96 BPM, a scene every 11 beats) |
| `film/10-sky.js` | The day: sky colours by hour, sun, moon, stars, skyline windows, the rolling clock |
| `film/20-hook.js` | The ringing phone and the reveal |
| `film/30-modules.js` | The six module scenes |
| `film/40-end.js` | The recap and the lockup |
| `audio.mjs` | The score: ring tones, a 96 BPM groove, clock-tick time-lapses, UI sounds |

## Validated output

`out/oneday.mp4`: 1920×1080, 30 fps, 1,800 frames, 60.0 s. AAC audio, true peak below 0 dBFS. **No hard cuts anywhere** (one continuous take). No black frames. `mc check` is clean.
