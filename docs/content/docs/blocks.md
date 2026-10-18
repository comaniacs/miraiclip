---
title: Blocks
weight: 10
---

`@miraiclip/registry` ships ready-made **blocks** — the pieces most product, tutorial and social videos need — and the `miraiclip` CLI that adds them to a project. A block is plain JSON: an html clip (or a caption style) plus the fields you fill in.

```bash
npx @miraiclip/registry catalog                       # list every block
npx @miraiclip/registry show callout-tooltip          # one block's JSON
npx @miraiclip/registry add lower-third-classic --project video.miraiclip.json \
  --at 2 --set name="Ada Lovelace" --set role="Founder, Analytical Co."
```

`add` places the block at `--at` seconds on `--track` (default `overlays`, created on top if missing) as one undo step and saves the project. `--print` prints `{ "commands": [...] }` instead, for an agent's `apply_commands`. Caption-style blocks restyle caption clips: `--captions all` (default) or a list of clip ids.

## Built-in blocks

| Category | Blocks |
| --- | --- |
| Lower thirds | `lower-third-classic`, `lower-third-pill`, `lower-third-minimal`, `lower-third-gradient` |
| Callouts | `callout-tooltip`, `callout-step-badge`, `callout-highlight-box`, `callout-arrow-label` |
| Titles and intros | `intro-kinetic-headline`, `intro-logo-reveal`, `title-chapter`, `title-centered` |
| End card | `outro-cta` |
| Cursor | `cursor-arrow`, `cursor-click` |
| Progress and background | `progress-bar`, `background-gradient` |
| Caption styles | `caption-bold-pop`, `caption-karaoke`, `caption-boxed`, `caption-minimal` |

Every html block renders the same in preview, browser export and server export; the test suite renders each one in 16:9 and 9:16. Sized blocks (lower thirds, callouts, cursors) are designed at 1080p and scale with the composition; their default spot is kept inside the frame in other shapes. Full-frame blocks size themselves to any composition. Animated blocks enter and leave on their own — change their length and the exit follows.

## In code

Blocks are pure planners: a block, where it goes and the values → core commands.

```ts
import { blockCommands, captionStyleCommands, getBuiltinBlock, searchBlocks, builtinBlocks } from "@miraiclip/registry";

const commands = blockCommands(getBuiltinBlock("title-chapter")!, {
  id: "chapter-2",
  trackId: "titles",
  createTrack: true,
  startUs: 12_000_000,
  values: { kicker: "STEP 2", title: "Connect your data" },
  composition: project.getState().doc.settings,
});
project.transaction(() => commands.forEach((c) => project.dispatch(c)));

searchBlocks(builtinBlocks(), { text: "tutorial", category: "callout" });
```

Field values are validated (`number`, `boolean`, CSS `color`, `text`) and unknown keys are rejected. After placing a block, its text lives in the clip's `params`, so `clip/set-property` `{ params: { name: "…" } }` edits it without touching the markup.

## Your own registry

A registry is static files — `index.json` plus `blocks/<name>.json` — that any web host can serve (GitHub Pages, a CDN, your site). Write blocks as JSON in the [block format](https://github.com/comaniacs/miraiclip/blob/main/packages/registry/src/types.ts), then:

```bash
npx @miraiclip/registry build ./public/registry --blocks ./my-blocks --name acme
npx @miraiclip/registry catalog --registry https://acme.dev/registry
npx @miraiclip/registry add acme-lower-third --registry https://acme.dev/registry --project video.miraiclip.json
```

`fetchRegistryIndex(url)` and `fetchRegistryBlock(url, name)` do the same from code. The built-in blocks are also published as a registry at [`/registry/index.json`](/miraiclip/registry/index.json) on this site.
