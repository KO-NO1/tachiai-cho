var assert = require("assert");
var http = require("http");
var fs = require("fs");
var path = require("path");
var checkout = require("../checkout");

delete process.env.STRIPE_SECRET_KEY;
process.env.PUBLIC_ORIGIN = "https://tachiai-cho-production.up.railway.app";

assert.strictEqual(checkout.PRICE_YEN, 500);
assert.strictEqual(checkout.expectsLive("sk_live_example"), true);
assert.strictEqual(checkout.expectsLive("rk_live_example"), true);
assert.strictEqual(checkout.expectsLive("sk_test_example"), false);

var origin = checkout.publicOrigin(process.env.PUBLIC_ORIGIN, "evil.example");
assert.strictEqual(origin, "https://tachiai-cho-production.up.railway.app");
var fields = checkout.checkoutFields(origin);
assert.strictEqual(fields["line_items[0][price_data][unit_amount]"], "500");
assert.strictEqual(fields["line_items[0][price_data][currency]"], "jpy");
assert.strictEqual(fields["metadata[product]"], "tachiai-cho");
assert.ok(fields.success_url.indexOf("{CHECKOUT_SESSION_ID}") !== -1);
var encoded = checkout.encodeForm(fields);
assert.ok(decodeURIComponent(encoded).indexOf("{CHECKOUT_SESSION_ID}") !== -1);

assert.strictEqual(checkout.isCheckoutSessionId("cs_live_abc12345"), true);
assert.strictEqual(checkout.isCheckoutSessionId("cs_test_abc12345"), true);
assert.strictEqual(checkout.isCheckoutSessionId("../thanks.html"), false);
assert.strictEqual(checkout.isCheckoutSessionId("cs_live_short"), false);
assert.strictEqual(checkout.isStripeCheckoutUrl("https://checkout.stripe.com/c/pay/cs_live_x"), true);
assert.strictEqual(checkout.isStripeCheckoutUrl("https://evil.example/checkout.stripe.com"), false);
assert.strictEqual(checkout.isStripeCheckoutUrl("http://checkout.stripe.com/c/pay/x"), false);

function paid(overrides) {
  return Object.assign({
    object: "checkout.session",
    mode: "payment",
    payment_status: "paid",
    currency: "jpy",
    amount_total: 500,
    livemode: true,
    metadata: { product: "tachiai-cho" }
  }, overrides || {});
}

assert.strictEqual(checkout.sessionUnlocks(paid(), true), true);
assert.strictEqual(checkout.sessionUnlocks(paid({ amount_total: 1480 }), true), false);
assert.strictEqual(checkout.sessionUnlocks(paid({ payment_status: "unpaid" }), true), false);
assert.strictEqual(checkout.sessionUnlocks(paid({ livemode: false }), true), false);
assert.strictEqual(checkout.sessionUnlocks(paid({ livemode: false }), false), true);
assert.strictEqual(checkout.sessionUnlocks(paid({ metadata: { product: "other" } }), true), false);
assert.strictEqual(checkout.sessionUnlocks(paid({ currency: "usd" }), true), false);
assert.ok(checkout.successPage().indexOf("setUnlocked") !== -1);
assert.ok(checkout.unpaidPage().indexOf("setUnlocked") === -1);

var root = path.join(__dirname, "..", "site");
["index.html", "legal.html", "js/config.js", "js/model.js"].forEach(function (rel) {
  var text = fs.readFileSync(path.join(root, rel), "utf8");
  assert.ok(text.indexOf("1,480") === -1, rel);
  assert.ok(text.indexOf("1480") === -1, rel);
});

function request(port, method, urlPath) {
  return new Promise(function (resolve, reject) {
    var req = http.request({
      host: "127.0.0.1",
      port: port,
      method: method,
      path: urlPath
    }, function (res) {
      var chunks = [];
      res.on("data", function (chunk) { chunks.push(chunk); });
      res.on("end", function () {
        resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8"), location: res.headers.location || "" });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

var server = require("../server").server;
server.listen(0, "127.0.0.1", async function () {
  var port = server.address().port;
  try {
    var home = await request(port, "GET", "/");
    assert.strictEqual(home.status, 200);
    assert.ok(home.body.indexOf("500円") !== -1);
    assert.ok(home.body.indexOf("購入の受け付けはまだ始めていません") === -1);

    var blocked = await request(port, "GET", "/thanks.html");
    assert.strictEqual(blocked.status, 404);

    var missing = await request(port, "GET", "/api/checkout/success");
    assert.strictEqual(missing.status, 404);

    var forged = await request(port, "GET", "/api/checkout/success?session_id=cs_live_notreally");
    assert.strictEqual(forged.status, 503);

    var post = await request(port, "POST", "/api/checkout");
    assert.strictEqual(post.status, 503);
    assert.ok(post.body.indexOf("setUnlocked") === -1);
    assert.ok(post.body.indexOf("まだ接続されていません") !== -1);

    console.log("checkout tests passed");
    server.close();
  } catch (e) {
    console.error(e);
    server.close();
    process.exit(1);
  }
});
