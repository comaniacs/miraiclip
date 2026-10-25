# Sequences: motion graphics, not slideshows

Working notes for the sequences plan, approved 2026-10-25. The plan has seven phases:

- 0: spikes;
- 1: sequences;
- 2: skills by job;
- 3: motion metrics;
- 4: direction and approval;
- 5: music first;
- 6: restructure;
- 7: models and evals.

Public text (docs, skills, changelogs) names no other products as models for features.

## Phase 0 results (2026-10-25)

### 0.5 Licence: GSAP is out

GSAP's standard "no charge" licence (2025, Webflow) allows use on any website or app, but lists as a **prohibited use** "any implementation and/or use of GSAP Products in tools that allow users to build visual animations without code", and anything that materially assists a solution competing with Webflow's visual animation building.

A video editor whose users (and assistant) build animations without code is exactly that. We can't bundle GSAP in the SDK, the template or the hosted demo, and the skills must not tell models to use it.

**Decision:** sequences run on **anime.js v4** (MIT), behind our own stage kit, with CSS keyframes as the fallback. Motion One (`motion`, MIT) is the alternative if anime.js falls short. The kit's API is ours, so the engine can change without changing what models write.

### 0.1 Performance

Test case: a 20 s choreography, 29 elements (8 glowing orbs, 15 words, 6 glass cards with backdrop blur), 87 tweens plus a camera move. Rendered through the renderer's own `rasterizeHtml` in headless Chromium (SwiftShader, no GPU); ms per frame after warm-up, 40 consecutive frames:

| Path | 1920×1080 | 960×540 (preview) | 192×108 (metrics sample) |
|---|---|---|---|
| CSS keyframes (non-scripted) | 39 ms (≈26 fps) | 10 ms | 13 ms |
| anime.js v4 timeline (scripted clip, seek from 0) | 15 ms (≈65 fps) | 14 ms | 9 ms |

**Decision:** both paths are fast enough for preview and export. Scripted timelines are the default for sequences; CSS keyframes stay for single moments. The first frame of a new scripted template costs about 80–110 ms (frame load).

### 0.2 Determinism

| Seek strategy | Frames identical across forward, backward and cold random-order renders |
|---|---|
| CSS keyframes | 10/10 |
| anime.js timeline seeked directly (`__anime`) | 3/10: backward seeks leave state from overlapping tweens, and the first frame differs |
| anime.js, seek to 0 then to t | 9/10: only a cold first frame differs |
| anime.js, seek to 0 then to t, plus one warm-up seek (end → 0) on first use | **10/10** |

**Decision:** the stage kit installs `window.__miraiclipSeek(t)`, which does a warm-up on first call, then `seek(0)` and `seek(t)` every frame. Authors never register timelines themselves.

### 0.3 Fonts in the frame

A project font (Bebas Neue, 120 px, "WIDTH CHECK") measured by a script inside the scripted frame came out at **837 px**; the true width is **487 px**. The frame had no @font-face, so the script measured a fallback font.

With the font's @font-face injected into the frame document, it measured **487 px**, exact.

**Decision (1.2):** inject `fontFaceCss` into the frame document, and build timelines only after `document.fonts.ready`.

### 0.4 Server export parity

`@miraiclip/server-export` runs the same `exportProject` in a headless Chrome harness page (`src/harness/main.ts`). Scripted clips therefore run in the same sandboxed frames, so parity holds by construction.

**Requirement (1.1):** the harness registers the same libraries (anime.js, the stage kit) as the editor. Library code is injected inline into the frame document, so no network is needed. To verify with a real server export in phase 1.

### 0.6 Breakdown

`plugins/miraiclip/skills/motion/reference/breakdowns/typed-ui-launch.md`: 14 beats in 13.4 s, with the carry-over at every change, hidden cuts, camera and look. It doubles as the calibration reference for motion metrics.

### Motion metrics: first calibration

192×108 greyscale, 10 fps, mean absolute change between consecutive frames (0–255). A step counts as moving above 0.6. A hold is more than 0.8 s without movement. A jump is a step over 18 with neighbours under a third of it.

| Film | Density | Median change | Holds > 0.8 s | Jumps |
|---|---|---|---|---|
| Reference typed-UI launch (13.4 s) | **0.99** | **3.5** | 0 | 0 |
| Assistant "orbs" HighLevel film (23.5 s) | 0.63 | 0.76 | 5 | 0 |
| Assistant NASA film (90 s) | 0.32 | 0.45 | 17 | 0 |

