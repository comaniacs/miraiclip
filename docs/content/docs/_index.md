---
title: Introduction
weight: 1
next: /docs/quickstart
---

Miraiclip is not a video editor app — it is the engine you build one with. The core is headless: it manages project state, a microsecond-precision timeline, and a full command history, with rendering delivered as a separate layer.

Every mutation flows through a descriptive command, which makes the engine equally usable by a human clicking a UI, an LLM generating an edit sequence, or a sync layer replaying a collaborator's changes.

## Architecture

Miraiclip is a monorepo of focused packages:

| Package | Status | Description |
| --- | --- | --- |
| `@miraiclip/core` | ✅ v0.1.0 (in repo, unpublished) | Headless command-driven engine: state, commands, history, events |
| `@miraiclip/renderer` | planned | WebCodecs + WebGL playback and preview |
| `@miraiclip/react` | planned | React hooks and selectors |

## Core concepts

{{< cards >}}
  {{< card link="core-concepts/commands" title="Commands" subtitle="The only write path into the engine — descriptive, validated, undoable." >}}
  {{< card link="core-concepts/project-state" title="Project State" subtitle="A single Zustand store as the source of truth for your composition." >}}
  {{< card link="core-concepts/clips" title="Clips" subtitle="Video, audio, image, and text building blocks on the timeline." >}}
  {{< card link="core-concepts/tracks" title="Tracks" subtitle="Ordered containers that define layering and grouping." >}}
  {{< card link="core-concepts/events" title="Events & Patches" subtitle="Reactive notifications with granular patches for every change." >}}
{{< /cards >}}
