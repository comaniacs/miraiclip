# Clueso + HyperFrames → Miraiclip: analysis and strategy

Status: proposal, 2026-10-16. Working checklist: [TODO.md](TODO.md) (read that first in a new session).
Market facts come from public listings and reviews, checked 2026-10-16. Prices conflict between sources; confirm them before quoting publicly.

---

## 1. Clueso: what it sells and why people pay

**What it is:** a closed SaaS that turns a rough screen recording into a polished product video **and** a written help article, in many languages. You record with the Chrome extension or desktop app; the AI does the post-production.

| Capability | What it does |
| --- | --- |
| Capture | Chrome extension and desktop recorder: screen, mic and webcam, plus **click and cursor events** |
| Script rewrite | Transcribes your narration, removes "um" and rambling, and rewrites it as a clean script |
| AI voiceover | Replaces your voice with a studio TTS voice synced to the video (voice cloning on higher tiers) |
| Auto-zoom | Zooms in on clicks and typing using the recorded events |
| Cleanup | Removes filler words and silences, adds captions and background music |
| Brand | Templates, intro and outro, colours, logo; avatars and motion graphics on higher tiers |
| Docs | A step-by-step article with a screenshot per click, generated from the same recording |
| Localisation | One click to 35+ languages: voiceover, captions, and the article |
| Distribution | Share links, embeds, help-centre and YouTube publishing; SOC 2 Type II and ISO 27001 |
| Pricing | Free tier, then about $40/mo (Solo, annual) to $120–150/mo (Business/Starter) to Enterprise. Seat-based, with export and AI caps |

**Why customers pay:** it replaces **labour**, not software. One recording replaces a video editor, a voice actor, a translator and a technical writer. The buyers are PMs, customer success, enablement and docs teams, who are not video people. The value is time-to-video, consistent branding, and fast re-records when the UI changes.

**Weak spots (from reviews):** voice and video sync often needs manual fixing; AI narration can sound unnatural; zoom placement sometimes needs fixing; export capacity expires; it's closed and can't be embedded in your own product (no SDK).

---

## 2. HyperFrames: what it offers and why people pay

**What it is:** HeyGen's open-source (Apache-2.0, about 65k stars) "video as HTML" framework. A composition is an HTML file; timing comes from data attributes (`data-start`, `data-duration`, `data-track-index`). Headless Chrome seeks each frame and FFmpeg encodes. It's built for **AI agents**.

| Capability | What it does |
| --- | --- |
| Composition model | Plain HTML/CSS with no build step; `index.html` plays in a browser |
| Animation adapters | GSAP, Lottie, Three.js, Anime.js, CSS, WAAPI and custom: anything **seekable** (paused timelines registered on `window.__timelines`) |
| Deterministic render | Seek, capture, encode; same input gives the same output; usable in CI |
| Agent tooling | Non-interactive CLI, linter, **21 agent skills** (a `/hyperframes` router plus workflows: product launch, explainer, PR-to-video, captions, music-to-video) |
| Registry | `hyperframes add` / `catalog`: 50+ ready-made blocks |
| Packages | `@hyperframes/core`, `engine`, `producer`, `studio` (scoped timeline editor), `player` (web component), `shader-transitions`, `aws-lambda` |
| Scale | Self-hosted AWS Lambda or Cloud Run, or HeyGen-hosted `cloud render` |
| Pricing | Framework free. HeyGen cloud render is about **$0.10/min at 1080p30**, up to about $0.30/min at 4K60 |

**Why people "pay":** the framework is a funnel. LLMs already write excellent HTML, CSS and GSAP, so HyperFrames gets the best agent-generated motion graphics with almost no learning curve. HeyGen earns on **managed rendering** (per minute, parallel, no Chrome/FFmpeg/AWS ops) and on HeyGen API credits (avatars, TTS).

**Weak spots:** it's not a real editor (Studio is a scoped timeline); there's no command model, structured undo or collaboration (agents edit by rewriting code); rendering is server-only screenshot capture (slow, needs infrastructure); and there's no in-browser WebCodecs export.

---