**Starting thresholds** for motion-graphics briefs:

- density ≥ 0.85;
- median change ≥ 1.5;
- no hold over 0.8 s except a final end-card hold of up to 1.5 s.

Documentary-paced films get lower targets, set with the eval set in phase 7.

## Stage kit: API sketch (for 1.3)

The template's root carries `data-libs="stage"`; the renderer injects anime.js and the kit. The author writes:

```html
<div class="stage">…markup…</div>
<script>
stage.build((tl, S) => {
  tl.label("hook", 0)
    .from(".word", { y: S.h(6), opacity: 0, blur: 1.2, duration: 0.6, stagger: 0.08, ease: "expo.out" }, "hook")
    .to(".orb", { x: (i) => S.w(10 * i - 30), scale: 1.4, duration: 1.2, ease: "inOut" }, "hook+=0.4")
    .camera({ zoom: 1.15, tilt: -6, duration: 2.5 }, "<");
});
</script>
```

- Times are seconds, and positions accept labels and `<` / `>` / `+=`.
- Sizes come through `S.w/h/min`.
- `blur` maps to filter.
- `stagger`, `ease` and `duration` work as you'd expect.
- `stage` creates the anime timeline, installs the deterministic seek hook (0.2), waits for fonts (0.3), checks that the length matches the clip, and exposes `S.rand(seed)`, `S.beats` (from params), `S.camera` and the actor handoff state.

## Phase 1 results (2026-10-25)

What shipped:

- **1.1–1.3 Renderer.** Scripted libraries (`registerScriptedLibraries`, `data-libs`) are injected inline into the frame in dependency order. The stage kit (`src/stage/kit.js`, bundled with anime.js 4.5 by `scripts/bundle-stage.mjs`) is registered by `registerStageKit()`, and the server-export harness registers it too.
- **1.4 `lintSequence(template)`.** Errors are anything that breaks determinism or sizing:
  - randomness, the clock, timers, network, infinite loops, the owned seek hooks, GSAP;
  - viewport units, `position: fixed`, a missing `data-libs`, a missing duration, more than one build.

  Warnings: direct anime.js calls, pixel literals.
- **1.5 `compose_sequence` (template).** One act is one scripted html clip on the scenes track. The tool:
  - wraps the act in the film's tokens;
  - lints it;
  - runs it once at t = 0 (a script error or an overlong timeline is refused with its message);
  - records the measured beats on the stage root (`data-beat-labels`);
  - places it with a 0.3 s dissolve, or a cut or a dip;
  - returns a filmstrip (6–10 frames, one image), layout problems 0.9 s after each beat, and notes (timeline ends early, too few beats, static camera).

  It is offered only when the renderer has the stage kit (feature-detected in `src/engine/stage.ts`), so the template still runs on renderer 0.9.
- **1.6 Beat markers.** Sequence clips show their act name and a tick at each beat on the timeline.
- **1.7 Params.** A sequence's `{{params}}` are fields in the Text panel ("Sequence · <act>"). "Edit code" is hidden for scripted clips, because the code dialog re-serializes markup as XHTML (which would escape `<` in the script) and previews without scripts. Code editing for sequences is a phase 6 item.

Verified in the studio (scripted assistant run, renderer built from source):

- the lint refusal (`Math.random`);
- the script error naming the bad label;
- the overlong timeline refused;
- two acts placed with beats `{drift 0, collide 3, reveal 4.6}` and `{unfold 0, cta 2.8}`;
- the filmstrips render through the kit (camera tilt, blur-ins);
- the live compositor plays the act;
- the inspector edits the act's words.

Releases needed: renderer (scripted libraries, stage kit, lint) as 0.10, then the template's renderer dependency.

## Phase 2 results (2026-10-25)

The skills are now split by job. Each is an EDITOR.md, bundled into the assistant:

- **`direction`:** brief → treatment. It covers:
  - the world;
  - the protagonist element and its chain of transformations;
  - acts and a timed beat sheet, with a technique and a carry-over per beat;
  - at most about 7 words per beat;
  - the look, camera and music direction;
  - arcs by format;
  - which breakdown to borrow from, cited by technique.

  `reference/treatment.md` is a blank treatment plus a worked example.
