---
title: Screen recordings to product videos
weight: 11
---

Record a screen once and get an edited product video and a written guide from it, in any language. Each step is a separate, open package that returns ordinary commands, so every result shows up on the timeline where people can see it, change it and undo it. Nothing is a black box, and nothing needs a Miraiclip server.

| Step | Package | What it does |
| --- | --- | --- |
| Record | `@miraiclip/capture` | Screen, mic and camera in the browser, plus a log of clicks, keys, scrolls and private fields on the same clock |
| Clean up | `@miraiclip/transcript` | Speech to text (OpenAI, Deepgram or your own), filler, stutter and pause removal, text-based editing, captions |
| Polish | `@miraiclip/screencast` | Zooms on the action, a clean cursor, click ripples, blurred secrets, step callouts |
| Voice | `@miraiclip/narration` | A script per step, a rewrite by any chat model, speech from any voice generator, `alignNarration` |
| Document | `@miraiclip/guides` | A step-by-step article with annotated screenshots, as Markdown, HTML or JSON |
| Translate | `@miraiclip/localize` | One variant per language: on-screen text, captions, chapters and the voiceover script |
| Brand | `@miraiclip/brand` | Colours, fonts, logo, caption style, intro and outro from one brand kit |

## 1. Record

```ts
import { startRecording } from "@miraiclip/capture";

const recording = await startRecording({
  screen: { video: true, preferCurrentTab: true } as DisplayMediaStreamOptions,
  microphone: true,
  camera: true,
  cursor: "never", // a clean cursor is drawn later
});
recording.mark("Open settings", { kind: "step" }); // optional: name the steps as you go
const { screen, camera, session } = await recording.stop();
```

Media is encoded with WebCodecs while you record (WebM by default, MP4 with `format: "mp4"`) and can stream to a file (`screenTarget`), so long recordings don't fill memory. The `session` is plain JSON: the viewport, the media and every interaction, with times in microseconds since the recording started.

The log is **private by design**. It never records what was typed or any field's value: printable keys are logged as `"text"`, and only named keys and shortcuts (`Enter`, `Meta+k`) keep their names. Password, card, one-time-code and secret-named fields, and anything inside `[data-private]` or `[data-sensitive]`, are flagged `sensitive` so redaction can find them. The event log works when you record the tab you're on. For other windows you still get the media, and the planners have less to go on.

To keep or share a recording as **one file**, pack it:

```ts
import { packRecording, unpackRecording, isRecordingFile } from "@miraiclip/capture";

const file = await packRecording({ screen, camera, session }); // a .mcrec Blob: save or upload it
// later, from a file input or a drop:
if (isRecordingFile(picked)) ({ screen, camera, session } = await unpackRecording(picked));
```

A `.mcrec` is a plain ZIP (files stored uncompressed, since the videos already are) holding `screen.webm` (or `.mp4`), `camera.webm` when there's a camera, and `session.json`. Rename it to `.zip` to look inside. Unpacking only slices the file, so even long recordings aren't copied in memory. ZIP's limit applies: up to 4 GB per recording.

Start a project from it with `sessionCommands(session, { screenSrc, cameraSrc })`: the recording on its own track, the camera as a picture-in-picture, a marker per step. `apps/capture-extension` in the repository is a small reference Chrome extension built on the same API.

## 2. Clean up the talking

```ts
import { openAiAsr, planCleanup, editByText } from "@miraiclip/transcript";

const transcript = { ...(await openAiAsr({ apiKey }).transcribe(micFile)), assetId: "screen" };
applyCommands(project, planCleanup(project.getState().doc, transcript, { linkedClipIds: ["camera"] }).commands);
```

`planCleanup` removes fillers ("um", "uh", per language), stutters ("the the") and long pauses as one ripple cut: the media, its linked camera and later markers all move together, and it's one undo step. For text-based editing, give `editByText` the transcript text with words deleted and it returns the cuts. Transcripts are kept in the media's own time, so they stay valid through any later trim, cut or speed change. `transcriptOnTimeline` tells you what the timeline says now, and `captionCommands` makes karaoke captions from it.

Speech-to-text goes through an `AsrProvider` contract with OpenAI and Deepgram adapters. Keep keys on your server with `createAsrHandler`, and give the browser `remoteAsr(endpoint, id)`.

## 3. Polish

```ts
import { planScreencast } from "@miraiclip/screencast";

const plan = planScreencast(project.getState().doc, session, { clipId: "screen", callouts: true });
applyCommands(project, plan.commands);
```

