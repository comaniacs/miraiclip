---
"@miraiclip/renderer": minor
---

Refresh media links in a long session. `player.refreshMedia()` reopens every media source on next use (video pipelines are released and re-acquired, audio sources are closed and reopened, playback carries on from the current position) without rebuilding the player, touching the document or adding an undo entry. A host whose media links expire (signed URLs) gives the player an `openDemuxer` / `openAudio` that answers with the current link for an asset, then calls `refreshMedia()` when the links change. `createPreviewController({ media: { openDemuxer, openAudio } })` replaces the built-in readers (the controller used to ignore them), and `onPlayerReady` hands over the player. Images already on screen keep their loaded textures.
