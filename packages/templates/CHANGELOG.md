# @miraiclip/templates

## 0.1.2

### Patch Changes

- ee1db76: Templates for editors: `suggestTemplateFields` lists what in a finished project could stay editable (texts, html-clip params with colors detected, media used by clips), and `templateFromDocument` turns the chosen ones into optional fields defaulting to their current values ("Save as template"). `insertDocument` / `insertCommands` add a hydrated template to an existing project at a time, as one undo step: new tracks on top, every id remapped, keyframes, effects and transitions carried over, matching media and fonts reused. `fitClipsToMedia` shortens clips that would overrun shorter swapped-in media and fits transitions to the footage left around each cut. Templates take optional `category`, `tags` and `thumbnail`; fields take an optional `label`.

## 0.1.1

### Patch Changes

- Updated dependencies [880ad42]
  - @miraiclip/core@0.5.0
  - @miraiclip/server-export@0.4.1

## 0.1.0

### Minor Changes

- 399ef67: New package — parameterized videos: a template project + a data payload → a hydrated document → export. `defineTemplate`/`parseTemplate` (declared fields + `{{placeholder}}` binding into text clips, caption words, and html-clip params; asset slots swap an asset's src; coherence checked up front), pure deterministic `hydrate`/`tryHydrate` with machine-readable failures, `extractFields`, `describeTemplate`, and `toFieldToolDefinition` (the field schema as an Anthropic/OpenAI tool an agent fills). Batch rendering at `@miraiclip/templates/render` (`renderTemplateBatch` over warm export sessions, per-row results, `{field}` output naming, concurrency) and a `miraiclip-templates` CLI taking JSON/NDJSON/CSV rows.

### Patch Changes

- Updated dependencies [399ef67]
  - @miraiclip/server-export@0.4.0
