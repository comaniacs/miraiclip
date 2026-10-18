# Capture extension

A Manifest V3 Chrome extension built on `@miraiclip/capture`: record your screen, a window or a tab with your camera and voice, review it, and download it for the editor with every click, key and step logged.

```sh
pnpm --filter miraiclip-capture-extension build   # → apps/capture-extension/dist
```

Then open `chrome://extensions`, turn on Developer mode, and **Load unpacked** → `dist/`.

## How it works

- **Toolbar button / Alt+Shift+M** injects the recorder (`src/content.ts`) into the current tab: a setup panel (Screen + Cam, Screen only, Cam only; Screen, Window or This tab; camera and microphone pickers with a level meter; countdown, bubble and mirror options, remembered in `chrome.storage.local`). Pages extensions can't touch open `record.html`, which runs the same recorder.
- **Camera bubble**: a round, draggable S/M/L preview. It hides when recording starts, so it isn't burned into the screen video: the camera is always saved as its own file and the editor places it as a picture-in-picture. Turn on "Also show the camera bubble in the screen video" to keep it on the page. It can float over other apps (Document Picture-in-Picture).
- **Countdown, then the control pill**: finish, pause/resume, mark a step, draw on the page (`src/draw.ts`: pen, highlighter, arrow, box on a canvas over the page, marks fade after ~3 s, Ctrl+Z, Esc), mute, restart (a new take without re-picking the screen: each take records clones of the shared and device streams), delete. Restart and delete ask first. The background worker (`src/background.ts`) shows a REC badge and relays the shortcuts (Alt+Shift+X finish, Alt+Shift+P pause, Alt+Shift+S step).
- **Saving**: the recorder hands the screen, camera and session to `bridge.html`, a hidden extension page it frames (with a one-time token from the background worker), which stores them in the extension's IndexedDB (`src/store.ts`). If that fails, the recording downloads as a `.mcrec` instead.
- **Review page** (`review.html`, `src/review.ts`): the library of recordings, a player with the camera as a picture-in-picture, rename, steps to jump to, **Download for the editor** (`.mcrec`, via `packRecording`; separate files over 4 GB), download the video, delete.
- **Window and screen recordings**: `src/logger.ts` runs in every page and, only during such a recording, logs that page's events in frame coordinates and sends them to the recorder.

Everything the recorder draws lives in a shadow root marked `data-private`, and the event log ignores clicks on it.

Docs: `screen-recordings/capture-extension` in miraiclip-docs.
