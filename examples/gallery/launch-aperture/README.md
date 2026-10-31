# Aperture: a Miraiclip launch film

A 30-second, 1920×1080 launch film for Miraiclip built around **real product screenshots**. It looks like an editorial poster: paper, ink and electric yellow, with Geist type. It runs problem → solution → proof. The Miraiclip hexagon is the device: an aperture that opens on the product, wipes between scenes, and closes into the logo.

| Time | Scene | On screen |
|---|---|---|
| 0.0–3.0 | Hook | "Your · users · want to · edit · video." One word per beat, full frame, hard cuts through yellow, ink and paper |
| 3.0–7.2 | Aperture | A hexagon opens on the real editor (zoomed on the preview), widens to a card: "Give them a **real editor.**" |
| 7.2–13.2 | Themes | "One engine. Every look." The five real editor themes in a 3D carousel, each on a hexagon wipe of its own colour |
| 13.2–19.2 | Tour | "You bring the UI. We bring the rest." A camera over the editor screenshot; chips for preview, timeline, AI assistant, and MP4/WebM export |
| 19.2–24.6 | Proof | "Live on day one." Three miraiclip.com sections (79 effects, Cut for every format, Twelve things…) in browser windows, each pushing the last back |
| 24.6–30.0 | End | The homepage rises; the aperture closes into the mark; yellow floods out: **Miraiclip** · tagline · **miraiclip.com** · Open source · MIT. Held from 28.6 s |

Screenshots are in `shots/`, copied from `../funky-launch`: editor themes from react.miraiclip.com and sections of miraiclip.com. The editor frames show *Big Buck Bunny* (© Blender Foundation, CC BY 3.0), credited on screen while they appear. The fonts are Geist and Geist Mono (SIL OFL). The logo comes from `docs/public/images/logo.svg`.

## Run

```sh
node build.mjs && node ../../../scripts/mc.mjs check video.miraiclip.json
node ../../../scripts/mc.mjs stills video.miraiclip.json --at 0.1,3.3,5.5,10,13.8,15.3,20.2,26.1,29 --sheet
node render.mjs            # high quality, about 29 s on 4 workers → out/aperture.mp4
```

Screenshots and fonts are inlined as data: URIs (a 2.4 MB template). The film sets each `<img>` src only while it is on screen, so each frame's snapshot carries only the pictures it shows.

`mc check` reports bare-boundary and carry-score warnings. Those checks are written for one-take films; this film is edited on purpose. `render.mjs` declares every planned cut (the hook words, the aperture, the hexagon wipes, the lockup), and the validator fails on any other cut.

## Validated output

`out/aperture.mp4`: 1920×1080, 30 fps, 900 frames, 30.0 s. AAC audio, true peak below 0 dBFS. Hard cuts only where planned. No black frames.