## 3. Where Miraiclip already stands

| Area | Clueso | HyperFrames | Miraiclip today |
| --- | --- | --- | --- |
| Structured edits, undo, patches | n/a (closed) | ✗ (code edits) | ✅ commands, history, JSON patches |
| Agent interface | ✗ | ✅ CLI and skills | ✅ catalog tools, MCP, assistant. **No skills pack** |
| HTML overlays | ✗ | ✅ any runtime | ⚠️ `html` clip: CSS animations only, no scripts (foreignObject raster) |
| Browser export (free compute) | ✗ | ✗ | ✅ WebCodecs, worker |
| Server export | cloud | ✅ Chrome+FFmpeg | ✅ same pipeline in headless Chrome. **No distributed/chunked render** |
| Templates and batch | brand templates | registry blocks | ✅ `@miraiclip/templates`. **No block registry** |
| Captions | ✅ | ✅ | ✅ karaoke, SRT/VTT, ASR word import |
| TTS / audio generation | ✅ | via HeyGen | ⚠️ `audio-sources` (ElevenLabs SFX/music); **no narration pipeline** |
| Screen capture and events | ✅ core product | ✗ | ✗ |
| Auto-zoom, cursor | ✅ | ✗ | ⚠️ primitives exist (transform keyframes, html clips); no planner |
| Filler and silence cuts | ✅ | ✗ | ⚠️ no transcript model |
| Voice ↔ video alignment | ✅ (weak) | ✗ | ✗ **needs clip speed / freeze frame in core** |
| Guide/article generation | ✅ | ✗ | ✗ (`renderProjectStill` exists for screenshots) |
| Localisation | ✅ 35+ languages | ✗ | ✗ |
| Region blur / redaction | ✅ | ✗ | ⚠️ 79 whole-frame effects; **no masked region** |
| Embeddable player | share links | ✅ web component | ⚠️ React components only |

**Core gaps found in code:** no `speed`/time-remap or freeze-frame on clips, no markers/chapters entity, no effect region mask, module-global kind registries that throw on re-register (bad for HMR and for warm multi-tenant render workers), and custom clip kinds that the server harness can't load. See also `miraiclip-docs/plan/engine-issues.md`.

---

## 4. Strategy: best of both, open source, paid cloud

### 4.1 Positioning

> **Miraiclip: the open-source engine for Clueso-style product videos and HyperFrames-style agent videos, in one editable document. Export free in the browser; pay only when you use our cloud.**

- From **HyperFrames**, take: HTML as a first-class authoring surface for agents, seekable animation adapters, the block registry, agent skills, the player web component, and distributed rendering.
- From **Clueso**, take: the capture → auto-edit → narrate → document → localise pipeline, as **open planners**, not a closed app.
- Miraiclip's own edge: commands, undo, collaboration, a real editor (React kit) and **free client-side export**. Neither competitor has all of these.

### 4.2 The architecture rule: keeping core stateless

Every new feature is split into four layers. Only the last one costs us money to run.

```
 1. core            pure document + command reducer. No I/O, no network, no providers, no globals.
 2. planners (OSS)  pure functions: (doc, data) → Command[]. Deterministic, unit-tested, no network.
                    e.g. planZooms(events) → keyframe commands, planCuts(transcript) → clip/trim commands
 3. contracts (OSS) provider interfaces + BYO-key adapters: AsrProvider, TtsProvider, Translator,
                    AvatarProvider, RenderRunner, ChatModel (exists). Users pay their vendor directly.
 4. cloud (paid)    Miraiclip Cloud implements the same contracts behind one API key:
                    managed render, ASR, TTS, translation, storage, share pages. Metered.
```

Rules that keep this honest:

- **The document is self-describing.** A doc that uses a plugin kind declares it (`doc.plugins: [{ name, version, url, integrity }]`), so any renderer (browser, worker, server harness, MCP, cloud) can load it. A render job is then just `(doc JSON + asset URLs)`, which is a stateless job.
- **Build new features from existing primitives first.** Auto-zoom = transform keyframes on the video clip. Cursor and click ripple = `html` clips with keyframed position. Callouts = `html` clips. This adds no renderer code and gets server and worker export parity for free.
- **No vendor SDKs in core or planners.** Vendors appear only in adapter packages, the way `audio-sources` already works.
- **Registries become instance-scoped or idempotent**, so one warm server browser can render jobs from many tenants without leaking state.

