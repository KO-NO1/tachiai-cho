// Railway 本番配信用。site/ の静的ファイルと、支払い確認つきの Checkout を返す。
const http = require("http");
const fs = require("fs");
const path = require("path");
const checkout = require("./checkout");

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
  if (BLOCKED.has(decoded) || decoded.startsWith("/functions/") || decoded.startsWith("/api/")) return null;
  const rel = decoded.replace(/^[/\\]+/, "");
  const full = path.resolve(ROOT, rel);
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (full !== ROOT && !full.startsWith(rootWithSep)) return null;
  return full;
}

function send(res, status, type, body, extra) {
  const headers = Object.assign({
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  }, extra || {});
  res.writeHead(status, headers);
  res.end(body);
}

function html(res, status, body) {
  send(res, status, "text/html; charset=utf-8", body);
}

function originOf(req) {
  return checkout.publicOrigin(process.env.PUBLIC_ORIGIN, req.headers.host);
}

async function handleCreate(req, res) {
  if (req.method !== "POST") {
    send(res, 405, "text/plain; charset=utf-8", "Method not allowed");
    return;
  }
  const secret = process.env.STRIPE_SECRET_KEY || "";
  if (!secret) {
    html(res, 503, checkout.messagePage("決済の準備中です", "カード決済は、まだ接続されていません。"));
    return;
  }
  let origin = "";
  try {
    origin = originOf(req);
  } catch (e) {
    html(res, 500, checkout.messagePage("決済画面を開けませんでした", "時間をおいて、もう一度押してください。代金は引き落とされていません。"));
    return;
  }
  try {
    const session = await checkout.createSession(secret, origin);
    if (!checkout.isStripeCheckoutUrl(session.url)) {
      html(res, 502, checkout.messagePage("決済画面を開けませんでした", "時間をおいて、もう一度押してください。代金は引き落とされていません。"));
      return;
    }
    res.writeHead(303, {
      Location: session.url,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer"
    });
    res.end();
  } catch (e) {
    console.error("checkout create failed", e.status || "", e.stripeType || "", e.code || "");
    html(res, 502, checkout.messagePage("決済画面を開けませんでした", "時間をおいて、もう一度押してください。代金は引き落とされていません。"));
  }
}

async function handleSuccess(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "text/plain; charset=utf-8", "Method not allowed");
    return;
  }
  const id = url.searchParams.get("session_id") || "";
  if (!checkout.isCheckoutSessionId(id)) {
    send(res, 404, "text/plain; charset=utf-8", "Not found");
    return;
  }
  const secret = process.env.STRIPE_SECRET_KEY || "";
  if (!secret) {
    html(res, 503, checkout.messagePage("決済の準備中です", "カード決済は、まだ接続されていません。"));
    return;
  }
  try {
    const session = await checkout.retrieveSession(secret, id);
    if (!checkout.sessionUnlocks(session, checkout.expectsLive(secret))) {
      html(res, 200, checkout.unpaidPage());
      return;
    }
    html(res, 200, req.method === "HEAD" ? "" : checkout.successPage());
  } catch (e) {
    console.error("checkout confirm failed", e.status || "");
    html(res, 502, checkout.messagePage("支払いの確認に失敗しました", "有料の機能は、まだ開いていません。決済完了後のページを、ブラウザの戻るで開き直してください。"));
  }
}

function canonicalRedirect(req, url) {
  if (req.method !== "GET" && req.method !== "HEAD") return "";
  const host = String(req.headers.host || "").toLowerCase();
  if (!host.endsWith(".up.railway.app")) return "";
  let target;
  try {
    target = new URL(process.env.PUBLIC_ORIGIN || "");
  } catch (e) {
    return "";
  }
  if (target.protocol !== "https:" || target.host.toLowerCase() === host) return "";
  return target.origin + url.pathname + url.search;
}

async function dispatch(req, res) {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const redirect = canonicalRedirect(req, url);
  if (redirect) {
    res.writeHead(301, { Location: redirect, "Cache-Control": "no-store" });
    res.end();
    return;
  }
  if (url.pathname === "/api/checkout") {
    await handleCreate(req, res);
    return;
  }
  if (url.pathname === "/api/checkout/success") {
    await handleSuccess(req, res, url);
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 405, "text/plain; charset=utf-8", "Method not allowed");
    return;
  }
  const filePath = fileForPath(url.pathname);
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
}

const server = http.createServer(function (req, res) {
  Promise.resolve(dispatch(req, res)).catch(function () {
    if (!res.headersSent) send(res, 500, "text/plain; charset=utf-8", "Error");
  });
});

if (require.main === module) {
  server.listen(PORT, function () {
    console.log("tachiai-cho listening on " + PORT);
  });
}

module.exports = { server: server };
