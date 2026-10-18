# Render cost (R1)

Measured 2026-10-17 with `pnpm --filter @miraiclip/server-export bench:cost`: a typical product video (a 16:9 screen recording with a zoom every 6 s, an animated cursor, an animated html lower third and karaoke captions), exported through the server path (`createExportSession`), CPU time read from `/proc/stat` across the whole machine (browser processes included). Raw numbers: `packages/server-export/bench/render-cost.json`.

| Output | Format | CPU-seconds per output minute | Real-time factor (2 vCPU) |
| --- | --- | --- | --- |
| 1920×1080, 30 fps | WebM (VP9) | **932** | 0.12× |
| 3840×2160, 30 fps | WebM (VP9) | **4,375** | 0.03× |

Machine: 2 vCPU Intel Xeon @ 2.1 GHz, no GPU (SwiftShader software GL), Chromium with software VP9 encoding. This is the **pessimistic case**: VP9 is the slowest common software encoder, and this Chromium build can't encode H.264. Re-run on the chosen worker type with Google Chrome and `--format mp4` before setting prices.

## What it costs on Cloud Run

Cloud Run request-based billing, tier 1 (checked 2026-10-17): $0.000024 per vCPU-second and $0.0000025 per GiB-second while handling requests, nothing when scaled to zero. Assuming 2 GiB per vCPU:

| Output | CPU | Memory | **Compute per output minute** |
| --- | --- | --- | --- |
| 1080p30 | 932 × $0.000024 = $0.0224 | 932 × 2 × $0.0000025 = $0.0047 | **≈ $0.027** |
| 4K30 | 4,375 × $0.000024 = $0.105 | 4,375 × 2 × $0.0000025 = $0.022 | **≈ $0.127** |

Not included: egress, storage, the ffmpeg join (a stream copy: seconds), cold starts (a few seconds per new instance), failed or retried chunks.

## Reading it

- **1080p30 at ≤ $0.10 per minute is viable** at roughly 3–4× margin over raw compute, even in this worst case. H.264 should widen it.
- **4K30 costs more than $0.10 per minute to render** with software GL + VP9: price 4K separately (well above 1080p), or render 4K on GPU workers and re-measure.
- Distributed rendering (R2) doesn't change total CPU per minute; it cuts wall time, which is what customers wait for. Chunking adds about one warm-up per chunk (browser start, font and decoder set-up), so keep chunks ≥ 10 s of output.
- Browser export in the user's own tab stays free to us; cloud render is for batch, API, agents and headless jobs.

Sources: [Cloud Run pricing](https://cloud.google.com/run/pricing).
