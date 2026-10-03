---
title: Introduction
weight: 1
next: /docs/quickstart
---

Miraiclip is not a video editor app — it is the engine you build one with. The core is headless: it manages project state, a microsecond-precision timeline, and a full command history, with rendering delivered as a separate layer.

Every mutation flows through a descriptive command, which makes the engine equally usable by a human clicking a UI, an LLM generating an edit sequence, or a sync layer replaying a collaborator's changes.

## See it in an editor

{{< demo-video >}}

## Architecture

Miraiclip is a monorepo of focused packages:

| Package | Status | Description |
| --- | --- | --- |
| [`@miraiclip/core`](https://www.npmjs.com/package/@miraiclip/core) | ✅ v0.5.7 on npm | Headless command-driven engine: state, commands, history, events, [AI integration](ai-integration) |
| [`@miraiclip/renderer`](https://www.npmjs.com/package/@miraiclip/renderer) | ✅ v0.7.11 on npm | WebCodecs + WebGL playback, preview, export, and stills — see [Rendering](rendering) |
| [`@miraiclip/server-export`](https://www.npmjs.com/package/@miraiclip/server-export) | ✅ v0.4.3 on npm | Server-side export and frame rendering: the browser pipeline in headless Chrome, from Node — see [Server side](export/server-side) |
| [`@miraiclip/mcp`](https://www.npmjs.com/package/@miraiclip/mcp) | ✅ v0.1.3 on npm | MCP server: Claude, Codex, and other agents edit projects with visual feedback — see [MCP Server](mcp-server) |
| [`@miraiclip/templates`](https://www.npmjs.com/package/@miraiclip/templates) | ✅ v0.1.3 on npm | Parameterized videos: template + data rows → batch personalized exports — see [Templates](templates) |
| [`@miraiclip/audio-sources`](https://www.npmjs.com/package/@miraiclip/audio-sources) | ✅ v0.2.1 on npm | Stock and AI-generated audio: Openverse, Freesound, your own catalog or backend, vendor-neutral generators, `importAudio`, LLM tools — see [Audio Sources](audio-sources) |
| [`@miraiclip/assistant`](https://www.npmjs.com/package/@miraiclip/assistant) | ✅ v0.1.1 on npm | AI editing assistant: vendor-neutral models (OpenAI first), an agent loop that lands each request as one undo step, editing tools, server-side keys — see [Assistant](assistant) |
| `@miraiclip/react` | planned | React hooks and selectors |

## Core concepts

{{< cards >}}
  {{< card link="core-concepts/commands" title="Commands" subtitle="The only write path into the engine — descriptive, validated, undoable." >}}
  {{< card link="core-concepts/project-state" title="Project State" subtitle="A single Zustand store as the source of truth for your composition." >}}
  {{< card link="core-concepts/clips" title="Clips" subtitle="Video, audio, image, and text building blocks on the timeline." >}}
  {{< card link="core-concepts/tracks" title="Tracks" subtitle="Ordered containers that define layering and grouping." >}}
  {{< card link="core-concepts/events" title="Events & Patches" subtitle="Reactive notifications with granular patches for every change." >}}
{{< /cards >}}
