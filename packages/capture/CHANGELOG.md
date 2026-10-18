# @miraiclip/capture

## 0.1.0

### Minor Changes

- fd07ee1: One file per recording: `packRecording` / `unpackRecording` turn a recording's screen, camera and session into a single `.mcrec` file (a plain ZIP) and back, plus `isRecordingFile`. The reference Capture extension now saves one `.mcrec` instead of separate video and session files.
- fd07ee1: New packages for screen recordings: capture with an interaction log, screencast planners, transcripts and text-based editing, narration with alignNarration, and written guides.

### Patch Changes

- fd07ee1: Resizing or zooming a tab while recording no longer freezes the video: the file keeps its first frame size and the resized picture is scaled to fit, centred. Events logged after a resize are moved into the first viewport's coordinates (`fitResizedEvents`), and a tab's `session.viewport` is now the one the video shows.
