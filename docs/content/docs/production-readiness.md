---
title: Production Readiness
weight: 6
---

Miraiclip ships with a **stress tier** on top of the unit and golden e2e suites: long timelines, long exports, decoder churn, and parallel server exports, each with hard gates and recorded metrics. It runs nightly in CI and anyone can run it locally.

Read the numbers for what they are: **regression benchmarks under software rendering**. They establish resource management and recovery on the tested workloads — a leak, stall, or blackout fails the gate — not smooth playback or fast exports at every scale. What they do and don't cover is stated below, including the [ceilings](#known-ceilings) that make hour-long exports impractical today.

## What is validated

All CI numbers were measured under **SwiftShader software rendering** (headless Chromium, no GPU) — a deliberately slow environment. Real GPUs are generally faster, but note two limits of that comparison: hardware exports take a *different* capture path (zero-copy snapshot) than the CPU path these memory numbers exercise — its correctness is covered by the golden e2e suite, its memory profile is not benchmarked here — and all heap figures are **JS heap only** (decoded frames, codec resources, and GPU memory live outside it).

| Scenario | Timeline | Gate | Measured (CI, software GL) |
| --- | --- | --- | --- |
| Many-clip playback | 149 clips / 10 tracks / 2 min, effects + transitions + captions | Frame keeps tracking the clock (no stall/blackout), deep seek recovers | median lag 2 frames, **p95 19 frames**, max 34; JS heap 9→10 MB over ~40 s |
| Long export (streaming + chunked audio) | `STRESS_MINUTES` timeline with real audio on every clip, output streamed (never held in memory) | JS heap FLAT after warmup — with streaming there is no honest accumulation left, so any growth is a leak | 2-min verification: heap peak **29 MB**, settled spread **2 MB**; a full one-hour demonstration is in progress — its numbers land here |
| Asset churn | 20 distinct assets through the 4-pipeline cap + 30-seek scrub storm | Playback survives eviction; paused seeks land exact (±1 frame) | **1.0 hit rate**; probes exact (storm seeks are fire-and-forget — per-seek latency isn't measured yet) |
| Export throughput | 60-s composition → 640×360 WebM draft | ≥ 5 fps encode floor | **14.2 fps** encoded — 2.1× the composition's duration; a software-CI baseline, not a production speed claim |
| 4K → 1080p export | Short 4K source → 1080p WebM (local fixture) | Completes, tracked | 2.7 fps (180 frames) |
| Parallel server exports | 3 concurrent `exportProjectFile` runs | All valid files, no cross-run interference | Solo 3.6 s; batch of 3 in 8.2 s (1.34× speedup on a CPU-bound box) |

## Not yet validated

Planned as the next benchmark iteration — treat these as open until measured:

- **Real-device playback percentiles** — p95/p99 presentation lag and dropped/repeated frame counts on actual hardware (the CI tolerance is sized for software decode).
- **Seek latency distribution** — warm/cold seek p95/p99 and correctness under overlapping seek requests.
- **Hour-scale media** — long (60–120 min) *source files* are untested (the chunked-audio + streaming work lifted the output-length ceilings, and a full one-hour output is being demonstrated; long sources exercise different paths — demuxer indexes, deep seeks).
- **Process-level memory** — renderer/GPU-process measurements and repeated open/edit/export/close cycles; today's figures are JS heap.
- **Recovery paths** — export cancel/retry, decoder failure, missing media, GPU context loss without hangs or retained resources.
- **Sustained server concurrency** — long jobs at increasing parallelism with p95 completion time and failure rate; today's parallel test lasts seconds.

## Run it yourself

```bash
pnpm stress            # browser scenarios + parallel server exports
```

| Env knob | Default | Meaning |
| --- | --- | --- |
| `STRESS_MINUTES` | `5` | Long-export timeline length (nightly can run 30+) |
| `STRESS_MIN_FPS` | `5` | Export throughput floor, in encoded fps |
| `STRESS_MAX_LAG_FRAMES` | `30` | Playback tracking tolerance (sized for software GL; tighten on real hardware) |
| `STRESS_PARALLEL` | `3` | Concurrent server exports |

Each run appends its numbers to `apps/playground/stress-results.json`; the nightly workflow uploads it as an artifact, so regressions show up as a diff between runs, not just a red X. The 4K benchmark runs when `apps/playground/public/e2e-4k.webm` exists (`stress/make-4k-fixture.sh` generates it).

## What the suite has caught

Both of these shipped as fixes before this page existed — listed so you know the gates bite:

- **Pipeline eviction blackout.** The pipeline cap (an engine default of 4 — a conservative allowance for hardware decoder instances, configurable via `MediaManager`'s `maxActivePipelines`, not a browser-imposed limit) evicts least-recently-used pipelines — and clips holding an evicted pipeline stayed black forever. Long multi-asset timelines, or timelines with 2+ transitions, could go permanently black. Clips now re-acquire on demand; eviction is invisible beyond a one-frame catch-up.
- **Unbounded GPU memory in software-GL exports.** Under SwiftShader/llvmpipe (headless CI, some VMs), Chromium's GPU process retains one shared-image per captured frame while a decoder and encoder run simultaneously — a 5-minute export grew to ~4 GB. `exportProject` now detects software WebGL and routes frame capture through a CPU path automatically (~300 MB flat); real GPUs keep the zero-copy path.

## Known ceilings

The two ceilings that made hour-long exports impractical — a whole-timeline audio mix (~1.4 GB of PCM per hour) and the encoded file accumulating in memory — are **lifted** as of the unreleased chunked-audio + streaming-export work: audio mixes in bounded chunks (`audioChunkSeconds`, default 60) and `exportProject({ target })` / server `out` stream the output as it encodes. The long-export stress scenario now runs with real audio on every clip and a streamed target, and settles at a **~2 MB heap spread** (29 MB peak) — export memory no longer scales with timeline length. What remains:

| Ceiling | Impact | Status |
| --- | --- | --- |
| Buffered exports (no `target`/`out`) hold the file | Budget roughly the output size, ~2× transiently for server calls returning `bytes` | By design for short outputs — pass `target` (browser) or `out` (server) for anything long |
| Pipeline cap: 4 simultaneous decoders (engine default) | More than 4 *concurrently visible* distinct assets round-robin decode; sequential timelines of any length are unaffected | Configurable via `maxActivePipelines`; concurrent-visibility churn beyond 4 is on the benchmark list above |
