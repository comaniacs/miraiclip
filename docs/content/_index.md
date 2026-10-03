---
title: Miraiclip
layout: hextra-home
---

{{< hextra/hero-badge link="docs/changelog" >}}
  <span>New: AI assistant, animated HTML clips, editable HTML</span>
  {{< icon name="arrow-circle-right" attributes="height=14" >}}
{{< /hextra/hero-badge >}}

<div class="hx:mt-6 hx:mb-6">
{{< hextra/hero-headline >}}
  Build video editors,&nbsp;<br class="hx:sm:block hx:hidden" />not video editor plumbing
{{< /hextra/hero-headline >}}
</div>

<div class="hx:mb-12">
{{< hextra/hero-subtitle >}}
  An open source engine for video editors in the browser. You bring the UI; Miraiclip brings the timeline, the commands, the renderer and the export.
{{< /hextra/hero-subtitle >}}
</div>

<div class="hx:mb-12 hx:flex hx:gap-3 hx:flex-wrap">
{{< hextra/hero-button text="Get Started" link="docs/quickstart" >}}
{{< hextra/hero-button text="Live examples" link="examples" style="background: transparent; border: 1px solid rgba(127,127,127,.4); color: inherit;" >}}
</div>

{{< demo-video >}}

{{< hextra/feature-grid >}}
  {{< hextra/feature-card
    title="Commands, not mutations"
    subtitle="Every edit is a validated, serializable, undoable command — for UIs, agents and sync alike."
    link="docs/core-concepts/commands"
  >}}
  {{< hextra/feature-card
    title="Frame-accurate preview"
    subtitle="WebCodecs decode and a WebGL compositor. Preview and export are the same pixels."
    link="docs/rendering"
  >}}
  {{< hextra/feature-card
    title="Export anywhere"
    subtitle="MP4 or WebM in the browser, in a worker, or from Node — faster than realtime."
    link="docs/export"
  >}}
  {{< hextra/feature-card
    title="Creative toolkit"
    subtitle="Keyframes and animation presets, 79 effects, transitions, karaoke captions."
    link="examples"
  >}}
  {{< hextra/feature-card
    title="HTML clips"
    subtitle="Overlays in HTML and CSS, with parameters and CSS animation, rendered frame-exactly."
    link="docs/rendering/html-clips"
  >}}
  {{< hextra/feature-card
    title="Templates"
    subtitle="One composition, many personalized videos. Batch render from JSON or CSV."
    link="docs/templates"
  >}}
  {{< hextra/feature-card
    title="AI-native"
    subtitle="LLM tools from the command catalog, an editing assistant for any model, an MCP server."
    link="docs/ai-integration"
  >}}
  {{< hextra/feature-card
    title="Audio, licensed"
    subtitle="Stock libraries and AI generation, with license and credit tracked on every import."
    link="docs/audio-sources"
  >}}
  {{< hextra/feature-card
    title="Headless & collaborative"
    subtitle="No UI dependencies; runs in any framework or Node. Every change is a JSON patch."
    link="docs/core-concepts/events"
  >}}
{{< /hextra/feature-grid >}}
