#!/usr/bin/env node
/**
 * Starts the Miraiclip MCP server for the folder Claude Code runs in.
 *
 * One folder = one video. The project file is ./video.miraiclip.json (created on
 * first edit), and media paths resolve against the folder itself.
 *
 * Overrides (environment):
 *   MIRAICLIP_PROJECT   project file path        (default video.miraiclip.json)
 *   MIRAICLIP_ASSETS    base folder for media    (default the project file's folder)
 *   MIRAICLIP_BROWSER   Chrome/Chromium binary   (default: installed Google Chrome)
 *   MIRAICLIP_MCP       npm spec to run          (default @miraiclip/mcp@^0.1.4),
 *                       or a path to a local cli.js build
 *
 * stdout is the MCP channel: this file only ever logs to stderr.
 */
import { spawn } from "node:child_process";
import path from "node:path";

const project = path.resolve(process.env.MIRAICLIP_PROJECT || "video.miraiclip.json");
const assets = path.resolve(process.env.MIRAICLIP_ASSETS || path.dirname(project));
const spec = process.env.MIRAICLIP_MCP || "@miraiclip/mcp@^0.1.4";

const serverArgs = ["--project", project, "--assets", assets];
if (process.env.MIRAICLIP_BROWSER) serverArgs.push("--browser", process.env.MIRAICLIP_BROWSER);

const win = process.platform === "win32";
let child;
if (/\.[cm]?js$/.test(spec)) {
  // A local build, e.g. MIRAICLIP_MCP=D:/miraiclip/packages/mcp/dist/cli.js
  child = spawn(process.execPath, [path.resolve(spec), ...serverArgs], { stdio: "inherit", windowsHide: true });
} else {
  const args = ["-y", spec, ...serverArgs];
  // With shell: true, Node passes args unquoted: quote paths that contain spaces.
  const quoted = win ? args.map((a) => (/[\s&()^]/.test(a) ? `"${a}"` : a)) : args;
  child = spawn(win ? "npx.cmd" : "npx", quoted, {
    stdio: "inherit",
    shell: win, // npx is a .cmd shim on Windows
    windowsHide: true,
  });
}
const stop = () => child.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));
child.on("error", (error) => {
  process.stderr.write(`miraiclip: could not start npx (${error.message}). Is Node.js installed?\n`);
  process.exit(1);
});
