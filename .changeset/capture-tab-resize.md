---
"@miraiclip/capture": patch
---

Resizing or zooming a tab while recording no longer freezes the video: the file keeps its first frame size and the resized picture is scaled to fit, centred. Events logged after a resize are moved into the first viewport's coordinates (`fitResizedEvents`), and a tab's `session.viewport` is now the one the video shows.
