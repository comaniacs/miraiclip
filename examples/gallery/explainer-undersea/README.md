# The cloud is underwater

A 30-second, 1920×1080 playful explainer about where "the cloud" really lives. It stars **Nimbus**, a little cloud with a snorkel, and is drawn as flat cartoon motion graphics in HTML, CSS and SVG, with an original bouncy score. The whole film is one continuous take, with no cuts.

| Time | Beat | On screen |
|---|---|---|
| 0–3.2 | Hook | "Quick question… Where **IS** the cloud?" Nimbus looks around and sweats |
| 3.2–6.3 | Wrong guess | "Up in the sky?" A satellite whizzes past and gets a **NOPE!** stamp. "Satellites? They carry only a tiny slice." |
| 6.3–10.8 | The dive | Snorkel mask on, a jump, a splash, down past the fish: "It's down here! ↓" |
| 10.8–16.2 | The insight | On the seabed a cable glows with light: "~99% of data between continents travels through cables on the sea floor." A cross-section and a garden hose: "≈ garden-hose thick!" |
| 16.4–21.4 | Scale | A bubble opens on the Earth: "1.4 million+ km of these cables", wrapped around the globe one loop at a time: "Enough to wrap Earth 35 times" |
| 21.4–26 | Twist | "They break 150–200 times a year!" A shark swims in… "Sharks? Rarely." (it gets a halo). An anchor clangs onto the cable: "Usually: ship anchors & fishing gear." |
| 26–30 | Payoff | "So the cloud… …is mostly **underwater.**" Nimbus waves: "Say hi to the fish!" Held from 28.6 s |

## Facts and sources

- **~99% of intercontinental data** goes by submarine cable rather than satellite (TeleGeography; widely cited).
- **1.4 million+ km** of cable in service. Published figures range from about 1.4 to 1.7 million km, and the film uses the conservative floor. Earth's circumference is ~40,075 km, so 1.4M km ≈ 35 wraps.
- **150–200 faults a year**, mostly from fishing activity and ship anchors (International Cable Protection Committee, ICPC). Shark bites are rare.
- **Garden-hose thick** describes deep-sea cable, which is commonly compared to a garden hose; cable near shore is armoured and thicker.

## Run

```sh
node build.mjs && node ../../../scripts/mc.mjs check video.miraiclip.json
node ../../../scripts/mc.mjs stills video.miraiclip.json --at 0,2,4.9,7.6,12.5,14.6,19.8,23.6,25.2,28 --sheet
node render.mjs            # about 21 s on 4 workers → out/undersea.mp4
```

## Validated output

`out/undersea.mp4`: 1920×1080, 30 fps, 900 frames, 30.0 s. AAC audio, true peak below 0 dBFS. No hard cuts. No black frames. `mc check` is clean.
