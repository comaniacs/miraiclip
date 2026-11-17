---
"@miraiclip/assistant": minor
---

A reply cut off by the output limit (`finish: "length"`) no longer ends the turn silently. The tool call it was writing (arguments that never finished) is never run, any finished calls are, and the model is told it was cut off and asked to redo the work in smaller pieces, up to `maxCutOffRetries` times per request (default 2). After that the turn ends with a reply the user can act on. New `cut-off` event; `scriptedChatModel` steps take a `finish` override for testing this.
