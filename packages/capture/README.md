# @miraiclip/capture

Record the screen, microphone and camera in the browser, plus an **interaction log** on the same clock: clicks (with what was clicked), named keys and shortcuts, scrolls, the cursor path, focus, navigation and fields that hold secrets. The log is what turns a raw recording into an edited tutorial: zooms on clicks, a smooth cursor, blurred password fields, steps and chapters.

```ts
import { applyCommands } from "@miraiclip/core";
import { startRecording, sessionCommands } from "@miraiclip/capture";

const recording = await startRecording({ screen: { video: true, preferCurrentTab: true }, microphone: true, camera: true });
recording.mark("Create a project");
// …
const { screen, camera, session } = await recording.stop();

// A starting project: screen track, camera picture-in-picture, a marker per step.
applyCommands(project, sessionCommands(session, { screenSrc: "screen.webm", cameraSrc: "camera.webm" }));
```

- Media is encoded with WebCodecs while you record (WebM VP9 + Opus by default, MP4 H.264 + AAC with `format: "mp4"`), kept in memory or streamed to a writable (`screenTarget`), so long recordings don't fill memory.
- The log **never records what was typed** or any field's value: printable keys log as `"text"`, and only named keys and shortcuts (`Enter`, `Meta+k`) keep their name.
- Password, card, one-time-code and secret-named fields, and anything inside `[data-private]` / `[data-sensitive]`, are flagged `sensitive` so redaction can find them.
- `CaptureSession` is plain JSON: save it next to the media and load it with `parseCaptureSession`.
- Or keep a recording as **one file**: `packRecording({ screen, camera, session })` returns a `.mcrec` (a plain, uncompressed ZIP of `screen.webm`, `camera.webm` and `session.json`), and `unpackRecording(file)` gives the three back without copying the videos.

Docs: https://docs.miraiclip.com/
