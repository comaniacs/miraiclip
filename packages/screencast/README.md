# @miraiclip/screencast

Turn a screen recording into a polished tutorial with **planners**: pure functions that read the recording's interaction log (from `@miraiclip/capture`) and return ordinary Miraiclip commands. Every result is a normal edit: you can see it on the timeline, tweak it and undo it.

```ts
import { applyCommands } from "@miraiclip/core";
import { planScreencast } from "@miraiclip/screencast";

const plan = planScreencast(project.getState().doc, session, { clipId: "screen", callouts: true });
applyCommands(project, plan.commands); // one undo step
```

| Planner | What it adds |
| --- | --- |
| `planZooms` | Push-ins on clicks and typing (transform keyframes on the screen clip), grouped, held and eased back out; never shows the frame's edge |
| `planCursor` | A smooth cursor (html clip) following the recorded pointer path through every zoom; record with `cursor: "never"` |
| `planClickEffects` | A ripple at every click |
| `planRedactions` | Pixelate or blur limited to each sensitive field's box (passwords, card numbers, `[data-private]`…), following page scrolls |
| `planCallouts` | "Click “Save”" tooltips beside clicked controls, from the labels the log recorded |
| `planScreencast` | All of the above in the right order, each planned on the previous step's result |

Planners respect trims and speed changes on the screen clip, so you can cut the recording first and plan afterwards. No network, no AI, no renderer code: zooms are keyframes, overlays are html clips from `@miraiclip/registry`, redaction is an effect region.

Docs: https://docs.miraiclip.com/
