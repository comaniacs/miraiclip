---
title: MCP Server
weight: 9
---

Let Claude, Codex, or any MCP client edit a video project. `@miraiclip/mcp` wraps one project file in an MCP server over stdio: every command in the catalog behind a validating `dispatch`, transactional batches, undo/redo, **frame previews the agent can look at**, and export to file. Every successful edit autosaves, so the project survives across agent sessions.

```sh
npx @miraiclip/mcp --project ./video.miraiclip.json --assets ./media
```

The project file is created if missing (`--width`/`--height`/`--fps` set the new composition; defaults 1920×1080 @ 30). Previews and exports run in headless Chrome — system Chrome is found automatically, or point `--browser` (or `MIRAICLIP_BROWSER`) at any Chrome/Chromium binary. MP4 export needs real Chrome; WebM works everywhere.

## Connect a client

**Claude Desktop** (`claude_desktop_config.json`) or any client that takes the standard server config:

```json
{
  "mcpServers": {
    "miraiclip": {
      "command": "npx",
      "args": ["-y", "@miraiclip/mcp", "--project", "/path/to/video.miraiclip.json", "--assets", "/path/to/media"]
    }
  }
}
```

**Claude Code:**

```sh
claude mcp add miraiclip -- npx -y @miraiclip/mcp --project ./video.miraiclip.json
```

**Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.miraiclip]
command = "npx"
args = ["-y", "@miraiclip/mcp", "--project", "./video.miraiclip.json"]
```

## Tools

| Tool | What it does |
| --- | --- |
| `get_state` | Compact project summary — settings, assets, tracks, clips, transitions, with every id and time range commands need |
| `dispatch` | Apply one command; failures are machine-readable (valid types / per-field issues / rejection code), so the agent self-corrects |
| `apply_commands` | A batch as ONE transaction: all-or-nothing with the failing index reported, one undo step |
| `undo` / `redo` | Step history; a batch reverts as a unit |
| `preview_frame` | Render any composition time as a PNG **the agent sees** — through the export pipeline, so the preview is what the export will look like |
| `export` | Encode to MP4/WebM, streamed to disk |
| `list_commands` / `get_command_schema` | The catalog: every command with a description; per-type payload JSON Schema on demand |
| `get_project_json` | The full document, exact values |

All times are integer microseconds (1 s = 1,000,000 µs) — `get_state` and every schema say so, and validation catches unit mistakes as `invalid-payload` with the exact field.

## The loop

A typical agent session, tool by tool:

1. `get_state` — read the composition and its ids.
2. `apply_commands` — make the edit as one transaction (`asset/add` + `track/add` + `clip/add` + `transition/add`…).
3. `preview_frame` at the moments that matter — the agent looks at the actual pixels and corrects itself.
4. `export` — the finished file, written next to the project.

Anything the agent breaks, `undo` reverts in one step; anything invalid never applies at all.

## Notes

- **State on disk, history in process.** The project JSON is the durable artifact (autosaved per edit, atomically); undo history lives for the server process's lifetime.
- **One warm browser.** The first `preview_frame` launches headless Chrome once; frames after that cost ~100 ms, not a browser start.
- **Same pipeline everywhere.** Previews and exports run the exact renderer the [browser export](export/client-side) and [server export](export/server-side) use — what the agent sees is what exports.
- **Embedding.** The pieces are exported for your own server or app: `ProjectSession`, `createMcpServer`, `listTools`/`callTool`, and (from `@miraiclip/server-export`) `createRenderSession`. Building a direct LLM integration instead? That's the [AI Integration](ai-integration) page.
