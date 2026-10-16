# Miraiclip × Clueso/HyperFrames: working TODO

> **Session quick start (read only this file first).**
> 1. Find the first `[ ]` or `[~]` item in "Now". Read only the docs that item links to.
> 2. Background, only if needed: [clueso-hyperframes.md](clueso-hyperframes.md) (§ numbers below point into it).
> 3. When you finish an item: tick it, add a one-line entry to the Session log, commit. Keep this file under about 150 lines: move finished phases to "Done" as one line each.
>
> Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[?]` blocked on a decision · **P** = package, **C** = core change.

## Ground rules (don't relitigate)

- Core stays a pure document + command reducer: no I/O, providers, network or new globals (§4.2).
- New features = **planner** (pure `(doc, data) → Command[]`) + **contract** (interface) + **BYO-key adapter**. Cloud only implements contracts.
- Build from existing primitives first (keyframes, `html` clips, templates) before adding renderer code.
- Every feature must render the same in browser, worker and server export (parity rule from PLAN.md).
- Docs and both changelogs change with every step (house rule).

## Decisions

- [?] **D1 Licence**: SDK stays MIT/Apache with a paid cloud (this plan), or the paid SDK licence (`miraiclip-docs/plan/pricing-and-licensing.md`)? Recommended: open SDK + paid cloud. **Blocks** phase 5 pricing and the docs `/pricing` page.
- [ ] D2 Apache-2.0 vs MIT for new packages (Apache adds a patent grant; HyperFrames uses it).
- [ ] D3 Cloud stack: Cloud Run vs Lambda vs Fly for render workers; merchant of record (Polar already set up).

## Now: Phase 1, foundations (core, §4.4)

- [ ] C1 Clip time-remap: constant `speed` on video/audio clips + `clip/freeze` (freeze frame). Evaluator, renderer, audio and export parity; corpus cell for 2× and 0.5×.
- [ ] C2 `markers` entity + `marker/add|update|remove` commands (`{id, timeUs, label, data}`).
- [ ] C3 Effect `region` mask (keyframable rect, composition units) → redaction and spotlight.
- [ ] C4 `doc.plugins` manifest + loader in worker export, server harness and MCP (custom kinds render everywhere).
- [ ] C5 Idempotent or instance-scoped `register*Kind` (HMR + multi-tenant warm workers).
- [ ] C6 Fix blockers from `miraiclip-docs/plan/engine-issues.md`: custom `props` via `clip/set-property`, gesture begin/end, transitions surviving a zero-distance move.

## Next: Phase 2, agent surface (HyperFrames parity, cheap)

- [ ] P-skills Agent skills pack + Claude Code plugin (router + 5 workflows) on top of `@miraiclip/mcp`.
- [ ] P-registry `@miraiclip/registry` + `miraiclip add/catalog`: static JSON on GitHub Pages; seed 20 blocks (lower thirds, callouts, intros, cursor, captions styles).
- [ ] P-player `<miraiclip-player>` web component (live doc or MP4, chapters from markers).
- [ ] P-hf `@miraiclip/hyperframes`: import HF composition → doc (and export back); a fixture from their examples round-trips.
- [ ] POC-html **Scripted html clips** (start in parallel; highest risk): GSAP timeline seeked in a sandboxed iframe → DOM snapshot → foreignObject raster. Pass = frame-exact match vs headless capture on 3 GSAP + 1 Lottie samples. If it fails, fall back to server-only + HTML-in-Canvas. Then build `@miraiclip/html-runtime`.

## Phase 3: screencast vertical (Clueso parity)

- [ ] P-capture `@miraiclip/capture`: recorder (screen + mic + cam → streaming file) + event log (`CaptureSession` JSON, sensitive-field flags). `apps/capture-extension` reference.
- [ ] P-screencast planners: `planZooms`, `planCursor` (html cursor clip), `planClickEffects`, `planRedactions` (needs C3), `planCallouts`.
- [ ] P-transcript word model, `AsrProvider` (OpenAI Whisper, Deepgram), filler/silence → cuts, text-based editing (needs C1 for ripple).
- [ ] P-narration script rewrite (`ChatModel`), `TtsProvider` (ElevenLabs, OpenAI), `alignNarration` (needs C1, C2).
- [ ] P-guides steps → Markdown/HTML/JSON with stills (needs C2).
- [ ] Demo: React template "Record → product video + guide" flow at react.miraiclip.com.

## Phase 4: multipliers

- [ ] P-localize `Translator` contract + `localizeProject(doc, lang)` → variant docs (re-TTS + re-align).
- [ ] P-brand `BrandKit` + `applyBrand(doc, kit)`; intro/outro blocks from the registry.
- [ ] `AvatarProvider` contract only (HeyGen/D-ID adapters later; no core work).

## Phase 5: Miraiclip Cloud (paid; after contracts are stable)

- [ ] R1 **Measure render cost**: vCPU-seconds per output minute at 1080p30 and 4K30 using `pnpm stress` throughput; set the floor price (target ≤ $0.10/min at 1080p30, the HyperFrames benchmark).
- [ ] R2 `server-export` `renderDistributed` + `RenderRunner` contract; OSS runners: local pool, Lambda, Cloud Run. Corpus: chunked == single-pass (frames + A/V sync).
- [ ] R3 Hosted render API (stateless containers, scale to zero, signed asset URLs, short retention).
- [ ] R4 AI gateway: ASR/TTS/translate/LLM behind one key, metered; `@miraiclip/cloud` client implements the contracts.
- [ ] R5 Share pages + player CDN + view analytics.
- [?] R6 Pricing page update in miraiclip-docs (blocked on D1).

## Done

- [x] 2026-10-16 Competitive analysis + strategy (clueso-hyperframes.md).

## Session log (newest first, one line each)

- 2026-10-16: Wrote the analysis and this TODO. Next: decide D1, then start C1.
