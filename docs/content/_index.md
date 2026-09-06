---
title: Miraiclip
layout: hextra-home
---

{{< hextra/hero-badge link="docs/roadmap" >}}
  <span>on npm — core, renderer with export, server export</span>
  {{< icon name="arrow-circle-right" attributes="height=14" >}}
{{< /hextra/hero-badge >}}

<div class="hx:mt-6 hx:mb-6">
{{< hextra/hero-headline >}}
  Build video editors,&nbsp;<br class="hx:sm:block hx:hidden" />not video editor plumbing
{{< /hextra/hero-headline >}}
</div>

<div class="hx:mb-12">
{{< hextra/hero-subtitle >}}
  Miraiclip is an open source, framework-agnostic library for building video editors in the browser — command-driven, AI-native, collaboration-ready.
{{< /hextra/hero-subtitle >}}
</div>

<div class="hx:mb-6">
{{< hextra/hero-button text="Get Started" link="docs" >}}
</div>

{{< hextra/feature-grid >}}
  {{< hextra/feature-card
    title="Command-Driven"
    subtitle="No imperative mutation. Dispatch descriptive commands that are deterministic, validated, serializable, and invertible."
  >}}
  {{< hextra/feature-card
    title="AI-Native"
    subtitle="Commands are plain data with a published catalog and JSON schemas — LLMs can reason about state and generate valid edit sequences."
  >}}
  {{< hextra/feature-card
    title="Time Travel"
    subtitle="Built-in undo/redo with full history. Batch commands into transactions that undo as a unit."
  >}}
  {{< hextra/feature-card
    title="Framework Agnostic"
    subtitle="Zero UI dependencies in the core. Works with React, Vue, Svelte, or vanilla JS — and headless in Node."
  >}}
  {{< hextra/feature-card
    title="Collaboration-Ready"
    subtitle="State changes are emitted as granular JSON patches — the substrate for real-time multiplayer editing."
  >}}
  {{< hextra/feature-card
    title="Frame-Accurate Timeline"
    subtitle="Microsecond-based timeline (1 s = 1,000,000 µs) for precise positioning at any frame rate."
  >}}
{{< /hextra/feature-grid >}}
