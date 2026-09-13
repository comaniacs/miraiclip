---
title: Production Readiness
weight: 6
---

What you can rely on today, what to design around, and how to verify Miraiclip against your own workload. Every claim below is backed by a nightly stress suite; numbers were measured under software rendering (the slowest case), so real hardware does better.

## What works today

| You can… | Verified by |
| --- | --- |
| Edit timelines with **hundreds of clips** across many tracks — playback keeps tracking the clock, deep seeks recover | 149 clips / 10 tracks with effects, transitions, captions: median lag 2 frames, p95 19 |
| Export **any timeline length with flat memory** — stream the output, audio mixes in bounded chunks | streamed export with audio on every clip: 29 MB heap peak, 2 MB drift (one-hour run in progress) |
| Use **more assets than the decoder allows at once** — pipelines recycle transparently | 20 assets through the 4-decoder cap + a 30-seek scrub storm: every paused seek lands exact |
| Run **server exports in parallel** — jobs don't corrupt or slow each other | 3 concurrent exports: all valid, no interference |

## Design around these

| Limit | What to do |
| --- | --- |
| A buffered export holds the whole file in memory | For long outputs, pass [`target`](../export/client-side/#streaming-to-disk) in the browser or `out` on the server — the file streams out as it encodes |
| At most 4 assets decode *simultaneously* (engine default) | Sequential timelines of any length are unaffected; raise `maxActivePipelines` if you show more than 4 distinct videos at once |
| MP4 export needs real Chrome | Free Chromium builds have no H.264 encoder — use WebM there, or ship Chrome for [server exports](../export/server-side/#the-browser) |

## Not yet verified

Treat these as open until we publish numbers: playback smoothness percentiles on real devices, seek latency under rapid seeking, hour-long *source* files, process-level memory (figures above are JS heap), failure recovery, and sustained server concurrency.

## Check your own workload

```bash
pnpm stress
```

| Env knob | Default | Meaning |
| --- | --- | --- |
| `STRESS_MINUTES` | `5` | Long-export timeline length |
| `STRESS_MIN_FPS` | `5` | Export throughput floor |
| `STRESS_MAX_LAG_FRAMES` | `30` | Playback tracking tolerance (tighten on real hardware) |
| `STRESS_PARALLEL` | `3` | Concurrent server exports |

Results append to `apps/playground/stress-results.json`. Point the synthetic-timeline knobs at your scale — a run on your hardware is worth more than our CI numbers.
