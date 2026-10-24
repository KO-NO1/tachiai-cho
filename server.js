// Railway 本番配信用。site/ の静的ファイルを返す。
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.resolve(__dirname, "site");
const BLOCKED = new Set(["/thanks.html", "/metrics.html"]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function fileForPath(pathname) {
  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname.split("?")[0]);
  } catch (e) {
    return null;
  }
  if (decoded === "/") decoded = "/index.html";
  if (BLOCKED.has(decoded) || decoded.startsWith("/functions/")) return null;
  const rel = decoded.replace(/^[/\\]+/, "");
  const full = path.resolve(ROOT, rel);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (full !== ROOT && !full.startsWith(rootWithSep)) return null;
  return full;
}

function send(res, status, type, body) {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-cache" });
  res.end(body);
}

const server = http.createServer(function (req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "text/plain; charset=utf-8", "Method not allowed");
    return;
  }
  const filePath = fileForPath(req.url || "/");
  if (!filePath) {
    send(res, 404, "text/plain; charset=utf-8", "Not found");
    return;
  }
  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      send(res, 404, "text/plain; charset=utf-8", "Not found");
      return;
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, function () {
  console.log("tachiai-cho listening on " + PORT);
});
