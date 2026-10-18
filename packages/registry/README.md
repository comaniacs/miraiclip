# @miraiclip/registry

Ready-made blocks for [Miraiclip](https://docs.miraiclip.com/) videos — lower thirds, callouts, intros, end cards, cursors, progress bars, backgrounds and caption styles — and the `miraiclip` CLI that adds them to a project.

```bash
npx @miraiclip/registry catalog
npx @miraiclip/registry add lower-third-classic --project video.miraiclip.json --at 2 --set name="Ada Lovelace" --set role=Founder
```

In code, blocks are pure planners — a block plus where it goes → core commands:

```ts
import { blockCommands, getBuiltinBlock } from "@miraiclip/registry";

const block = getBuiltinBlock("callout-tooltip")!;
project.transaction(() => {
  for (const command of blockCommands(block, {
    trackId: "overlays",
    createTrack: true,
    startUs: 4_000_000,
    values: { text: "Click Save" },
    composition: project.getState().doc.settings,
  })) project.dispatch(command);
});
```

A registry is static JSON (`index.json` + `blocks/<name>.json`) that any web host can serve: `miraiclip build <dir> --blocks ./my-blocks` writes one with the built-ins plus your own, and `--registry <url>` reads from it. Docs: https://docs.miraiclip.com/
