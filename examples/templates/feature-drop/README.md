# Feature drop

A 20 s feature announcement in **one continuous shot**, in 16:9 and 9:16 and four themes (midnight is its own):

1. **Hook (0–2.4 s):** a "New in" badge drops with a beating dot, and the feature name focuses in under a sheen.
2. **Before (2.4–4.4 s):** the camera tilts down to the panel. The old manual workflow lists six steps while a clock ticks and the minutes count up.
3. **The wipe (4.4–5.6 s):** the cursor grabs the compare handle and drags it across, wiping the manual list into the new screen: "Now it's one click", with a seconds counter.
4. **Action (5.6–8.4 s):** the camera pushes into the button. The click turns it into a progress bar, then into three results with checks.
5. **Shortcut (8.4–11.6 s):** keycaps rise and physically press the shortcut, and a command palette drops in. The command types, a result is picked, and the confirm key goes down. The palette closes and a toast pops.
6. **Feature page (11.8–17 s):** the camera pulls back with motion blur to the whole feature page: the name, the panel, three benefits and "Rolling out today".
7. End card with the badge and the feature name.

39 fields: every word and number, the three keys, both colours and the theme.

| Where | File | What it is |
| --- | --- | --- |
| here | `build.mjs` | World layout, camera plans, cursor path, scenes |
| here | `feature-drop*.miraiclip.json` | Plain projects with the default copy |
| here | `notes.md`, `template.json`, `contact-sheet*.png` | Notes and scores, metadata, frames |
| `miraiclip-react-template/public/templates/` | `feature-drop.miraiclip-template.json` (midnight), `-paper`, `-terminal`, `-pop`, each with `-vertical` | The templates |

```bash
node examples/templates/feature-drop/build.mjs
```

## Tricks worth reusing

- **Compare wipe driven by the cursor:** the "after" layer's `clip-path:inset(0 <right> 0 0)`, the handle's `translateX` and the cursor's `travel()` stops share the same times and easing, so they move as one. The keyframes run on to a full reveal and fade the handle after the release.
- **Keycaps:** a darker base with a face 12 px shorter. The press keyframe moves the face down 10 px and tints it, then lets it spring back.
- **Button into progress into results:** the label fades, a fill grows across the button, then the button fades out as the result rows pop in its place.
