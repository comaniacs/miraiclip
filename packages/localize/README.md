# @miraiclip/localize

One project, many languages. `localizeProject` finds every string a viewer sees (text clips, captions, html block text, chapter markers, the project name) plus your narration script, translates them in one batch and returns a variant document per language.

```ts
import { chatTranslator, deeplTranslator, localizeMany } from "@miraiclip/localize";
import { synthesizeNarration, alignNarration } from "@miraiclip/narration";

const variants = await localizeMany(baseDoc, deeplTranslator({ apiKey }), ["fr", "de", "hi"], { script, keep: ["Miraiclip"] });
for (const [lang, v] of Object.entries(variants)) {
  const takes = await synthesizeNarration(voice, v.script!, { store });
  const aligned = alignNarration(v.doc, v.script!, takes, { clipIds: ["screen"] }); // re-voiced, re-timed
}
```

- **Translators**: any chat model (`chatTranslator`, good with tone and context) or DeepL (`deeplTranslator`); bring your own by implementing `Translator`.
- **Kept terms** (product names, untranslated UI labels) and `{{placeholders}}` survive translation.
- **Captions keep their word timing** when the word count matches and are re-spread evenly when it doesn't. Re-run ASR on the new voice for exact karaoke timing.
- Colours, URLs, numbers and settings in html blocks are left alone (`isTextParam`, overridable).

Docs: https://docs.miraiclip.com/
