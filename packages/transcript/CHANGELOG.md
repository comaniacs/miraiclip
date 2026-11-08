# @miraiclip/transcript

## 0.3.0

### Minor Changes

- 89fcb35: `syncTracks` option for `cutCommands` (and so `removeWords`, `editByText`, `planCleanup`) and `restoreWords`: every other unlocked track keeps in sync with the cut media, so a voice-over, title or music laid over the speech stays with what it was laid on. After a cut, clips that start after it move left as far as fits; a clip straddling the cut stays and holds its track's later clips back. A restore moves them right again. `{ exclude: [...] }` keeps chosen tracks still. Off by default.

## 0.2.0

### Minor Changes

- 7b31b90: `cutWords` reads transcript cuts back from the timeline (with the words each took out) and `restoreWords` plans the commands that put chosen words back in place: the piece before them grows or a piece is inserted for words in the middle of a cut, later clips on the affected tracks and markers move right, linked clips get their time back, and pieces that meet again in the source are joined. Restoring every word of a cut gives back the original clips.

## 0.1.6

### Patch Changes

- Updated dependencies [7e7673b]
  - @miraiclip/core@0.12.0

## 0.1.5

### Patch Changes

- Updated dependencies [8399f44]
  - @miraiclip/core@0.11.0

## 0.1.4

### Patch Changes

- Updated dependencies [9ac0cee]
  - @miraiclip/core@0.10.0

## 0.1.3

### Patch Changes

- Updated dependencies [5fa8674]
  - @miraiclip/core@0.9.0

## 0.1.2

### Patch Changes

- Updated dependencies [ba096e4]
- Updated dependencies [cdd6cf6]
  - @miraiclip/core@0.8.0

## 0.1.1

### Patch Changes

- Updated dependencies [7477fe6]
  - @miraiclip/core@0.7.0

## 0.1.0

### Minor Changes

- fd07ee1: New packages for screen recordings: capture with an interaction log, screencast planners, transcripts and text-based editing, narration with alignNarration, and written guides.

### Patch Changes

- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
- Updated dependencies [fd07ee1]
  - @miraiclip/core@0.6.0
