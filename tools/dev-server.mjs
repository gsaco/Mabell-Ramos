import http from "node:http";
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
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
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
