---
"@miraiclip/renderer": patch
---

Video recovers when the platform closes a decoder (iOS Safari reclaiming a hardware decoder, or a decode error): the pipeline replaces the dead `VideoDecoder` and re-seeks from the nearest keyframe instead of feeding it forever ("VideoDecoder is not configured" on every frame). Reclaims recover quietly; other decode errors reach `onError` once per failure, with retries backing off from 250 ms to 5 s. New export: `isRecoverableDecoderError`.
