# Example 1 · Launch film

A 24.4 s product launch in two formats, 16:9 (1920×1080) and 9:16 (1080×1920): hook → 3D product-screenshot reveal → feature with a code card → three counting stats → product pillar (timeline mock) → AI steps → end card. Every visible word, both brand colours and the screenshot are fields (44 in all).

| Where | File | What it is |
| --- | --- | --- |
| here | `build.mjs` | The source: fields, scenes, motion. Writes the files below |
| here | `miraiclip-launch.miraiclip.json`, `miraiclip-launch-vertical.miraiclip.json` | Plain projects with the default copy, for the MCP server and server export |
| here | `assets/` | Files the video loads by URL: Inter (SIL OFL) and the sample product screenshot. Uploaded to R2 with `../upload-assets.mjs` |
| here | `template.json`, `notes.md`, `contact-sheet*.png` | Catalog metadata; verification, scores and findings; frames from the studio |
| `miraiclip-react-template/public/templates/` | `miraiclip-launch.miraiclip-template.json`, `miraiclip-launch-vertical.miraiclip-template.json` | The templates (16:9 and 9:16). Studio: **Template → My templates → Import .json** gives the form; **Project → Open project…** opens it with the default copy |

## Build and publish

```bash
node examples/templates/miraiclip-launch/build.mjs        # templates → studio public/templates, projects → here
node examples/templates/upload-assets.mjs miraiclip-launch # puts assets/ in R2 at templates/miraiclip-launch/
```

`build.mjs` assumes `miraiclip-react-template` sits next to `miraiclip` (as on `D:\`); set `OUT_DIR` otherwise. Asset URLs default to `https://assets.miraiclip.com/templates/miraiclip-launch/…`; set `ASSET_BASE` to test against another host.

## How the fields work

Each scene's HTML uses `{{param}}` placeholders, and each clip param holds the template placeholder of the field with the same name. One form value therefore reaches every scene that uses it (product name, both colours). The colour params are named `primary` and `secondary`, so **Project → Brand kit** recolours the video too.

## Formats

One set of scenes builds both formats. Each scene's CSS is written for 16:9, and a `vertical` block of overrides (the `V` object in `build.mjs`) re-lays it out for 9:16: same markup, same fields, same timing.

## How the motion works

The rasterizer seeks every CSS animation through `animation-delay: var(--d)`, so `--d` is an element's start time in its scene. All of an element's animations share it, and children inherit it unless they set their own.

- **Every scene** sits in two wrappers: `.cam` pushes in 4 % over the scene, so nothing is ever fully still, and `.x` lifts, blurs and fades the whole scene out in the last 0.5 s. The dissolves between scenes are 0.3 s.
- **Easing:** movement uses a spring (`linear()` with about 5 % overshoot) and opacity/blur use expo-out, so things land with weight. The end-card dot uses a bouncier curve.
- **Product reveal:** the screenshot (`<img src="asset:shot">`, swapped by the *Product screenshot* field) rises out of the floor in 3D and settles while the camera dollies across it. The headline lands while it is still moving, and two callouts pop out and float.
- **Per scene:** the eyebrow tracks in, the gradient line wipes on and keeps shimmering, and an accent bar snaps out. The code card swings in on Y, lines type with `steps()`, and the key chip pops then gets pressed. Stat cards spring up, numbers count and come into focus, meters fill and a light sweeps once. The timeline panel tips up from flat, clips snap on, the playhead eases across and the music waveform breathes. Tool rows slide in with a spinner that resolves into a check. On the end card a glow blooms, the wordmark comes into focus, the dot drops with a bounce and the button pings three times.

## Themes

Built on the shared kit (`../_kit.mjs`) since 23 Oct, so it has the four themes and a **Theme** field. One file per theme and format goes to the studio: `miraiclip-launch` (midnight, this film's own look), `-paper`, `-terminal`, `-pop`, each with `-vertical`. Each variant starts on that theme and its own brand colours. One frame per scene in every theme: `contact-sheet-themes.png`. Fonts now come from `templates/_shared/` in R2; the screenshot stays in `templates/miraiclip-launch/`.
