import { createReadStream, statSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { contentTypeFor } from "./assets.js";

const HARNESS_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>miraiclip export harness</title></head>
<body><script src="/harness.js"></script></body></html>`;

export interface HarnessServer {
  /** Origin including the ephemeral port, e.g. http://127.0.0.1:39041 */
  url: string;
  close(): Promise<void>;
}

/**
 * A loopback-only static server: the harness page, its bundled script, and
 * the project's media files. Media decode fetches byte ranges while seeking,
 * so /assets/* answers Range requests properly (206 + Content-Range) — a
 * naive full-body server makes mediabunny re-download the file per seek.
 */
export async function startHarnessServer(options: {
  harnessScriptPath: string;
  /** URL path → absolute local file path (from resolveAssetSources). */
  files: Map<string, string>;
}): Promise<HarnessServer> {
  const server = http.createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0]!;
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }
    if (url === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(req.method === "HEAD" ? undefined : HARNESS_HTML);
      return;
    }
    const filePath = url === "/harness.js" ? options.harnessScriptPath : options.files.get(url);
    if (!filePath) {
      res.writeHead(404).end();
      return;
    }
    serveFile(req, res, filePath);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

function serveFile(req: http.IncomingMessage, res: http.ServerResponse, filePath: string): void {
  let size: number;
  try {
    size = statSync(filePath).size;
  } catch {
    res.writeHead(404).end();
    return;
  }
  const headers: http.OutgoingHttpHeaders = {
    "content-type": contentTypeFor(filePath),
    "accept-ranges": "bytes",
    "cache-control": "no-store",
  };

  const range = req.headers.range;
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (match && (match[1] !== "" || match[2] !== "")) {
    const start = match[1] === "" ? Math.max(0, size - Number(match[2])) : Number(match[1]);
    const end = match[2] === "" || match[1] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
    if (start > end || start >= size) {
      res.writeHead(416, { "content-range": `bytes */${size}` }).end();
      return;
    }
    res.writeHead(206, {
      ...headers,
      "content-range": `bytes ${start}-${end}/${size}`,
      "content-length": end - start + 1,
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(filePath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, { ...headers, "content-length": size });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}
