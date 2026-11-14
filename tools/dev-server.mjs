import http from "node:http";
import { createReadStream } from "node:fs";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = process.env.SITE_OUTPUT_DIR
  ? path.resolve(process.env.SITE_OUTPUT_DIR)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../docs");
const port = Number(process.env.PORT || 4173);
const enabled = process.argv.includes("--local-receiver");
const base = JSON.parse(
  await readFile(path.join(root, "site/runtime.json"), "utf8"),
).siteBase;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".mp4": "video/mp4",
};
const server = http.createServer(async (req, res) => {
  try {
    let route = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (base !== "/" && !route.startsWith(base)) {
      if (route === "/") {
        res.writeHead(302, { Location: base });
        res.end();
        return;
      }
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    route = route.slice(base.length);
    const target = path.resolve(root, route || "index.html");
    if (!target.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (route === "site/runtime.json" && enabled) {
      const c = JSON.parse(await readFile(target, "utf8"));
      res.setHeader("Content-Type", mime[".json"]);
      res.setHeader("Cache-Control", "no-store");
      res.end(
        JSON.stringify({
          ...c,
          receiverEndpoint: `http://127.0.0.1:${process.env.LOCAL_RECEIVER_PORT || 8787}/v1/consultas`,
          privacyNoticeVersion: "local-preview-v1",
          privacyApproved: true,
          localPreview: true,
        }),
      );
      return;
    }
    let file = target;
    const s = await stat(file);
    if (s.isDirectory()) file = path.join(file, "index.html");
    if (path.extname(file) === ".mp4") {
      const { size } = await stat(file);
      const headers = {
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      };
      let start = 0,
        end = size - 1;
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (!match || (!match[1] && !match[2])) {
          res.writeHead(416, {
            ...headers,
            "Content-Range": `bytes */${size}`,
          });
          res.end();
          return;
        }
        start = match[1]
          ? Number(match[1])
          : Math.max(0, size - Number(match[2]));
        end =
          match[1] && match[2]
            ? Math.min(Number(match[2]), size - 1)
            : size - 1;
        if (start > end || start >= size) {
          res.writeHead(416, {
            ...headers,
            "Content-Range": `bytes */${size}`,
          });
          res.end();
          return;
        }
        headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
      }
      res.writeHead(req.headers.range ? 206 : 200, {
        ...headers,
        "Content-Length": end - start + 1,
      });
      if (req.method === "HEAD") res.end();
      else createReadStream(file, { start, end }).pipe(res);
      return;
    }
    const body = await readFile(file);
    res.setHeader(
      "Content-Type",
      mime[path.extname(file)] || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(await readFile(path.join(root, "404.html"), "utf8"));
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Preview http://127.0.0.1:${port}${base}${enabled ? " (local receiver mode)" : ""}`,
  ),
);
process.on("SIGINT", () => server.close(() => process.exit()));
