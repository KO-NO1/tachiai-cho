var EVENTS = ["view", "app_open", "first_mark", "summary", "print_blocked", "print", "pay_click", "unlock_seen", "import_fail", "export"];

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}

export async function onRequestGet(context) {
  var auth = context.request.headers.get("authorization") || "";
  var token = context.env && context.env.ADMIN_TOKEN;
  if (!token || auth !== "Bearer " + token) return json({ error: "unauthorized" }, 401);
  var kv = context.env && context.env.METRICS;
  if (!kv) return json({ error: "no-kv" }, 501);
  var totals = {};
  for (var i = 0; i < EVENTS.length; i++) {
    totals[EVENTS[i]] = Number(await kv.get("total:" + EVENTS[i])) || 0;
  }
  return json({ totals: totals, note: "記録の本文は保存していません" }, 200);
}
