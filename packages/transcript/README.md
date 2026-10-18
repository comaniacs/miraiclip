# @miraiclip/transcript

Word-level transcripts for Miraiclip projects, and the edits they make possible.

```ts
import { applyCommands } from "@miraiclip/core";
import { openAiAsr, planCleanup, editByText, captionCommands } from "@miraiclip/transcript";

const transcript = { ...(await openAiAsr({ apiKey }).transcribe(file)), assetId: "screen" };

// Remove "um", "uh", stutters and long pauses: one ripple cut, one undo step.
applyCommands(project, planCleanup(project.getState().doc, transcript, { linkedClipIds: ["camera"] }).commands);

// Text-based editing: delete words from the text, get the cuts.
applyCommands(project, editByText(project.getState().doc, transcript, editedText).commands);

// Karaoke captions for what the timeline says now.
applyCommands(project, captionCommands(project.getState().doc, transcript, { trackId: "captions" }));
```

- **Speech-to-text**: an `AsrProvider` contract with OpenAI (Whisper, word timestamps) and Deepgram adapters. Keep keys server-side with `createAsrHandler` + `remoteAsr`.
- **Transcripts live in source time**, so they stay valid through trims, cuts, moves and speed changes. `transcriptOnTimeline` maps them through the clips.
- **Detection**: `detectFillers` (per-language lists, optional phrases), `detectRepeats`, `detectSilences`.
- **Cuts**: `cutCommands` splits, removes and ripples the media clips, any linked clips (a camera recorded alongside) and later markers, computed against a scratch copy so the commands replay exactly.

Docs: https://docs.miraiclip.com/
