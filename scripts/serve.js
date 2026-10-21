#!/usr/bin/env node
// Tiny dependency-free static server for previewing dist/ locally.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist");
const port = Number(process.env.PORT ?? 8080);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let file = join(out, normalize(url).replace(/^(\.\.[/\\])+/, ""));

  if (existsSync(file) && statSync(file).isDirectory()) {
    file = join(file, "index.html");
  }

  if (!existsSync(file)) {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("404 Not Found");
    return;
  }

  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`serve: http://localhost:${port} -> ${out}`);
});
