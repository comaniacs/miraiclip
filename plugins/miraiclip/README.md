# Miraiclip for Claude Code

Make and edit videos with Claude. This plugin bundles the Miraiclip MCP server with skills for talking-head recuts, captions, launch videos, reformats and screen tutorials, plus a helper CLI the skills use.

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
skills/reformat/
skills/screen-tutorial/
```

## Developing

```bash
claude plugin validate ./plugins/miraiclip
claude --plugin-dir ./plugins/miraiclip          # load without installing
MIRAICLIP_MCP=D:/miraiclip/packages/mcp/dist/cli.js claude --plugin-dir ./plugins/miraiclip   # against a local server build
```

Every HTML pattern in `skills/edit-video/reference/html-recipes.md` has been rendered through the MCP server's preview and export. Re-check them when the renderer changes.