### 4.3 New packages (all OSS)

| Package | Source of the idea | Contents |
| --- | --- | --- |
| `@miraiclip/capture` | Clueso | Browser recorder (`getDisplayMedia` + mic + cam → mediabunny streaming file) **plus an interaction event log** (clicks, keys, scroll, cursor path, target selector and label, sensitive-field flags). Output: assets + a `CaptureSession` JSON. Reference Chrome extension in `apps/capture-extension`. |
| `@miraiclip/screencast` | Clueso | Pure planners over a `CaptureSession`: `planZooms`, `planCursor` (smoothed path → html cursor clip keyframes), `planClickEffects`, `planRedactions` (sensitive fields from the DOM, no ML needed), `planCallouts`. Returns `Command[]`; the user can edit or undo every result. |
| `@miraiclip/transcript` | Clueso | Word-level transcript model, `AsrProvider` contract (Whisper/OpenAI, Deepgram adapters), filler/silence detection → cut commands, **text-based editing** (delete words → ripple cuts), and captions from the transcript. |
| `@miraiclip/narration` | Clueso | Script rewrite via `ChatModel`, `TtsProvider` contract (ElevenLabs, OpenAI adapters), and **`alignNarration`**: a deterministic planner that fits each voice segment to its video step (freeze frame, speed change or gap), so you can see and fix the sync. That fixes Clueso's most-reviewed weakness. |
| `@miraiclip/guides` | Clueso | Steps from capture events + transcript + `renderProjectStill` screenshots → Markdown, HTML or JSON, with an annotation overlay. Stateless; the output is a file. |
| `@miraiclip/localize` | Clueso | `Translator` contract; `localizeProject(doc, lang)` translates text, captions and html params, re-runs TTS and alignment, and emits per-language variant docs (reusing the templates machinery). |
| `@miraiclip/brand` | Clueso | `BrandKit` schema (colours, fonts, logo, caption style, intro/outro blocks) and `applyBrand(doc, kit)` → commands. |
| `@miraiclip/html-runtime` | HyperFrames | **Scripted html clips**: a seekable frame-adapter protocol (GSAP, Lottie, anime.js, WAAPI, Three.js), run in a sandboxed iframe. Server: real DOM capture in the existing harness. Browser: *seek → serialise DOM snapshot → foreignObject raster* (canvas/WebGL children inlined as images), then the native HTML-in-Canvas API when it is available. **Needs a POC first.** |
| `@miraiclip/hyperframes` | HyperFrames | Interop: import a HyperFrames composition (data attributes → tracks/clips/html clips) and export a doc back to HyperFrames HTML. Lets their users and agents adopt Miraiclip's editor without rewriting. Apache-2.0 → keep NOTICE if any code is reused. |
| `@miraiclip/registry` + `miraiclip add` | HyperFrames | shadcn-style block registry: html templates + template fields + a preview video, as static JSON on GitHub Pages (costs nothing to host). Blocks: lower thirds, callouts, intros, charts, cursors, captions styles. |
| `@miraiclip/player` | HyperFrames | `<miraiclip-player>` web component: plays a doc live (renderer) or a rendered MP4, with chapters from markers. Framework-free embed. |
| Agent skills pack | HyperFrames | Claude Code plugin + `npx skills add comaniacs/miraiclip`: a router skill + workflows (product demo from recording, explainer, PR-to-video, captions, localise), built on MCP. |
| `server-export` distributed mode | HyperFrames | `renderDistributed(doc, { chunks, runner })`: keyframe-aligned frame-range chunks + one audio mix, concatenated with an FFmpeg stream copy. `RenderRunner` contract with OSS runners: local pool, AWS Lambda, Cloud Run. |
| `@miraiclip/cloud` | — | Thin client: implements every contract above against Miraiclip Cloud with one API key. The only package that calls our servers. |

