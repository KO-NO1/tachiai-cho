// Stripe Checkout。秘密鍵は引数で受け取り、このファイルには置かない。
var PRICE_YEN = 500;
var PRODUCT = "tachiai-cho";

function encodeForm(fields) {
  return Object.keys(fields).map(function (key) {
    return encodeURIComponent(key) + "=" + encodeURIComponent(String(fields[key]));
  }).join("&");
}

function publicOrigin(configured, hostHeader) {
  var raw = String(configured || "").trim().replace(/\/+$/, "");
  if (raw) {
    var parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("origin");
    }
    return parsed.origin;
  }
  var host = String(hostHeader || "").split(",")[0].trim();
  if (!/^[A-Za-z0-9.-]+(:[0-9]+)?$/.test(host)) host = "127.0.0.1:3000";
  var local = host.indexOf("localhost") === 0 || host.indexOf("127.0.0.1") === 0;
  return (local ? "http://" : "https://") + host;
}

function expectsLive(secret) {
  return String(secret).indexOf("sk_live_") === 0 || String(secret).indexOf("rk_live_") === 0;
}

function checkoutFields(origin) {
  return {
    mode: "payment",
    locale: "ja",
    success_url: origin + "/api/checkout/success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url: origin + "/#price",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "jpy",
    "line_items[0][price_data][unit_amount]": String(PRICE_YEN),
    "line_items[0][price_data][product_data][name]": "立会い帳 有料機能",
    "line_items[0][price_data][product_data][description]": "印刷用の記録、記録ファイルの保存と読み込み、請求後の確認リスト。買い切り。",
    "metadata[product]": PRODUCT
  };
}

function isCheckoutSessionId(id) {
  return /^cs_(live|test)_[A-Za-z0-9]{8,200}$/.test(String(id || ""));
}

function isStripeCheckoutUrl(url) {
  try {
    var parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "checkout.stripe.com";
  } catch (e) {
    return false;
  }
}

function sessionUnlocks(session, live) {
  if (!session || session.object !== "checkout.session") return false;
  if (session.mode !== "payment") return false;
  if (session.payment_status !== "paid") return false;
  if (session.currency !== "jpy") return false;
  if (session.amount_total !== PRICE_YEN) return false;
  if (!session.metadata || session.metadata.product !== PRODUCT) return false;
  if (Boolean(session.livemode) !== Boolean(live)) return false;
  return true;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(title, paragraphs, extra) {
  var body = paragraphs.map(function (paragraph) {
    return "<p>" + escapeHtml(paragraph) + "</p>";
  }).join("");
  return "<!DOCTYPE html><html lang=\"ja\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<meta name=\"robots\" content=\"noindex\"><meta name=\"referrer\" content=\"no-referrer\">" +
    "<title>" + escapeHtml(title) + " — 立会い帳</title>" +
    "<link rel=\"stylesheet\" href=\"/css/app.css\"></head><body>" +
    "<main class=\"narrow section\"><p class=\"sub\">立会い帳</p><h1>" + escapeHtml(title) + "</h1>" +
    body + (extra || "") + "</main></body></html>";
}

function successPage() {
  return page("支払いが完了しました", [
    "このブラウザで、印刷用の記録と確認リストを開きました。",
    "まとめから印刷できます。このページのアドレスを残すと、別のブラウザでも開けます。コピー防止にはなっていません。"
  ], "<p><a class=\"btn\" href=\"/app.html#summary\">まとめへ戻る</a></p>" +
    "<script src=\"/js/model.js\"></script><script src=\"/js/config.js\"></script><script src=\"/js/metrics.js\"></script>" +
    "<script>TachiaiModel.setUnlocked(localStorage);TachiaiMetrics.track(\"unlock_seen\");</script>");
}

function unpaidPage() {
  return page("支払いは確認できていません", [
    "有料の機能は開いていません。",
    "カードの手続きが終わっていない場合は、料金のページからもう一度購入してください。"
  ], "<p><a class=\"btn\" href=\"/#price\">料金へ戻る</a></p>");
}

function messagePage(title, paragraph) {
  return page(title, [paragraph], "<p><a class=\"btn\" href=\"/#price\">料金へ戻る</a></p>");
}

async function stripeRequest(secret, method, apiPath, fields) {
  var opts = {
    method: method,
    headers: { Authorization: "Bearer " + secret },
    redirect: "error",
    signal: AbortSignal.timeout(20000)
  };
  if (fields) {
    opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
    opts.body = encodeForm(fields);
  }
  var response = await fetch("https://api.stripe.com" + apiPath, opts);
  var text = await response.text();
  if (!response.ok) {
    var err = new Error("stripe");
    err.status = response.status;
    try {
      var parsed = JSON.parse(text);
      if (parsed.error) {
        err.code = parsed.error.code || "";
        err.stripeType = parsed.error.type || "";
      }
    } catch (e) { /* 本文は残さない */ }
    throw err;
  }
  return JSON.parse(text);
}

function createSession(secret, origin) {
  return stripeRequest(secret, "POST", "/v1/checkout/sessions", checkoutFields(origin));
}

function retrieveSession(secret, id) {
  if (!isCheckoutSessionId(id)) return Promise.reject(new Error("session"));
  return stripeRequest(secret, "GET", "/v1/checkout/sessions/" + id);
}

module.exports = {
  PRICE_YEN: PRICE_YEN,
  PRODUCT: PRODUCT,
  encodeForm: encodeForm,
  publicOrigin: publicOrigin,
  expectsLive: expectsLive,
  checkoutFields: checkoutFields,
  isCheckoutSessionId: isCheckoutSessionId,
  isStripeCheckoutUrl: isStripeCheckoutUrl,
  sessionUnlocks: sessionUnlocks,
  successPage: successPage,
  unpaidPage: unpaidPage,
  messagePage: messagePage,
  createSession: createSession,
  retrieveSession: retrieveSession
};
