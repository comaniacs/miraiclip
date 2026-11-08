---
"@miraiclip/transcript": minor
---

`cutWords` reads transcript cuts back from the timeline (with the words each took out) and `restoreWords` plans the commands that put chosen words back in place: the piece before them grows or a piece is inserted for words in the middle of a cut, later clips on the affected tracks and markers move right, linked clips get their time back, and pieces that meet again in the source are joined. Restoring every word of a cut gives back the original clips.
