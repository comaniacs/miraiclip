# Miraiclip for Claude Code

Make and edit videos with Claude. This plugin bundles the Miraiclip MCP server with skills for talking-head recuts, captions, launch videos, reformats, screen tutorials and reusable templates, plus a helper CLI the skills use.

```bash
claude plugin marketplace add comaniacs/miraiclip
claude plugin install miraiclip@miraiclip
```

Start Claude Code in a folder that holds your media (one folder per video) and ask for a video. Docs: https://docs.miraiclip.com/ai/claude-code

## Layout

```
.claude-plugin/plugin.json   manifest
.mcp.json                    starts scripts/mcp.mjs → npx @miraiclip/mcp
scripts/mcp.mjs              launcher (one project per folder, Windows-safe npx)
scripts/mc.mjs               helper CLI: probe, transcribe, cuts, recut, captions, animate, sheet, subtitles
skills/edit-video/           router, edit loop, rules, reference/ (craft, html recipes, motion, commands)
skills/talking-head/
skills/captions/
skills/launch-video/
skills/continuous-shot/      three concepts → beat sheet → build at stage version 2 → check_sequence → contact sheet; reference/ (carry-types, beat-sheet, scorecard)
skills/reformat/
skills/screen-tutorial/
skills/make-template/        template loop, kit/ (shared kit + starter), scripts/frames.mjs (studio frame capture), reference/ (patterns, scorecard)
```

## Editor versions (EDITOR.md)

Each skill folder can also hold an `EDITOR.md`: the same job written for the assistant inside a Miraiclip editor (`@miraiclip/assistant`), which has editing tools but no shell, MCP server or frame previews. Claude Code never reads it; the `reference/` files are shared. After changing an `EDITOR.md` or a reference file, rebundle them into the package:

```bash
pnpm --filter @miraiclip/assistant skills    # writes packages/assistant/src/skills.generated.ts
```

The package's build and tests fail while the bundle is out of date.

## Developing

```bash
claude plugin validate ./plugins/miraiclip
claude --plugin-dir ./plugins/miraiclip          # load without installing
MIRAICLIP_MCP=D:/miraiclip/packages/mcp/dist/cli.js claude --plugin-dir ./plugins/miraiclip   # against a local server build
```

Every HTML pattern in `skills/edit-video/reference/html-recipes.md` has been rendered through the MCP server's preview and export. Re-check them when the renderer changes.

`skills/make-template/kit/_kit.mjs` is a copy of `examples/templates/_kit.mjs` in the main repo, which is the source of truth. After changing the kit there, copy it here:

```bash
cp examples/templates/_kit.mjs plugins/miraiclip/skills/make-template/kit/_kit.mjs
```
