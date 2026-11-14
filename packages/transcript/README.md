# @miraiclip/transcript

Word-level transcripts for Miraiclip projects, and the edits they make possible.

```ts
import { applyCommands } from "@miraiclip/core";
import { openAiAsr, planCleanup, editByText, captionCommands, cutWords, restoreWords, overdubSlot, planOverdub } from "@miraiclip/transcript";

const transcript = { ...(await openAiAsr({ apiKey }).transcribe(file)), assetId: "screen" };

// Remove "um", "uh", stutters and long pauses: one ripple cut, one undo step.
applyCommands(project, planCleanup(project.getState().doc, transcript, { linkedClipIds: ["camera"] }).commands);

// Text-based editing: delete words from the text, get the cuts.
applyCommands(project, editByText(project.getState().doc, transcript, editedText).commands);

// Put cut words back where they were (the cuts are read back from the timeline).
const cuts = cutWords(project.getState().doc, transcript); // [{ atUs, words: [3, 4], removedUs, … }]
applyCommands(project, restoreWords(project.getState().doc, transcript, [3]).commands);

// Overdub: new speech in the place of some words. The old words go silent, nothing moves.
const slot = overdubSlot(project.getState().doc, transcript, { assetId: "screen", from: 12, to: 14 });
applyCommands(project, planOverdub(project.getState().doc, slot, { assetId: "take", durationUs, name: "Overdub", src: "asset://take" }).commands);

// Karaoke captions for what the timeline says now.
applyCommands(project, captionCommands(project.getState().doc, transcript, { trackId: "captions" }));
```

- **Speech-to-text**: an `AsrProvider` contract with OpenAI (Whisper, word timestamps) and Deepgram adapters. Keep keys server-side with `createAsrHandler` + `remoteAsr`.
- **Transcripts live in source time**, so they stay valid through trims, cuts, moves and speed changes. `transcriptOnTimeline` maps them through the clips.
- **Detection**: `detectFillers` (per-language lists, optional phrases), `detectRepeats`, `detectSilences`.
- **Cuts**: `cutCommands` splits, removes and ripples the media clips, any linked clips (a camera recorded alongside) and later markers, computed against a scratch copy so the commands replay exactly. With `syncTracks` every other unlocked track keeps in sync too (titles, music, a voice-over laid on the speech): clips after a cut move left as far as fits, a clip straddling the cut holds its track; `exclude` keeps some tracks still.
- **Restore**: `cutWords` lists the cuts on the timeline (pieces side by side whose source skips ahead) with the words each took out; `restoreWords` puts chosen words back in place: the piece before grows or a piece is inserted, later clips and markers move right, linked clips get their time back, and pieces that meet again in the source are joined. Restoring every word of a cut gives back what it took out; `syncTracks` works the same way, moving other tracks back right.

Docs: https://docs.miraiclip.com/
- **Overdub**: `overdubSlot` finds the words on the timeline (no audio needed, so a caller can check before paying for a take) and `planOverdub` fits a take into their room: the clip is split around the old words and the middle goes silent, the take plays on its own audio track with short fades, sped up by at most `maxSpeedup` (default 1.15) and refused with `OverdubPlanError("too_long")` past that, because the only other way to fit it is to move things.