### 4.4 Core changes these packages need (kept minimal, all pure)

1. **Clip time-remap:** `speed` (constant first) and a `freeze` clip/command. Needed by `alignNarration` and text-based editing.
2. **Markers:** a generic `markers` entity `{ id, timeUs, label, data }` with commands. Used for steps, chapters and guide sections.
3. **Effect region mask:** an optional `region` (keyframable rect) on any effect. That gives redaction (blur/pixelate) and spotlight.
4. **Self-describing plugins:** a `doc.plugins` manifest + harness/worker loader, so custom kinds render everywhere.
5. **Registry hygiene:** idempotent or instance-scoped `register*Kind` (also fixes HMR).
6. Close the existing engine issues that block these: custom-props editing via `clip/set-property`, a gesture API (begin/end), and transitions surviving a zero-distance move.

### 4.5 Money: open source SDK, paid cloud

**Decision needed (D1).** `miraiclip-docs/plan/pricing-and-licensing.md` proposes moving the SDK from MIT to a paid source-available licence. This request asks for **open source + paid cloud**. The two conflict. Recommendation: **keep the SDK MIT** (or move to Apache-2.0 for the patent grant, matching HyperFrames) and earn from:

| Revenue line | Why it works |
| --- | --- |
| **Managed render** (per output minute) | Browser export is free and unlimited, so cloud render is only for batch, API, agents and headless jobs. Benchmarks: HyperFrames about $0.10/min at 1080p30; Shotstack about $0.10–0.16/min. Set our price from **measured** cost (see TODO R1), aiming at or under $0.10/min. |
| **AI gateway** (ASR, TTS, translation, LLM) | One key instead of four vendor accounts. Cost plus margin, with an included free monthly allowance. BYO-key stays free in OSS. |
| **Storage + share pages + player CDN** | The Clueso distribution layer: hosted links, embeds, view analytics. |
| **Workspace** (later) | Team libraries, brand kits, review comments, built on commands + patches. |
| Editor UI kit ($199, existing) + Enterprise | Support, SLA, OEM/white-label, SSO, DPA. |

**Cost guardrails:** every cloud feature has an OSS self-host path (Lambda/Cloud Run runner, BYO-key adapters), so free users never cost us compute. The free cloud tier is capped in minutes; jobs are stateless containers that scale to zero; assets are referenced by URL with short retention unless the user pays for storage.

### 4.6 Build order (why this order)

1. **Foundations** (core changes + plugin manifest): everything else depends on them.
2. **Agent surface** (skills pack, registry, player, HyperFrames import): cheap, fast adoption, and it reuses what exists.
3. **Screencast vertical** (capture → screencast → transcript → narration → guides): the Clueso-shaped demo that sells.
4. **Scripted html runtime** (GSAP/Lottie): highest technical risk, so it starts as a POC in parallel with phase 2.
5. **Cloud** (distributed render → AI gateway → share pages): only after the OSS contracts are stable, so the cloud implements contracts rather than defining them.
6. **Localisation and brand**: multipliers on top of the vertical.

## Sources

- Clueso: [Trainn overview](https://trainn.co/blog/what-is-clueso/), [Clueso screen recorder page](https://www.clueso.io/features/screen-recorder), [G2 reviews](https://www.g2.com/products/clueso/reviews), [Glitter alternatives](https://www.glitter.io/blog/process-documentation/best-clueso-alternatives), [CB Insights](https://www.cbinsights.com/company/clueso), [DevToolLab](https://devtoollab.com/ai-tools/clueso)
- HyperFrames: [GitHub repo](https://github.com/heygen-com/hyperframes), [HeyGen docs overview](https://developers.heygen.com/hyperframes-overview), [CLI docs](https://hyperframes.heygen.com/packages/cli), [cloud render price post](https://x.com/Miguel07Code/status/2081492432693154158), [G2 HeyGen API pricing](https://www.g2.com/articles/heygen-api-pricing), [Menon Lab write-up](https://themenonlab.blog/blog/heygen-hyperframes-video-as-code)
