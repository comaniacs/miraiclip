# Example 6 · AI agent demo

A 21.4 s demo of an AI assistant inside a product, in 16:9 and 9:16: hook → the question is typed and sent → the agent runs four steps (spinner → check, progress bar) → the answer streams in with a growing chart and a delta badge → ⌘K sends the result on, with a confirmation toast → end card. Every word, both brand colours and the **theme** are fields (38). The default brand is the fictional Northwind AI, like the studio's built-ins; the default theme is **paper**.

Scenes adapted from the studio's built-in *AI assistant demo* and *Command palette*, rebuilt on the shared kit with example 1's motion.

| Where | File | What it is |
| --- | --- | --- |
| here | `build.mjs` | Fields and scenes; uses `../_kit.mjs` |
| here | `ai-agent-demo.miraiclip.json`, `ai-agent-demo-vertical.miraiclip.json` | Plain projects with the default copy (MCP server, server export) |
| here | `template.json`, `notes.md`, `contact-sheet*.png` | Metadata, verification notes, frames from the studio (`contact-sheet-themes.png`: one frame per scene in each theme) |
| `miraiclip-react-template/public/templates/` | `ai-agent-demo.miraiclip-template.json`, `ai-agent-demo-vertical.miraiclip-template.json` | The templates. Studio: **Template → My templates → Import .json**, or **Project → Open project…** |

```bash
node examples/templates/ai-agent-demo/build.mjs
```

No assets of its own: the theme fonts live in `../_shared/assets/` (uploaded to R2 under `templates/_shared/`).

## Themes

Pick one in the form's **Theme** field; everything else stays editable:

| Theme | Palette and texture | Type | Shapes | Motion |
| --- | --- | --- | --- | --- |
| midnight | Dark navy, soft brand glows, film grain | Inter | Soft 24 px corners, deep shadows | Springs up from below, blur clears, slow push-in, scenes lift away |
| paper (default) | Warm paper, ink, ruled lines, a brand-colour margin rule | Instrument Serif display, italic accent line | Square corners, 2 px ink borders, hard ink shadows | Slides in from the left, the camera pans sideways, scenes slide off left |
| terminal | Black CRT, scanlines, faint grid, glowing accent | JetBrains Mono, "> " on the accent line | 2 px corners, thin green rules | Stepped, flickering entrances, no camera move, hard cuts out |
| pop | Pastel brand ground, halftone dots, two big outlined circles | Bricolage Grotesque, highlighter accent line | 28 px corners, 4 px black outlines, offset shadows | Bounces up from below, scenes drop away |

## The shared kit (`../_kit.mjs`)

Every example from here on builds on it: the four themes (CSS variables, background, fonts, motion direction), the motion system (spring/expo easing, `.x` scene exits, `.cam` push-in, entrances `.r .f .p .ty .tx .r3 .w`, typing with `.typed` + `.caret`), the 16:9 + 9:16 formats with per-scene `vertical` overrides, and `buildTemplates()`, which checks every placeholder is bound and every field used, then writes the template per format to the studio and the project per format next to the source.

New in this example: **typing that works with editable text** (`.typed` animates `max-width` in `steps()`, so any length of text types out), **streamed lines** (`reveal` in `steps()` per line), and **spinner → check** built from two elements with their own start times.

## Theme variants

One file per theme and format goes to the studio: `ai-agent-demo` (paper, this demo's own look), `-midnight`, `-terminal`, `-pop`, each with `-vertical`. Each starts on its theme with that theme's brand colours (kit `THEME_PALETTES`); the Theme field still switches freely. One frame per scene in every theme: `contact-sheet-themes.png`.
