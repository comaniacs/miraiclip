# Miraiclip Recorder (desktop)

An Electron app for macOS and Windows built on `@miraiclip/capture`. It records a whole screen, your camera and your voice. It also logs **clicks, shortcuts, scrolls and the cursor path in every app**, not just in the browser. It saves the same `.mcrec` file as the Capture extension, so the editor's Record → Import gives you steps, zooms, the cursor highlight and click ripples on desktop recordings too.

```sh
pnpm --filter miraiclip-capture-desktop start      # build and run
pnpm --filter miraiclip-capture-desktop test       # click-log unit tests
pnpm --filter miraiclip-capture-desktop dist:mac   # → release/*.dmg   (run on a Mac)
pnpm --filter miraiclip-capture-desktop dist:win   # → release/*.exe   (run on Windows)
```

## Releases and downloads

This repo is private, so installers are published to a separate **public, releases-only repo**, [comaniacs/miraiclip-recorder](https://github.com/comaniacs/miraiclip-recorder). It holds only a README (`public-repo/README.md`) and the releases. The docs and the Editor UI kit link to its "latest" downloads, which always point at the newest release:

| Platform | Link |
|---|---|
| macOS, Apple silicon | `https://github.com/comaniacs/miraiclip-recorder/releases/latest/download/Miraiclip-Recorder-mac-arm64.dmg` |
| macOS, Intel | `https://github.com/comaniacs/miraiclip-recorder/releases/latest/download/Miraiclip-Recorder-mac-x64.dmg` |
| Windows (x64 and arm64 in one installer) | `https://github.com/comaniacs/miraiclip-recorder/releases/latest/download/Miraiclip-Recorder-Setup.exe` |

The file names have no version in them so these links never change. Don't rename them in `build.mac.artifactName` / `build.nsis.artifactName` without updating the docs and the UI kit.

To release (`.github/workflows/recorder-release.yaml`):

1. Bump `version` here and commit.
2. `git tag recorder-v<version> && git push origin recorder-v<version>`.
3. macOS and Windows build in CI and upload into a draft release `v<version>` on the public repo, then the workflow publishes it.

One-time setup: create the public repo with a first commit (the README), and add the repo secret `RECORDER_RELEASE_TOKEN` here: a fine-grained token with **Contents: read and write** on `comaniacs/miraiclip-recorder` only. Signing secrets (`MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`, `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`, and the Apple notarization ones commented in the workflow) are optional; without them the builds are unsigned.

From your own computer instead of CI (builds only that computer's platform): `GH_TOKEN=<token> pnpm --filter miraiclip-capture-desktop release`.

## How it works

- **Recorder window** (`src/renderer/recorder.ts`): pick a screen (thumbnails of each display), camera and microphone, the countdown, and the computer's sound (Windows). The recording runs in this window with `startRecording` and is hidden while recording. The main process answers `getDisplayMedia()` with the chosen screen, so no system picker appears.
- **Click log** (`src/main/input-log.ts`): a system-wide hook ([uiohook-napi](https://github.com/SnosMe/uiohook-napi), prebuilt for macOS and Windows on x64 and arm64) turns mouse, key and wheel events into capture events. They are logged in the recorded display's CSS pixels from its top-left corner. The session's viewport is the display, and `viewportInVideo` is the whole frame, so events map 1:1 onto the video.
  - A press and release in the same spot is a `click`. A right click is a `contextmenu`, and a second quick click adds a `dblclick`. A drag only logs moves.
  - Keys follow the browser logger's rule. Named keys and shortcuts are kept (`Enter`, `Shift+Tab`, `Meta+k`). Typed characters are only ever `"text"`, so **what you type is never recorded**.
  - Wheel turns go into a virtual scroll offset (there is no page to read one from).
  - The pointer leaving the recorded display logs one `leave`. Clicks on the recorder's own windows and its shortcuts are not logged.
- **Control pill**: shows the time and whether the click log is running, with step, pause, discard (click twice) and finish. **Camera self-view**: a round preview. Both are always on top and use content protection, which keeps them out of the screen video on Windows 10 2004 and later. The camera is saved as its own file, and the editor places it as a round picture-in-picture.
- **Shortcuts** (global, the same as the extension): Alt+Shift+X finish, Alt+Shift+S mark a step, Alt+Shift+P pause/resume.
- **Saving**: `packRecording` → `.mcrec`, saved to `Videos/Miraiclip` (or wherever you choose). The session says `surface: "monitor"` and `cursorInVideo: true`, so the editor highlights the real pointer instead of drawing a second one.

## Permissions

| | macOS | Windows |
|---|---|---|
| Screen | Screen Recording (System Settings → Privacy & Security). Quit and reopen after allowing. | none |
| Click log | Accessibility (the app asks; the panel links to the pane). Without it, the app records without the log. | none |
| Camera, microphone | asked on first launch | Windows privacy settings |

## Limits (first version)

- **Whole screens only.** Recording a single window needs that window's position on screen while recording. That's next.
- **No element labels.** The log has positions and keys but not what was clicked (button names, field boxes), so automatic blur of password fields doesn't happen on desktop recordings. That needs macOS Accessibility / Windows UI Automation (planned).
- **macOS self-view**: macOS 15+ captures can include windows that ask to be excluded, so on macOS the camera self-view hides while recording. The pill stays; check that it isn't in the video, and if it is, move it to another display.
- **Big recordings** are packed in memory before saving (fine for typical walkthroughs; very long recordings should stream to disk later).
- **Signing**: unsigned builds show Gatekeeper / SmartScreen warnings. Release builds need an Apple Developer ID (signing and notarization) and a Windows code-signing certificate.
