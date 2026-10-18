# Render worker (distributed rendering)

A stateless HTTP worker for `renderDistributed`: each request is one chunk job (a document plus a frame range); the response is the encoded chunk. Point `httpRunner` at as many workers as you like.

```js
import { renderDistributed, httpRunner } from "@miraiclip/server-export";

await renderDistributed(doc, {
  format: "mp4",
  out: "video.mp4",
  runner: httpRunner({ endpoints: "https://render-xyz.run.app", headers: { authorization: `Bearer ${token}` }, concurrency: 16 }),
});
```

The coordinator joins chunks with `ffmpeg` (stream copy, no re-encode), so it needs ffmpeg on its PATH. Workers don't.

## Deploy

- **Cloud Run**: `gcloud run deploy render --source . --cpu 2 --memory 4Gi --concurrency 1 --set-env-vars RENDER_TOKEN=…`. One job per instance (`--concurrency 1`); Cloud Run adds instances as jobs arrive and scales to zero after.
- **AWS Lambda**: build this image, add the [Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter) layer, give it 4 GB+ memory and a function URL with a 15-minute timeout. Keep chunks short (`chunks` ≥ minutes of video).
- **Anything else** that runs a container (Fly, Render, a VM): run the image and expose port 8080.

Assets must be reachable from the workers: use http(s) URLs in the document (signed URLs work), not local paths. Set `RENDER_TOKEN` on every public deployment. The image installs Google Chrome, which the worker finds on its own (set `MIRAICLIP_BROWSER` to use another browser).
