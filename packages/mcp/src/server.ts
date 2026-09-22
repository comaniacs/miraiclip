import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { ProjectSession } from "./session.js";
import { callTool, listTools } from "./tools.js";

export const MCP_SERVER_NAME = "miraiclip";

/**
 * The Miraiclip MCP server over one project session: every editing command in
 * the catalog behind a validating `dispatch`, transactional batches, undo,
 * frame previews the agent can look at, and export — the same engine a human
 * UI drives, speaking MCP.
 */
export function createMcpServer(session: ProjectSession, version = "0.0.0"): Server {
  const server = new Server(
    { name: MCP_SERVER_NAME, version },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: listTools(session) }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return await callTool(session, request.params.name, request.params.arguments ?? {});
    } catch (error) {
      // Tool failures are structured results; this catch is for real faults
      // (browser died mid-export, disk full) — surfaced as tool errors so the
      // agent sees them instead of the connection dropping.
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      };
    }
  });

  return server;
}
