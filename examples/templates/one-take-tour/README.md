# One-take product tour

A 22 s product walkthrough in **one continuous shot**, in 16:9 and 9:16 and four themes (pop is its own). There are no cuts. A camera moves over one product UI laid out in "world" pixels:

1. **Hook (0–2.4 s):** three phrases widen in one after another, pushing a spinning glyph along. They collapse back into the glyph as the greeting widens out of it.
2. **Prompt (2.4–5.8 s):** the prompt box rises. The cursor glides in and clicks, the request types across two lines, and the camera pushes in on it.
3. **Menu (5.8–8.4 s):** the cursor clicks **+**, a menu pops from that point, and hovering an item opens a submenu. Two toggles snap on, and the camera follows the cursor into it all.
4. **Send and morph (8.4–10.3 s):** the send button gets pressed. The camera pulls back with motion blur as the prompt box grows into the full app.
5. **Results (10.3–13.6 s):** the request becomes a chat bubble, the reply streams in, and three steps spin into checks. Six result tiles fill the canvas behind a scan line, each a different crop and grade of the image field.
6. **Dive (13.6–16.6 s):** the cursor clicks tile 2, which grows into a full preview. The camera dives in while it plays: the image drifts, the playhead runs, and a caption pops.
7. **Whip out (16.6–19 s):** the camera snaps back to the whole app with motion blur, and a toast says it's done. An end card follows.

37 fields: every word, the image, both colours and the theme.

| Where | File | What it is |
| --- | --- | --- |
| here | `build.mjs` | World layout, camera plans (16:9 and 9:16), cursor path, scenes |
| here | `one-take-tour*.miraiclip.json` | Plain projects with the default copy |
| here | `notes.md`, `template.json`, `contact-sheet*.png` | Notes and scores, metadata, frames |
| `miraiclip-react-template/public/templates/` | `one-take-tour.miraiclip-template.json` (pop), `-midnight`, `-paper`, `-terminal`, each with `-vertical` | The templates |

```bash
node examples/templates/one-take-tour/build.mjs
```

The image is example 1's `product.jpg` in R2, and fonts come from `templates/_shared/`, so nothing new needs uploading.

## How the one-take works

The kit's choreography layer (`camera`, `travel`, `presses`, `CURSOR_CSS`/`cursorHtml` in `../_kit.mjs`) does the work:

- **The world.** The whole UI sits in one `.world` div (3200×1800 here), laid out in its own pixels.
- **The camera** is keyframed from stops: `{ t, x, y, z, blur, ease }`. Each stop puts world point (x, y) at the frame's centre at zoom z. `ease` shapes the move leaving the stop, and `blur` adds motion blur on whip moves.
- **9:16 has its own camera plan** over the same world. The `vertical` CSS redefines `@keyframes cam`, and the last definition wins.
- **The cursor** lives in the world, so it scales with the camera. It moves along `travel()` stops and squashes at each click (`presses()`) with a ripple. UI reactions are ordinary `--d` start times set to the click times.
- **Morphs** animate `left/top/width/height` of one box. The old content fades out and the new content fades in inside it, and `overflow:hidden` reveals the new layout as the box grows.