- **`look`:** the palette, type, finish, frame, grid and picture treatments, moved out of make-film. `reference/scenes.md` is the still-scene craft for design_scene (the old make-film `design.md`, without the frame and picture sections).
- **`media-sound`:** find or generate pictures, and their rights; music chosen first (mood, tempo, act lengths in phrases); sound effects on moves (at most one per beat); mix levels. The beat grid (`S.beats`) is described as arriving when music is measured (phase 5).
- **`sequence-core`:** the compose_sequence contract:
  - the `tl` API, positions, eases, the camera and `S`;
  - the `.world` / `.hud` layers and params;
  - every lint rule with what to do instead;
  - the gotchas (the timeline owns `transform`; `from` animates to the CSS state; tweens need hex colours);
  - the hand-off between acts.
- **`motion`:** the grammar, plus 32 atomic techniques (`reference/rules/*.md`, each with what/when/timing/mistake and a working snippet), `continuity.md`, `timing.md` and `camera.md`. Five breakdowns:
  - typed-UI launch (measured);
  - editorial explainer;
  - kinetic-type promo;
  - documentary trailer;
  - playful shapes.

  The last four are grammar studies of a style, not of a particular film.
- **`make-film`:** now a recipe: read the brief → direct → look and plan → material → build (motion-graphics acts, or designed scenes for still-based documentaries) → check. It loads the skills above at each step.

Tests:

- `motion-rules.test.ts`: every technique lints clean with no warnings and runs through the real kit in jsdom. Every technique cited by the breakdowns and the direction skill exists.
- `sequence-core-doc.test.ts`: every `tl` method and `S` helper in the kit is documented and vice versa, and every lint rule id is listed.
- `stage-kit.test.ts`: `S.split` keeps child elements; `steps(n)` easing.

Kit changes:

- `S.split` keeps child elements (an `<em>` keeps its words, split inside it);
- `ease: "steps(n)"` maps to anime's `steps`.

Template changes:

- compose_sequence refuses design_scene's CSS animation classes (`k-rise`, `k-pop`…), and its guide allows a `.hud` layer and points to the skills;
- plan_film's rules point to compose_sequence (with the hex values tweens need) when the stage kit is there, except for documentaries;
- the assistant's film instruction routes through make-film's skills.

Verified in the studio:

- load_skill sequence-core;
- read_skill_file for a motion rule and a breakdown;
- plan_film's sequence rules;
- the `k-pop` refusal;
- the earlier compose_sequence checks.

Open notes for later phases:

- The kit can't run callbacks (`onRender` is filtered out), so a count-up uses digit reels.
- plan_film still returns the library `grammar` and `scenes` list (phase 6).

## Phase 3 results (2026-10-25)

What shipped:

- **3.2 Metrics (renderer, `src/metrics/motion.ts`, exported).**
  - `lumaFrame`: RGBA → limited-range luma, matching decoded video so the thresholds transfer.
  - `frameChange` and `changeSeries`.
  - `motionMetrics(changes, fps, { endHoldSeconds, offsetSeconds })` → density, median change, holds with times, and jumps.
  - `motionFindings(report, targets)`.
  - `MOTION_TARGETS`: motion (density ≥ 0.85, median change ≥ 1.5, holds ≤ 0.8 s) and documentary (≥ 0.6, ≥ 0.6, ≤ 2 s).
- **Fixtures** (`test/fixtures/motion/`): recorded series of three slide-like films the assistant made before sequences: the course film, the environment film and the NASA film. All fail the motion targets. The NASA film reproduces its earlier calibration (0.32 / 0.45). Your reference launch film and the orbs film weren't in the workspace any more; add them as fixtures when re-attached (the launch film must pass, the orbs film must fail).
- **3.1 Sampler (template, `motionSampler.ts`).** It renders an html clip at 192 px and 10 fps through `rasterizeHtml` and caches per template. A 20 s act takes under 10 s for the whole compose_sequence call, filmstrip and beat checks included.
  - **Cross-check:** the orbs act measured the same through the sampler as through live-page screenshots measured with the original ffmpeg prototype: 0.41 vs 0.42 density, 0.46 median change in both, and the same holds.
