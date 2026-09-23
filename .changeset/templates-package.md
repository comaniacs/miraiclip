---
"@miraiclip/templates": minor
---

New package — parameterized videos: a template project + a data payload → a hydrated document → export. `defineTemplate`/`parseTemplate` (declared fields + `{{placeholder}}` binding into text clips, caption words, and html-clip params; asset slots swap an asset's src; coherence checked up front), pure deterministic `hydrate`/`tryHydrate` with machine-readable failures, `extractFields`, `describeTemplate`, and `toFieldToolDefinition` (the field schema as an Anthropic/OpenAI tool an agent fills). Batch rendering at `@miraiclip/templates/render` (`renderTemplateBatch` over warm export sessions, per-row results, `{field}` output naming, concurrency) and a `miraiclip-templates` CLI taking JSON/NDJSON/CSV rows.
