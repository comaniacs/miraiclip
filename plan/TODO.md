# Miraiclip v6: working TODO

> **Session quick start (read only this file first).**
> 1. Find the first `[ ]` or `[~]` item. Read only the docs that item links to.
> 2. When you finish an item: tick it, update the roadmap table (`docs/content/docs/roadmap.md`, v6), add a one-line entry to the Session log. Keep this file under about 150 lines.
> 3. Public text (docs, changelogs, READMEs, code) names no other products as models for features.
>
> Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[?]` blocked on a decision.

## Progress (2026-10-17)

**21 of 32 items ticked off.** 21 of 26 build items are done; the 3 decisions and the 3 release steps are open.

| Section | Done |
| --- | --- |
| Decisions (D1–D3) | 0 / 3 |
| Phase 1: foundations | 6 / 6 |
| Phase 2: agent surface | 5 / 5 |
| Phase 3: screen recordings | 5 / 6 (demo left) |
| Phase 4: multipliers | 3 / 3 |
| Phase 5: cloud | 2 / 6 (R3–R6 blocked on D1/D3) |
| Release checklist | 0 / 3 (docs mirror in progress) |

## Ground rules (don't relitigate)

- Core stays a pure document + command reducer: no I/O, providers, network or new globals.
- New features = **planner** (pure `(doc, data) → Command[]`) + **contract** (interface) + **bring-your-own-key adapter**. The cloud only implements contracts.
- Build from existing primitives first (keyframes, `html` clips, registry blocks, effect regions) before adding renderer code.
- Every feature renders the same in browser, worker and server export.
- Docs and both changelogs change with every step.

## Decisions

- [?] **D1 Licence**: SDK stays MIT/Apache with a paid cloud, or the paid SDK licence (`miraiclip-docs/plan/pricing-and-licensing.md`)? Recommended: open SDK + paid cloud. **Blocks** R6 (pricing page).
- [ ] D2 Apache-2.0 vs MIT for new packages (Apache adds a patent grant). New packages are MIT for now.
- [?] D3 Cloud stack: Cloud Run vs Lambda vs Fly for render workers; merchant of record (Polar already set up). **Blocks** R3–R5. Input: [render-cost.md](render-cost.md).

## Phase 1: foundations (core) — done

- [x] C1 Clip speed + `clip/freeze`, parity everywhere, corpus cells.
- [x] C2 `markers` + `marker/add|update|remove`.
- [x] C3 Effect `region` mask (keyframable, clip-frame fractions).
- [x] C4 `doc.plugins` manifest + loaders (worker export, server harness, MCP).
- [x] C5 Idempotent / replaceable `register*Kind`.
- [x] C6 Engine fixes: custom `props` via `clip/set-property`, gestures, transitions surviving no-op moves.

## Phase 2: agent surface — done

- [x] P-skills: skills pack + Claude Code plugin (router + workflows incl. `screen-tutorial`, which now uses the planners).
- [x] P-registry: `@miraiclip/registry` + `miraiclip add/catalog/build`, 21 blocks.
- [x] P-player: `<miraiclip-player>` (`@miraiclip/player`).
- [x] P-interop: `@miraiclip/html-composition` (import/export data-attribute HTML compositions).
- [x] Scripted html clips (GSAP, Lottie, anime.js, WAAPI): sandboxed frame, seek, DOM snapshot. Lives in the renderer (no separate runtime package needed). POC gate passes (3 GSAP + 1 Lottie frame-exact).

## Phase 3: screen recordings → product videos

- [x] P-capture: `@miraiclip/capture` (recorder, event log, `sessionCommands`) + `apps/capture-extension`.
- [x] P-screencast: `planZooms`, `planCursor`, `planClickEffects`, `planRedactions`, `planCallouts`, `planScreencast`.
- [x] P-transcript: word model, `AsrProvider` (OpenAI, Deepgram) + handler/proxy, fillers/stutters/silences, ripple cuts, text-based editing, captions after cuts.
- [x] P-narration: scripts, `rewriteScript` (any chat model), `synthesizeNarration` (any voice generator; `openAiSpeechGenerator` added to audio-sources), `alignNarration`.
- [x] P-guides: steps + annotated stills → Markdown / HTML / JSON.
- [ ] Demo: React template "Record → product video + guide" flow at react.miraiclip.com (needs the `miraiclip-react-template` repo; not in this checkout).

## Phase 4: multipliers — done

- [x] P-localize: `Translator` (chat model, DeepL) + `localizeProject` / `localizeMany`.
- [x] P-brand: `BrandKit` + `applyBrand`.
- [x] `AvatarProvider` contract + `avatarCommands` (in narration). Vendor adapters later.

## Phase 5: Miraiclip Cloud (paid; after contracts are stable)

- [x] R1 Render cost measured (`pnpm --filter @miraiclip/server-export bench:cost`): see [render-cost.md](render-cost.md).
- [x] R2 `renderDistributed` + `RenderRunner` (local pool, HTTP workers) + `createRenderJobHandler` + `examples/render-worker`. Chunked == single pass (frame count, bit-identical audio, PSNR > 35 dB).
- [?] R3 Hosted render API (stateless containers, scale to zero, signed asset URLs, short retention). Blocked on D3.
- [?] R4 AI gateway: ASR/TTS/translate/LLM behind one key, metered; `@miraiclip/cloud` client implements the contracts. Blocked on D3.
- [?] R5 Share pages + player CDN + view analytics. Blocked on D3.
- [?] R6 Pricing page update in miraiclip-docs. Blocked on D1.

## Release checklist (next)

- [ ] Changesets for every touched package (see CHANGELOG "Unreleased"), then release.
- [~] miraiclip-docs: mirror the v6 roadmap and add pages for the new packages. Roadmap mirrored at `/roadmap` (moved out of Reference, first link in the sidebar); pages for registry, player, html-composition, localize, brand and distributed rendering still to write.
- [ ] Re-run `bench:cost` with Google Chrome (H.264) on the chosen worker type.

## Session log (newest first, one line each)

- 2026-10-17: Docs roadmap moved to `/roadmap` (sidebar link above Pricing) and rewritten as available today / built for next release / coming next; progress table added here (21/32).
- 2026-10-17: Finished capture; built screencast, transcript, narration, guides, localize, brand, avatar contract, distributed rendering, cost benchmark; fixed scripted html seeks in hidden frames; roadmap v6 table. Next: demo in the React template, decide D1/D3.
- 2026-10-16: C1–C6, skills, registry, player, HTML composition interop, scripted html clips.