- **3.3 Wiring.**
  - compose_sequence returns a `motion` line ("95% of the act moves, median change 1.6 per frame, still 4.8–5.7 s"). Every finding goes into `problems`, each with its fix.
  - It also checks words on screen 0.9 s after each beat: at most 7 (25 for documentaries), and a reading budget of 3.5 words/s + 0.5 s for each beat's new words.
  - `preview_film` measures the whole film. It samples clips in order and joins them, maps times back to the film, and doesn't count joins as jumps. It returns `motion`, `motionProblems` and the `stillest` acts.
  - `motion/reference/timing.md` has a table: finding → what it means → fix.
- **Acceptance (studio, scripted).**
  - A static act was flagged: 6% moving, still 1.3–7.9 s, with fixes.
  - The rewritten act passed: 95% moving, median change 1.6, no holds or jumps.
  - The original spike orbs act fails honestly (41%, three holds). It drifts too slowly to read as motion.

**Found on the way: a GPU raster artifact.** A large `filter: blur()` layer under the camera's 3D tilt renders with tile-shaped artifacts through the SVG-foreignObject raster when Chromium rasterizes on the GPU. It is reproduced here with SwiftShader GL; the plain software path is clean. Either the 3D tilt or the big blur alone is fine. CSS workarounds (isolation, will-change, flat transform style, translateZ) don't help. A software canvas fixes it, but costs about 139 ms per 1080p frame, against about 7 ms on the GPU.

- `rasterizeHtml({ software: true })`: a CPU raster, used by the sampler and the filmstrips (cheap at small sizes), so metrics and previews are exact.
- Lint warning `big-blur` (a large layer with `filter: blur`). The sequence-core and look skills say to make glows with radial gradients.
- **To check:** whether real GPUs (macOS Chrome) show the artifact in the editor's preview and export. If they do, use the software raster for clips that combine a 3D camera with a large blur, or flatten the tilt.

## Phase 4 results (2026-10-25): direction and approval

- **4.1 `direct_film` (template).** It records the treatment in the film session:
  - the world, the promise, the protagonist chain, the camera, the music (mood, tempo);
  - acts, and beats with time, words, what moves, technique and carry-over.

  It refuses an invalid treatment with one fix per problem:
  - acts and beats must follow each other with no gaps;
  - beats run at most 3 s (8 s in a documentary);
  - at most 7 words on screen (25 in a documentary), with a reading budget;
  - techniques must exist in the motion skill (read from the bundled skill);
  - every beat needs a carry-over or a hidden cut (blur-through, zoom-through, whip-pan, match-cut, wipe, zoom-out-reveal);
  - the protagonist chain has at least 2 links;
  - the length is within 10% of what was asked.

  With a tempo, it warns about beats off the half-beat grid.
- **4.2 Storyboard.** A card per key beat (up to 8) in the film's colours and type: the act and time, the words, what moves, the technique → the carry-over. The SDK's `tool-end` event now carries the tool's `images`, and the Assistant panel shows the storyboard (and `preview_film`'s sheet) in the reply.
- **4.3 Approval.** Unless the request says to just make it, the treatment is "proposed" and `compose_sequence` refuses until it's approved. The panel shows **Approve & build** and **Change direction** (which pre-fills "Change the direction: "). An approval is a short message that starts with an approval phrase and asks for no change.
- **4.4 Recipes.**
  - `launch-video` is now a thin recipe: brand first, the launch arc, defaults, and library scenes as blueprints.
  - `make-film` follows direct → look → `direct_film` and approval → material (music first) → build → check.
  - The `screen-tutorial` intro and end card are short acts.
  - `edit-video` routes standalone motion graphics to `sequence-core` + `motion`.
- Verified in the studio: bad treatment → specific refusals; good one → storyboard; compose refused while waiting; the chip shown; Approve & build → the act composed; the chips gone.

## Phase 5 results: music first

- **5.1 `analyzeBeats` (`@miraiclip/audio-sources`).** Spectral-flux onsets, an autocorrelation tempo (60–200 BPM), a bar check (the beat must divide the loop, which catches swing and dotted figures), a doubling rule, DP beat tracking, and downbeats (4/4). Also `decodeAndAnalyzeBeats`, `beatAlignment` and `snapToBeat`.
  - 13 synthesised fixtures: ≤ 0.02 BPM error, beats within 12.5 ms (34.5 ms on the swung boom-bap).
  - The template's demo tracks: sunny-steps 112.0 (true 112; librosa 112.3), lofi-loop 82.0 (true 82; it read 108.8 before the bar check), calm-drift has no steady beat (confidence 0.03).
  - A 3-minute track takes about 0.7 s.
