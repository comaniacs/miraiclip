// A render worker: runs one chunk job per request for `httpRunner`.
// Deploy the same container to Cloud Run, AWS Lambda (with the Lambda Web
// Adapter layer), Fly, or a VM. Jobs are stateless: the document arrives in
// the request and assets come from http(s) URLs, so instances can scale to zero.
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { createRenderJobHandler } from "@miraiclip/server-export";

const handler = createRenderJobHandler({
  token: process.env.RENDER_TOKEN, // set it: workers on a public URL must not render for strangers
  // No GPU on most serverless platforms: software GL (set GPU=1 on GPU machines).
  browser: {
    swiftshader: !process.env.GPU,
    args: ["--disable-dev-shm-usage"], // containers often have a tiny /dev/shm
  },
});

const port = Number(process.env.PORT ?? 8080);
createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/healthz") return void res.end("ok");
  const request = new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: req.method === "POST" ? Readable.toWeb(req) : undefined,
    duplex: "half",
  });
  const response = await handler(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`render worker on :${port}`));

process.on("SIGTERM", async () => {
  await handler.close();
  process.exit(0);
});
