# @miraiclip/brand

A brand kit is one JSON object: colours, fonts, logo, caption style, intro and outro. `applyBrand` turns it into ordinary commands for any project.

```ts
import { applyCommands } from "@miraiclip/core";
import { applyBrand, parseBrandKit } from "@miraiclip/brand";

const kit = parseBrandKit({
  name: "Zest",
  tagline: "Ship faster",
  url: "zest.dev",
  colors: { primary: "#7c3aed", accent: "#facc15", background: "#111111" },
  fonts: { heading: { family: "Sora", src: "fonts/Sora.woff2", weightRange: [100, 800] } },
  logo: { src: "logo.png", width: 400, height: 200, corner: "bottom-right" },
  intro: {},
  outro: {},
});
applyCommands(project, applyBrand(project.getState().doc, kit).commands); // one undo step
```

- **Fonts** load as font assets and replace the family on text, captions and html blocks.
- **Colours** go to html block colour fields by role (background, text, accent, primary) and to caption highlights.
- **Intro and outro** are registry blocks filled with your name, tagline, URL and colours; the content moves to make room.
- **Logo** becomes a corner watermark between the intro and the outro.
- Applying a kit twice doesn't stack intros or logos, and every part can be switched off.

Docs: https://docs.miraiclip.com/