- **5.2 `get_beat_grid` (template).** It measures the longest audio clip (or the one named), keeps the grid in film seconds (invalidated if the music clip moves), and suggests moves for the treatment's beats. compose_sequence then puts the act's beats on the stage root (`data-beats`), so `S.beat(n)` is the n-th music beat of the act.
- **5.3 Beat alignment.** compose_sequence reports "N of M beats land on the music (±80 ms)" (labels at the act's start don't count) and flags acts under 75% with the off-beat labels. Verified: an act with fixed times scored 0 of 2; with labels on `S.beat(n)`, 2 of 2.
- **5.4 `add_sound_effects`.** Cues are act + label + kind (whoosh, pop, tick, impact, riser, chime). Each kind tries several searches, the template's own CC0 library first. A whoosh leads its move by 0.15 s, and a riser ends on its label. Sounds go on a "Sound effects" track (a second one when they overlap), at mixed levels.

## Phase 6 results: restructure

- **6.1** Skills bundle and routing as above. The assistant's skills test covers the new skills, the motion rules and breakdowns, and that recipes don't instruct filling templates.
- **6.2** With the stage kit, `add_scene` leaves the assistant's tools. `plan_film` returns the format's `story` and `blueprints` (library scenes to read) instead of a scene menu, and tells the model to direct first. The tools offered in a film turn:
  - compose_sequence, direct_film, design_scene, read_scene, preview_film, review_film;
  - get_beat_grid and add_sound_effects;
  - the media tools.
- **6.3 Docs (miraiclip-docs).**
  - New `creative/sequences` (the stage kit, API, rules, lint, libraries) and `creative/motion-metrics`.
  - A beat-analysis section in `creative/audio`.
  - "Films from a brief" and the new tools in `ai/skills`.
  - `tool-end` images in `ai/assistant`.

  The changed pages compile as MDX. Run the full `pnpm build` on the Mac.

## Phase 7 results: models and evaluation

- **7.1 `scripts/eval-films.mjs` (template)** and `scripts/eval/briefs.json` (10 briefs).
  - It drives the real editor (Playwright, `?eval` hook) with a provider, key and model from the environment, appending "just make it".
  - Its scorecard covers length vs asked, acts, density, median change, holds, words/s, words per beat, on-beat share, tool errors, tokens, cost (with EVAL_PRICE_IN/OUT) and minutes, with ✓/✗ against the targets.
  - It also writes a human-scores CSV (continuity, idea fit, look originality, polish) and each film's contact sheet.
  - `EVAL_MOCK=1` checks the pipeline without a model; verified.
- **7.2 `review_film` + AI settings → Reviewer.** A second model, from any provider, gets the brief, the treatment, a 12-frame filmstrip and the motion checks, and returns up to 8 notes "<time> — <problem> — <fix>" and a verdict. Verified with the worker on Anthropic and the reviewer on OpenAI: the reviewer request carried the filmstrip; the notes and verdict came back.
- **7.3 Model guidance: not run.** It needs real API keys (none in this environment). Run, for each model:

  `EVAL_PROVIDER=… EVAL_KEY=… EVAL_MODEL=… EVAL_PRICE_IN=… EVAL_PRICE_OUT=… node scripts/eval-films.mjs`

  against `pnpm dev:local`, then fill in the human scores and put the results table in the project docs.

## Releases

Changesets in `.changeset/`:

- `@miraiclip/renderer` minor: scripted libraries, the stage kit, lint, motion metrics, the software raster.
- `@miraiclip/assistant` minor: tool images in results and events; the skill set.
- `@miraiclip/audio-sources` minor: beat analysis.
- `@miraiclip/registry` minor: film scenes, formats and styles.

The template feature-detects everything, so it runs on the published packages; sequences need the new renderer.

## Status

| Phase | State |
|---|---|
| 0 Spikes | done (0.1–0.6) |
| 1 Sequences | done (1.1–1.7) |
| 2 Skills by job | done (2.1–2.6) |
| 3 Motion metrics | done (3.1–3.3); add the reference fixtures when re-attached |
| 4 Direction and approval | done |
| 5 Music first | done |
| 6 Restructure | done (run the docs build on the Mac) |
| 7 Models and evaluation | 7.1, 7.2 done; 7.3 needs real keys |
