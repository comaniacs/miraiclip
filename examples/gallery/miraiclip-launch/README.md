# Gallery: Miraiclip launch video

A 20.8 s, 1920×1080 launch video made entirely from animated HTML clips, built by following the `launch-video` skill in `plugins/miraiclip`.

| File | What it is |
| --- | --- |
| `video.miraiclip.json` | The finished project. Open it with the MCP server (`npx @miraiclip/mcp --project video.miraiclip.json`) or load it into any Miraiclip editor |
| `build.mjs` | Writes `cmds.json`: the scene templates and the `apply_commands` batch that builds the project |
| `InterVariable.woff2`, `Inter-LICENSE.txt` | Inter (SIL Open Font License), registered as the `inter` font asset |

Scenes: hook (kinetic headline) → commands (code card) → proof (counters from the 125-minute stress test) → timeline mock → "Let Claude edit" → end card. Background: one static gradient clip with the Ken Burns preset and `grain` at 0.12. Transitions: `crossDissolve` 500 ms.

Render it:

```bash
npx -p @miraiclip/server-export miraiclip-export video.miraiclip.json --out miraiclip-launch.mp4 --quality high
```

Needs `@miraiclip/server-export` 0.4.4 or later (0.4.3 bundles a renderer without animated HTML clips).