| Planner | Built from |
| --- | --- |
| `planZooms` | Transform keyframes on the screen clip: clicks and typing close in time share one zoom, consecutive zooms pan instead of bouncing out, and the frame's edge never shows |
| `planCursor` | An html cursor clip from the registry, its path smoothed and simplified, landing exactly on every click and following every zoom |
| `planClickEffects` | A ripple block at each click |
| `planRedactions` | A pixelate or blur effect limited to each sensitive field's box (an effect region), following page scrolls, from page load until the page changes |
| `planCallouts` | "Click “Save”" tooltips beside clicked controls, on whichever side has room |

Every planner respects trims and speed changes on the screen clip, so cut first, then plan. `planScreencast` runs them in the right order on a scratch copy (redactions, then zooms, then the overlays that follow the zooms) and returns the commands per step (`plan.steps`), so a UI can offer each one separately.

## 4. Voiceover

```ts
import { scriptFromMarkers, rewriteScript, synthesizeNarration, alignNarration } from "@miraiclip/narration";
import { openAiSpeechGenerator } from "@miraiclip/audio-sources";

let script = scriptFromMarkers(doc, { transcript });              // a line per step, from what was said
script = await rewriteScript(chatModel, doc, script, { style: "friendly, second person" });
const takes = await synthesizeNarration(openAiSpeechGenerator({ apiKey }), script, { store });
const { commands, placements } = alignNarration(doc, script, takes, { clipIds: ["screen"], linkedClipIds: ["camera"] });
```

Each line gets its step's time as a word budget, so the rewrite mostly fits. `alignNarration` then fits every line to its step, the same way every time. When a line runs long, the step's last frame is held (a freeze-frame clip), or with `fit: "slow"` the step plays slower. With `speedUp`, a step with little to say plays faster. Every adjustment is a normal clip, speed or move, and `placements` reports what happened to each line, so sync problems are easy to see and fix.

Any chat model works for the rewrite (the [assistant](assistant) package's models fit), and any `@miraiclip/audio-sources` voice generator works for speech: ElevenLabs, OpenAI or a server proxy. Lengths are read from the audio itself, and unchanged lines are reused when you regenerate. An `AvatarProvider` contract and `avatarCommands` are there for a presenter on camera; adapters for avatar services implement it.

## 5. A written guide

```ts
import { buildGuide, addStills, toMarkdown } from "@miraiclip/guides";

let guide = buildGuide(doc, { title: "Turn on dark mode", session, clipId: "screen", script });
guide = await addStills(guide, doc, (d, o) => renderSession.renderStill(d, o), { store });
const markdown = toMarkdown(guide);
```

Steps come from step markers (or from every click), and titles come from the marker or the action ("Click “Save”", "Press Enter"). The text comes from the narration or from what was said. Screenshots are taken just before each action, with the control outlined, the rest dimmed and the step number beside it; sensitive fields are never highlighted. The output is plain files, and `toHtml` makes a standalone page that works in light and dark mode.

## 6. Every language

```ts
import { deeplTranslator, localizeMany } from "@miraiclip/localize";

const variants = await localizeMany(baseDoc, deeplTranslator({ apiKey }), ["fr", "de", "hi"], { script, keep: ["Acme"] });
```

Each variant translates on-screen text, captions (keeping word timing when the word count matches), html block text, chapter markers and the project name, and returns the translated script. Re-voice it with `synthesizeNarration` and `alignNarration` on the variant (start from the project before narration). Terms in `keep` and `{{placeholders}}` stay as written. Translators are a contract: a chat model (`chatTranslator`), DeepL, or your own.

## 7. On brand

```ts
import { applyBrand, parseBrandKit } from "@miraiclip/brand";

applyCommands(project, applyBrand(doc, parseBrandKit(kitJson)).commands);
```

A brand kit loads its fonts and uses them on text, captions and blocks, recolours block colour fields by role, styles captions, adds a logo watermark, and adds an intro and outro from the [block registry](blocks) (the content moves to make room). Applying it twice doesn't stack intros or logos.

## Keys and cost

Every vendor call (speech-to-text, translation, chat, voice) goes through a small contract with your own key, and the packages include server handlers so keys never reach the browser. Exports run in the browser for free, or on your servers with [server export](export/server-side), including [distributed rendering](export/server-side#distributed-rendering) across many workers.
