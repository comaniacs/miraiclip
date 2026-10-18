# @miraiclip/narration

Studio voiceover for a screen recording, in four plain steps you can inspect and edit between:

```ts
import { applyCommands } from "@miraiclip/core";
import { openAiSpeechGenerator } from "@miraiclip/audio-sources";
import { scriptFromMarkers, rewriteScript, synthesizeNarration, alignNarration } from "@miraiclip/narration";

const doc = project.getState().doc;
let script = scriptFromMarkers(doc, { transcript });                     // 1. a line per step
script = await rewriteScript(chatModel, doc, script, { style: "friendly" }); // 2. optional: clean it up
const takes = await synthesizeNarration(openAiSpeechGenerator({ apiKey }), script, { store }); // 3. speak it
const plan = alignNarration(doc, script, takes, { clipIds: ["screen"], linkedClipIds: ["camera"] }); // 4. fit it
applyCommands(project, plan.commands);
```

- **`alignNarration`** is deterministic. Each line gets its step's slot; a line that runs long gets a **freeze frame** at the end of its step (or a **slow-down** with `fit: "slow"`), and with `speedUp` a step with little to say plays faster. Every adjustment is an ordinary clip, speed or move on the timeline, and `placements` lists what happened to each line, so sync problems are visible and fixable.
- **Any chat model** for the rewrite (`@miraiclip/assistant` models fit), with a per-line word budget from the step's length.
- **Any voice generator** from `@miraiclip/audio-sources` (ElevenLabs, OpenAI, a server proxy). Lengths are read from the audio itself; unchanged lines are reused on re-generation.

Docs: https://docs.miraiclip.com/
