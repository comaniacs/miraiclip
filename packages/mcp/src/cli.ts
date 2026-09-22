#!/usr/bin/env node
/**
 * `miraiclip-mcp --project ./video.miraiclip.json [--assets ./media]`
 *
 * Speaks MCP over stdio: stdout is the protocol channel, so ALL logging goes
 * to stderr. One server edits one project file; every successful edit
 * autosaves, so the project survives across agent sessions.
 */
import process from "node:process";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";
import { ProjectSession } from "./session.js";

const HELP = `miraiclip-mcp — MCP server for editing a Miraiclip project

usage: miraiclip-mcp [options]

  --project <path>   project JSON file (default: miraiclip-project.json; created if missing)
  --assets <dir>     base dir for relative asset src paths (default: the project file's dir)
  --width <px>       new-project composition width  (default 1920)
  --height <px>      new-project composition height (default 1080)
  --fps <n>          new-project frame rate         (default 30)
  --browser <path>   Chrome/Chromium executable for previews and exports
                     (default: MIRAICLIP_BROWSER env, then system Chrome)
  --help
`;

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args["help"] === true) {
    process.stderr.write(HELP);
    return;
  }

  const projectPath = typeof args["project"] === "string" ? args["project"] : "miraiclip-project.json";
  const session = await ProjectSession.open({
    projectPath,
    ...(typeof args["assets"] === "string" ? { assetsDir: args["assets"] } : {}),
    defaults: {
      width: Number(args["width"] ?? 1920),
      height: Number(args["height"] ?? 1080),
      fps: Number(args["fps"] ?? 30),
    },
    ...(typeof args["browser"] === "string"
      ? { browser: { executablePath: args["browser"] } }
      : {}),
  });

  const server = createMcpServer(session);
  const shutdown = async (): Promise<void> => {
    await session.close().catch(() => undefined);
    await server.close().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  await server.connect(new StdioServerTransport());
  process.stderr.write(`miraiclip-mcp: serving ${session.projectPath} (assets: ${session.assetsDir})\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`miraiclip-mcp: fatal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
