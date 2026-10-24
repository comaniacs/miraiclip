# Notes · Example 6 · AI agent demo

Built and checked 23 Oct 2026 in the React studio (GitHub main `8e302b7`), headless Chromium, software WebGL. Export is yours.

## Definition of done

- [x] Opens with no console errors, both files and both import paths.
- [ ] Plays at speed 1.00 — needs the Windows PC.
- [x] Every visible word and both colours are fields (37). Exception: the blurred app layout behind the ⌘K palette is decoration.
- [x] One change updates every scene: product name appears in the hook, both chat windows; colours everywhere.
- [x] 16:9 and 9:16 both checked frame by frame; vertical text sized for phones (26–36 px body).
- [ ] Browser export matches preview — your export.
- [ ] Server export — not run.
- [x] No media besides Inter (OFL).

## Scores (1–5)

Reference: the reference site's AI Chat Input components (Agent Chat, Agent Run, Answer Stream, Prompt Send) — single shots of 3–6 s; it has no finished agent-demo film.

| Criterion | Reference | Ours | Note |
| --- | --- | --- | --- |
| Hook | 4 | 4 | |
| Motion | 5 | 4 | Typing, streaming, spinners, palette spring, toast. One step short of 5: no camera move through the UI (zoom into the answer, follow the cursor) |
| Typography and layout | 4 | 4 | |
| Detail | 4 | 4 | Thinking dots, progress bar, selection pulse, delta badge |
| Editability | 2 | 5 | 37-field form, brand kit |
| Formats | 1 | 2 | |

**Verdict: passes.** Next pass if wanted: a camera zoom from the window into the chart in scene 4 and a cursor that clicks Send.

## Themes pass (23 Oct)

Feedback: example 1 and 6 looked the same (dark navy, purple/cyan, rise-up motion). Added four themes to the kit and a **Theme** field; this example defaults to **paper**. Checked one frame per scene in each theme (`contact-sheet-themes.png`). Fixed: two text colours hard-coded white, invisible on paper and pop.

## Craft notes

- Write scene CSS with the theme variables (`--ink --muted --surface --surface2 --border --r --rs --shadow --glow --solid --on-solid`), never literal colours, or a light theme breaks.
- Headlines get the `disp` class and sizes as `calc(Npx * var(--ds))`, so serif and mono themes can size up or down.

- Typing with editable text: animate `max-width` from 0 in `steps()` on an inline-block with `white-space:nowrap; overflow:hidden`. Any text length types; short text simply finishes early.
- Streaming answer: one field per line, each line revealed with `clip-path` in `steps()`, staggered 0.6 s.
- An element with two animations shares one start time; to fade something in and later out, nest it (outer fades in, inner fades out with its own `--d`).
